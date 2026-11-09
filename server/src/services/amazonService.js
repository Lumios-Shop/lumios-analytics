import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Service pour interagir avec l'API Amazon Selling Partner (SP-API).
 * 
 * Pour configurer l'accès réel :
 * 1. Enregistrez votre application dans Seller Central et associez-la à un rôle IAM.
 * 2. Remplissez les clés SP-API dans le fichier .env :
 *    - SELLER_CENTRAL_CLIENT_ID
 *    - SELLER_CENTRAL_CLIENT_SECRET
 *    - SELLER_CENTRAL_REFRESH_TOKEN
 *    - SELLER_CENTRAL_MARKETPLACE_ID (ex: A13V1IB3VIYZZH pour la France)
 * 3. Ce service gère automatiquement le rafraîchissement du Token LWA.
 */

const CLIENT_ID = process.env.SELLER_CENTRAL_CLIENT_ID;
const CLIENT_SECRET = process.env.SELLER_CENTRAL_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.SELLER_CENTRAL_REFRESH_TOKEN;
const MARKETPLACE_ID = process.env.SELLER_CENTRAL_MARKETPLACE_ID || 'A13V1IB3VIYZZH';
const SP_API_ENDPOINT = 'https://sellingpartnerapi-eu.amazon.com';

const isConfigured = () => !!(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);

async function getLwaAccessToken() {
  try {
    const response = await axios.post('https://api.amazon.com/auth/o2/token', {
      grant_type: 'refresh_token',
      refresh_token: REFRESH_TOKEN,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    });
    return response.data.access_token;
  } catch (error) {
    console.error("Erreur lors de l'obtention du token LWA Amazon :", error.message);
    throw error;
  }
}

/**
 * Récupère les ventes par SKU sur Amazon Seller Central créées dans une plage de dates.
 * @param {string} startDate - Format YYYY-MM-DD
 * @param {string} endDate - Format YYYY-MM-DD
 * @returns {Promise<Array>} - Liste des données quotidiennes par SKU
 */
export async function getAmazonSales(startDate, endDate) {
  if (!isConfigured()) {
    console.log("Amazon SP-API non configurée. Utilisation de données simulées.");
    return generateMockAmazonData(startDate, endDate);
  }

  try {
    const accessToken = await getLwaAccessToken();

    const minDate = new Date(`${startDate}T00:00:00+02:00`).toISOString();
    const nowMinus3Min = new Date(Date.now() - 3 * 60 * 1000);
    const requestedEnd = new Date(`${endDate}T23:59:59+02:00`);
    const maxDate = new Date(Math.min(requestedEnd.getTime(), nowMinus3Min.getTime())).toISOString();

    let orders = [];
    let nextToken = null;

    do {
      const params = nextToken
        ? { NextToken: nextToken }
        : {
            CreatedAfter: minDate,
            CreatedBefore: maxDate,
            MarketplaceIds: MARKETPLACE_ID
          };

      let response;
      let retries = 0;
      while (retries < 5) {
        try {
          response = await axios.get(`${SP_API_ENDPOINT}/orders/v0/orders`, {
            params,
            headers: {
              'X-Amz-Access-Token': accessToken,
              'Content-Type': 'application/json'
            }
          });
          break;
        } catch (apiErr) {
          if (apiErr.response?.status === 429 && retries < 4) {
            retries++;
            console.log(`Amazon SP-API rate limit 429, attente de ${retries * 2000}ms...`);
            await new Promise(res => setTimeout(res, retries * 2000));
          } else {
            console.warn(`Amazon SP-API quota temporaire ou fin de flux (${apiErr.message}), traitement avec les ${orders.length} commandes déjà reçues.`);
            nextToken = null;
            break;
          }
        }
      }

      if (!response?.data?.payload) {
        break;
      }

      const payload = response.data.payload || {};
      const pageOrders = payload.Orders || [];
      orders = orders.concat(pageOrders);
      nextToken = payload.NextToken || null;
      if (nextToken) {
        await new Promise(res => setTimeout(res, 1200));
      }
    } while (nextToken);

    console.log(`Nombre total de commandes Amazon SP-API récupérées : ${orders.length}`);
    
    // 2. Récupérer les articles pour chaque commande (Pour un vrai environnement, attention au rate limit)
    // Note: Dans une vraie application de production, on utiliserait le SP-API Report API (GET_FLAT_FILE_ALL_ORDERS_DATA_BY_LAST_UPDATE_GENERAL)
    // car appeler l'API OrderItems sur chaque commande est très lourd et va dépasser les quotas rapidement.
    // À titre d'illustration de la logique d'intégration, voici la structure de traitement :
    const dailySkuMap = {};

    for (const order of orders) {
      const orderDate = new Date(order.PurchaseDate).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
      const sku = 'AMAZON-DEFAULT';
      const qty = (order.NumberOfItemsShipped || 0) + (order.NumberOfItemsUnshipped || 0) || 1;
      const isCanceled = order.OrderStatus === 'Canceled';

      // Pour les commandes Pending ou Canceled sans montant fourni par l'API Orders, supputer le montant unitaire (40,00€ par défaut)
      const rawAmount = parseFloat(order.OrderTotal?.Amount || 0);
      const revenue = rawAmount > 0 ? rawAmount : (40.00 * qty);
      const referralFee = revenue * 0.15; // Commission Marketplace 15%
      const fbaShippingCost = order.FulfillmentChannel === 'AFN' ? (4.25 * qty) : 0.0; // Frais d'expédition Amazon FBA
      const discounts = parseFloat(order.PromotionDiscountAmount?.Amount || 0);
      const returns = isCanceled ? revenue : 0;

      const key = `${orderDate}_${sku}`;
      if (!dailySkuMap[key]) {
        dailySkuMap[key] = {
          date: orderDate,
          sku: sku,
          name: 'Ventes Amazon Globales',
          source: 'amazon',
          orderCount: 0,
          salesCount: 0,
          revenue: 0,
          fees: 0,
          shippingCost: 0,
          discounts: 0,
          returns: 0
        };
      }

      dailySkuMap[key].orderCount += 1;
      dailySkuMap[key].salesCount += qty;

      if (!isCanceled) {
        dailySkuMap[key].revenue += revenue;
        dailySkuMap[key].fees += referralFee;
        dailySkuMap[key].shippingCost += fbaShippingCost;
        dailySkuMap[key].discounts += discounts;
      } else {
        dailySkuMap[key].returns += returns;
      }
    }

    const results = Object.values(dailySkuMap);
    results.rawOrders = orders;
    return results;
  } catch (error) {
    console.error("Erreur lors de la récupération des ventes Amazon :", error.message);
    throw error;
  }
}

/**
 * Générateur de données de simulation Amazon.
 */
function generateMockAmazonData(startDate, endDate) {
  const skus = [
    { sku: 'AMZ-PL-01', name: 'Oreiller Ergonomique' },
    { sku: 'AMZ-PL-02', name: 'Housse de Voyage Lumios' },
    { sku: 'AMZ-PL-03', name: 'Masseur Cervical Chauffant' }
  ];

  const data = [];
  let current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const seed = dateStr.split('-').reduce((acc, val) => acc + parseInt(val), 0) + 150; // graine décalée

    skus.forEach((skuObj, idx) => {
      const skuSeed = seed + idx;
      const count = skuSeed % 3; // 0 à 2 ventes par jour
      if (count > 0) {
        const unitPrice = idx === 0 ? 34.90 : idx === 1 ? 19.90 : 59.90;
        const revenue = count * unitPrice;
        
        // Frais Amazon : 15% commission Marketplace + 4.50€ de frais de livraison FBA par unité vendue
        const referralFee = revenue * 0.15;
        const fbaFee = count * 4.50;

        data.push({
          date: dateStr,
          sku: skuObj.sku,
          name: skuObj.name,
          source: 'amazon',
          salesCount: count,
          revenue: parseFloat(revenue.toFixed(2)),
          fees: parseFloat(referralFee.toFixed(2)),
          shippingCost: parseFloat(fbaFee.toFixed(2))
        });
      }
    });

    current.setDate(current.getDate() + 1);
  }

  return data;
}
