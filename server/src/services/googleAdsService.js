import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Service pour interagir avec l'API REST Google Ads et récupérer les dépenses quotidiennes.
 */
export async function getGoogleAdsSpend(startDate, endDate) {
  const customerId = (process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/[^0-9]/g, '');
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

  if (!customerId || !developerToken || !clientId || !clientSecret || !refreshToken) {
    // Si l'un des paramètres Google Ads est manquant, retourner un tableau vide
    return [];
  }

  try {
    // 1. Obtenir un access_token OAuth 2.0 auprès de Google
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const accessToken = tokenRes.data.access_token;

    // 2. Requête GoogleAdsField / GAQL query pour obtenir les coûts quotidiens
    const query = `
      SELECT segments.date, metrics.cost_micros 
      FROM customer 
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    `;

    const loginCustomerId = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/[^0-9]/g, '');

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json'
    };

    if (loginCustomerId) {
      headers['login-customer-id'] = loginCustomerId;
    }

    const searchRes = await axios.post(
      `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`,
      { query },
      { headers }
    );

    const results = [];
    const stream = searchRes.data || [];
    stream.forEach(batch => {
      (batch.results || []).forEach(row => {
        const date = row.segments?.date;
        const costMicros = parseFloat(row.metrics?.costMicros || 0);
        const spend = costMicros / 1000000; // Conversion micros vers EUR
        if (date) {
          results.push({ date, source: 'google', spend });
        }
      });
    });

    return results;
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.response?.data?.error_description || error.message;
    console.error("Erreur lors de la récupération des dépenses Google Ads :", errorMsg);
    return [];
  }
}
