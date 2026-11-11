import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Service pour récupérer les dépenses publicitaires quotidiennes depuis l'API Meta Graph Marketing.
 */
export async function getMetaAdsSpend(startDate, endDate) {
  const token = process.env.META_ACCESS_TOKEN;
  let adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!token || !adAccountId) {
    console.log("INFO: Identifiants Meta Ads manquants dans server/.env (META_ACCESS_TOKEN / META_AD_ACCOUNT_ID).");
    return [];
  }

  // Nettoyer l'ID de compte publicitaire pour s'assurer du format act_<DIGITS>
  const digitsOnly = adAccountId.replace(/[^0-9]/g, '');
  adAccountId = `act_${digitsOnly}`;

  try {
    const response = await axios.get(`https://graph.facebook.com/v19.0/${adAccountId}/insights`, {
      params: {
        access_token: token,
        fields: 'spend,date_start,date_stop,actions,action_values',
        time_increment: 1,
        time_range: JSON.stringify({ since: startDate, until: endDate }),
        limit: 500
      }
    });

    const data = response.data?.data || [];
    return data.map(item => {
      const actions = item.actions || [];
      const actionValues = item.action_values || [];

      const purchaseAction =
        actions.find(a => a.action_type === 'purchase') ||
        actions.find(a => a.action_type === 'omni_purchase') ||
        actions.find(a => a.action_type === 'offsite_conversion.fb_pixel_purchase');

      const purchaseValue =
        actionValues.find(a => a.action_type === 'purchase') ||
        actionValues.find(a => a.action_type === 'omni_purchase') ||
        actionValues.find(a => a.action_type === 'offsite_conversion.fb_pixel_purchase');

      const orders = parseFloat(purchaseAction?.value || 0);
      const conversionValue = parseFloat(purchaseValue?.value || 0);

      return {
        date: item.date_start,
        source: 'facebook',
        spend: parseFloat(item.spend || 0),
        orders,
        conversionValue
      };
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des dépenses Meta Ads :", error.response?.data?.error?.message || error.message);
    return [];
  }
}
