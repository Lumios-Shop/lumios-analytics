import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Service pour interagir avec l'API Amazon Advertising (Sponsored Products / Amazon Ads).
 */
export async function getAmazonAdsSpend(startDate, endDate) {
  const profileId = process.env.AMAZON_ADS_PROFILE_ID;
  const refreshToken = process.env.AMAZON_ADS_REFRESH_TOKEN || process.env.SELLER_CENTRAL_REFRESH_TOKEN;
  const clientId = process.env.SELLER_CENTRAL_CLIENT_ID;
  const clientSecret = process.env.SELLER_CENTRAL_CLIENT_SECRET;

  if (!profileId || !refreshToken || !clientId) {
    // Si l'API Amazon Advertising n'est pas encore configurée avec profileId, renvoyer tableau vide
    return [];
  }

  try {
    // 1. Obtenir un jeton LWA Access Token
    const tokenResponse = await axios.post('https://api.amazon.com/auth/o2/token', new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = tokenResponse.data.access_token;

    // 2. Requêter les statistiques Sponsored Products daily spend (EU endpoint)
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
    console.error("Erreur lors de la récupération des dépenses Amazon Ads :", error.response?.data || error.message);
    return [];
  }
}
