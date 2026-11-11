import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Récupère les dépenses Google Ads depuis un Google Sheet synchronisé via Google Ads Script.
 * @param {string} sheetUrl - Lien public de la feuille Google Sheet
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 */
export async function getGoogleAdsSpendFromSheet(sheetUrl, startDate, endDate) {
  if (!sheetUrl) return [];

  try {
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      console.warn("URL Google Sheet invalide pour Google Ads :", sheetUrl);
      return [];
    }

    const sheetId = match[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

    const res = await axios.get(csvUrl, { timeout: 12000 });
    const lines = (res.data || '').split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return [];

    const results = [];
    const startIdx = lines[0].toLowerCase().includes('date') ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      // Séparer les colonnes tout en gérant les guillemets éventuels
      const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.replace(/^"|"$/g, '').trim());
      if (parts.length >= 2) {
        let dateStr = parts[0];

        // Format DD/MM/YYYY -> YYYY-MM-DD
        if (dateStr.includes('/')) {
          const dp = dateStr.split('/');
          if (dp.length === 3) {
            dateStr = `${dp[2]}-${dp[1].padStart(2, '0')}-${dp[0].padStart(2, '0')}`;
          }
        }

        // Nettoyer les espaces, symboles € et remplacer virgule par point
        const costClean = parts[1].replace(/[^0-9.,-]/g, '').replace(',', '.');
        const spend = parseFloat(costClean);

        if (dateStr && !isNaN(spend)) {
          if (!startDate || !endDate || (dateStr >= startDate && dateStr <= endDate)) {
            results.push({
              date: dateStr,
              source: 'google',
              spend: Math.round(spend * 100) / 100
            });
          }
        }
      }
    }

    console.log(`Google Sheet Google Ads : ${results.length} jours de dépenses récupérés avec succès.`);
    return results;
  } catch (sheetErr) {
    console.error("Erreur lors de la lecture du Google Sheet Google Ads :", sheetErr.message);
    return [];
  }
}

/**
 * Service pour interagir avec Google Ads (Google Sheet en priorité, puis API REST v26 en fallback).
 */
export async function getGoogleAdsSpend(startDate, endDate) {
  // 1. Vérifier si un Google Sheet est configuré dans les paramètres de la base de données ou en variable d'environnement
  try {
    const db = getDb();
    const sheetSetting = await db.get(`SELECT value FROM settings WHERE key = 'google_ads_sheet_url'`);
    const sheetUrl = (sheetSetting && sheetSetting.value) ? sheetSetting.value.trim() : (process.env.GOOGLE_ADS_SHEET_URL || '').trim();

    if (sheetUrl) {
      const sheetData = await getGoogleAdsSpendFromSheet(sheetUrl, startDate, endDate);
      if (sheetData && sheetData.length > 0) {
        return sheetData;
      }
    }
  } catch (dbErr) {
    console.warn("Vérification Google Sheet dans DB ignorée :", dbErr.message);
  }

  // 2. Si pas de Google Sheet ou vide, tenter l'API REST v26
  const customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/[^0-9]/g, '');
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = (process.env.GOOGLE_ADS_REFRESH_TOKEN || '').trim();

  if (!customerId || !developerToken || !clientId || !clientSecret || !refreshToken) {
    return [];
  }

  try {
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = tokenRes.data.access_token;
    if (!accessToken) {
      throw new Error("Impossible d'obtenir le jeton d'accès OAuth Google.");
    }

    const queryWithCart = `
      SELECT segments.date, metrics.cost_micros, metrics.conversions, metrics.conversions_value, metrics.orders, metrics.units_sold
      FROM customer
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    `;
    const queryFallback = `
      SELECT segments.date, metrics.cost_micros, metrics.conversions, metrics.conversions_value
      FROM customer
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    `;

    const loginCustomerId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/[^0-9]/g, '');

    const makeHeaders = (useLoginId = true) => {
      const h = {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': developerToken,
        'Content-Type': 'application/json'
      };
      if (useLoginId && loginCustomerId && loginCustomerId !== customerId) {
        h['login-customer-id'] = loginCustomerId;
      }
      return h;
    };

    const runQuery = async (gaql) => {
      const apiVersion = 'v26';
      try {
        return await axios.post(
          `https://googleads.googleapis.com/${apiVersion}/customers/${customerId}/googleAds:searchStream`,
          { query: gaql },
          { headers: makeHeaders(true) }
        );
      } catch (firstErr) {
        if (loginCustomerId) {
          return await axios.post(
            `https://googleads.googleapis.com/${apiVersion}/customers/${customerId}/googleAds:searchStream`,
            { query: gaql },
            { headers: makeHeaders(false) }
          );
        }
        throw firstErr;
      }
    };

    let searchRes;
    try {
      searchRes = await runQuery(queryWithCart);
    } catch {
      searchRes = await runQuery(queryFallback);
    }

    const results = [];
    const stream = searchRes.data || [];
    stream.forEach(batch => {
      (batch.results || []).forEach(row => {
        const date = row.segments?.date;
        const costMicros = parseFloat(row.metrics?.costMicros || 0);
        const spend = costMicros / 1000000;
        const orders = parseFloat(row.metrics?.orders ?? row.metrics?.conversions ?? 0);
        const unitsSold = parseFloat(row.metrics?.unitsSold ?? row.metrics?.orders ?? row.metrics?.conversions ?? 0);
        const conversionValue = parseFloat(row.metrics?.conversionsValue || 0);
        if (date) {
          results.push({
            date,
            source: 'google',
            spend: Math.round(spend * 100) / 100,
            orders: Math.round(orders * 100) / 100,
            unitsSold: Math.round(unitsSold * 100) / 100,
            conversionValue: Math.round(conversionValue * 100) / 100
          });
        }
      });
    });

    return results;
  } catch (error) {
    const errorDetails = error.response?.data?.error?.details?.[0]?.errors?.[0]?.message 
      || error.response?.data?.error?.message 
      || error.response?.data 
      || error.message;

    console.error('Erreur lors de la récupération des dépenses Google Ads :', typeof errorDetails === 'object' ? JSON.stringify(errorDetails) : errorDetails);
    return [];
  }
}
