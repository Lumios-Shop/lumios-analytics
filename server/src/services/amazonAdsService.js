import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Récupère les dépenses Amazon Ads depuis un Google Sheet.
 */
export async function getAmazonAdsSpendFromSheet(sheetUrl, startDate, endDate) {
  if (!sheetUrl) return [];

  try {
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return [];
    const sheetId = match[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

    const res = await axios.get(csvUrl, { timeout: 12000 });
    const lines = (res.data || '').split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return [];

    const headers = lines[0].toLowerCase().split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.replace(/^"|"$/g, '').trim());
    let amazonColIdx = headers.findIndex(h => h.includes('amazon') || h.includes('amz') || h.includes('sponsored'));
    if (amazonColIdx === -1) {
      amazonColIdx = headers.length > 2 ? 2 : 1;
    }

    const results = [];
    const startIdx = lines[0].toLowerCase().includes('date') ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.replace(/^"|"$/g, '').trim());
      if (parts.length > amazonColIdx) {
        let dateStr = parts[0];
        if (dateStr.includes('/')) {
          const dp = dateStr.split('/');
          if (dp.length === 3) dateStr = `${dp[2]}-${dp[1].padStart(2, '0')}-${dp[0].padStart(2, '0')}`;
        }
        const costClean = parts[amazonColIdx].replace(/[^0-9.,-]/g, '').replace(',', '.');
        const spend = parseFloat(costClean);
        if (dateStr && !isNaN(spend) && spend > 0) {
          if (!startDate || !endDate || (dateStr >= startDate && dateStr <= endDate)) {
            results.push({ date: dateStr, source: 'amazon', spend: Math.round(spend * 100) / 100 });
          }
        }
      }
    }

    if (results.length > 0) {
      console.log(`Google Sheet Amazon Ads : ${results.length} jours de dépenses récupérés avec succès.`);
    }
    return results;
  } catch (err) {
    console.error("Erreur lecture Google Sheet Amazon Ads :", err.message);
    return [];
  }
}

/**
 * Service pour interagir avec l'API Amazon Advertising (Sponsored Products / Amazon Ads).
 */
export async function getAmazonAdsSpend(startDate, endDate) {
  // 1. Tenter la synchronisation via Google Sheet si configuré
  try {
    const db = getDb();
    const sheetSetting = await db.get(`SELECT value FROM settings WHERE key = 'google_ads_sheet_url' OR key = 'amazon_ads_sheet_url'`);
    const sheetUrl = (sheetSetting && sheetSetting.value) ? sheetSetting.value.trim() : (process.env.AMAZON_ADS_SHEET_URL || process.env.GOOGLE_ADS_SHEET_URL || '').trim();

    if (sheetUrl) {
      const sheetData = await getAmazonAdsSpendFromSheet(sheetUrl, startDate, endDate);
      if (sheetData && sheetData.length > 0) {
        return sheetData;
      }
    }
  } catch (dbErr) {
    // Continuer vers l'API si erreur DB
  }

  // 2. Tenter l'API Amazon Advertising si un refresh token valide (Atzr|...) est fourni
  const profileId = process.env.AMAZON_ADS_PROFILE_ID;
  const rawRefreshToken = process.env.AMAZON_ADS_REFRESH_TOKEN;
  const clientId = process.env.SELLER_CENTRAL_CLIENT_ID;
  const clientSecret = process.env.SELLER_CENTRAL_CLIENT_SECRET;

  // Si le token ne commence pas par Atzr|, c'est un client secret ou token invalide
  if (!rawRefreshToken || !rawRefreshToken.startsWith('Atzr|') || !profileId || !clientId) {
    return [];
  }

  try {
    const tokenResponse = await axios.post('https://api.amazon.com/auth/o2/token', new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: rawRefreshToken,
      client_id: clientId,
      client_secret: clientSecret
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = tokenResponse.data.access_token;

    const reportResponse = await axios.get(`https://advertising-api-eu.amazon.com/v2/sp/campaigns/report`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Amazon-Advertising-API-ClientId': clientId,
        'Amazon-Advertising-API-Scope': profileId,
        'Content-Type': 'application/json'
      },
      params: {
        reportDate: startDate.replace(/-/g, ''),
        metrics: 'cost,impressions,clicks'
      }
    });

    const data = reportResponse.data || [];
    return data.map(item => ({
      date: startDate,
      source: 'amazon',
      spend: parseFloat(item.cost || 0)
    }));
  } catch (error) {
    console.error("Erreur lors de la récupération des dépenses Amazon Ads :", error.response?.data?.error_description || error.response?.data || error.message);
    return [];
  }
}
