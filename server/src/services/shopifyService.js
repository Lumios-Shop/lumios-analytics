import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Service pour interagir avec l'API Admin de Shopify.
 * 
 * Pour configurer l'accès réel :
 * 1. Créez une application personnalisée dans votre admin Shopify.
 * 2. Activez les privilèges d'accès aux commandes (read_orders, read_products).
 * 3. Copiez le jeton d'accès (Access Token) dans le fichier .env (SHOPIFY_ADMIN_API_ACCESS_TOKEN).
 * 4. Définissez le nom de votre boutique (SHOPIFY_SHOP_NAME, ex: ma-boutique.myshopify.com).
 */

const SHOP_NAME = process.env.SHOPIFY_SHOP_NAME;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN;

const isConfigured = () => !!(SHOP_NAME && ACCESS_TOKEN);

/**
 * Récupère les ventes par SKU sur Shopify créées dans une plage de dates.
 * @param {string} startDate - Format YYYY-MM-DD
 * @param {string} endDate - Format YYYY-MM-DD
 * @returns {Promise<Array>} - Liste des données quotidiennes par SKU
 */
export async function getShopifySales(startDate, endDate) {
  if (!isConfigured()) {
    console.log("Shopify API non configurée (SHOPIFY_SHOP_NAME / SHOPIFY_ADMIN_API_ACCESS_TOKEN absent). Utilisation de données simulées.");
    return generateMockShopifyData(startDate, endDate);
  }

  try {
    const minDate = new Date(`${startDate}T00:00:00`).toISOString();
    const maxDate = new Date(`${endDate}T23:59:59`).toISOString();

    let allOrders = [];
    let nextUrl = `https://${SHOP_NAME}/admin/api/2024-04/orders.json`;
    let requestParams = {
      created_at_min: minDate,
      created_at_max: maxDate,
      status: 'any',
      fields: 'id,name,created_at,line_items,total_price,total_discounts,current_total_discounts,discount_codes,discount_applications,refunds,cancelled_at,financial_status,payment_gateway_names,shipping_lines,referring_site,landing_site',
      limit: 250
    };

    while (nextUrl) {
      const response = await axios.get(nextUrl, {
        params: requestParams,
        headers: {
          'X-Shopify-Access-Token': ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      });

      const orders = response.data.orders || [];
      allOrders = allOrders.concat(orders);

      // Traiter la pagination Link header de Shopify
      const linkHeader = response.headers['link'] || response.headers['Link'];
      if (linkHeader && linkHeader.includes('rel="next"')) {
        const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
        if (match) {
          nextUrl = match[1];
          requestParams = undefined; // page_info est déjà inclus dans l'URL de la page suivante
        } else {
          nextUrl = null;
        }
      } else {
        nextUrl = null;
      }
    }

    console.log(`Nombre total de commandes Shopify récupérées : ${allOrders.length}`);
    const results = processShopifyOrders(allOrders);
    results.rawOrders = allOrders;
    return results;
  } catch (error) {
    console.error("Erreur lors de la récupération des ventes Shopify :", error.message);
    throw error;
  }
}

/**
 * Traite les commandes brutes pour les agréger par jour et par SKU.
 */
function processShopifyOrders(orders) {
  const dailySkuMap = {};

  orders.forEach(order => {
    const orderDate = new Date(order.created_at).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });

    // 1. Calculer les frais de transaction selon le moyen de paiement (CB, PayPal, Apple Pay)
    const gateways = (order.payment_gateway_names || []).map(g => String(g).toLowerCase());
    const isPaypal = gateways.some(g => g.includes('paypal'));
    const isApplePay = gateways.some(g => g.includes('apple') || g.includes('apple_pay'));
    const orderRevenue = parseFloat(order.total_price || 0);
    
    // Taux par défaut : CB (1,4% + 0.25€) | PayPal (2,9% + 0.35€) | Apple Pay (1,4% + 0.25€)
    const paymentFee = isPaypal 
      ? (orderRevenue * 0.029 + 0.35) 
      : (orderRevenue * 0.014 + 0.25);

    // 2. Calculer le coût d'expédition selon le mode de livraison (Domicile, Point Relais, Express)
    const shippingLines = order.shipping_lines || [];
    let shippingCost = 0;
    let isRelais = false;
    let isExpress = false;
    if (shippingLines.length > 0) {
      const title = String(shippingLines[0].title || '').toLowerCase();
      isExpress = title.includes('express') || title.includes('24h') || title.includes('chrono');
      isRelais = !isExpress && (title.includes('relais') || title.includes('point') || title.includes('mondial') || title.includes('pickup'));
      
      // Express: 12,99 € | Domicile: 5,50 € | Point Relais: 3,50 €
      shippingCost = isExpress ? 12.99 : isRelais ? 3.50 : 5.50;
    }

    const lineItemsSubtotal = order.line_items.reduce((sum, item) => sum + (parseFloat(item.price || 0) * (item.quantity || 0)), 0) || 1;
    const totalQtyInOrder = order.line_items.reduce((acc, item) => acc + (item.quantity || 0), 0) || 1;

    let orderDiscounts = parseFloat(order.total_discounts || order.current_total_discounts || 0);
    if (orderDiscounts === 0 && order.discount_codes && order.discount_codes.length > 0) {
      orderDiscounts = order.discount_codes.reduce((sum, dc) => sum + parseFloat(dc.amount || 0), 0);
    }

    const orderRefunds = (order.refunds || []).reduce((sum, r) => {
      const lineRefunds = (r.refund_line_items || []).reduce((s, rli) => s + parseFloat(rli.subtotal || 0), 0);
      const txRefunds = (r.transactions || []).filter(t => t.kind === 'refund' && t.status === 'success').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
      return sum + Math.max(lineRefunds, txRefunds);
    }, 0);

    order.line_items.forEach(item => {
      const sku = item.sku || `SHOPIFY-UNKN-${item.title.substring(0, 10).toUpperCase().replace(/\s+/g, '-')}`;
      const qty = item.quantity || 0;
      // Chiffre d'affaires brut de l'article avant remises
      const itemGrossRevenue = parseFloat(item.price || 0) * qty;
      
      // Répartir la commande au prorata du nombre de types d'articles dans la commande
      const itemTypesCount = order.line_items.length || 1;
      const orderShare = 1 / itemTypesCount;
      const itemShare = qty / totalQtyInOrder;
      const itemFees = paymentFee * itemShare;
      const itemShipping = shippingCost * itemShare;
      const itemDiscounts = orderDiscounts * itemShare;
      const itemReturns = orderRefunds * itemShare;

      const key = `${orderDate}_${sku}`;
      if (!dailySkuMap[key]) {
        dailySkuMap[key] = {
          date: orderDate,
          sku: sku,
          name: item.title,
          source: 'shopify',
          orderCount: 0,
          salesCount: 0,
          revenue: 0,
          fees: 0,
          shippingCost: 0,
          discounts: 0,
          returns: 0,
          cbOrders: 0,
          paypalOrders: 0,
          applePayOrders: 0,
          domicileOrders: 0,
          relaisOrders: 0,
          expressOrders: 0,
          cbRevenue: 0,
          paypalRevenue: 0,
          applePayRevenue: 0,
          domicileRevenue: 0,
          relaisRevenue: 0,
          expressRevenue: 0
        };
      }

      dailySkuMap[key].orderCount += orderShare;
      dailySkuMap[key].salesCount += qty;
      dailySkuMap[key].revenue += itemGrossRevenue;
      dailySkuMap[key].fees += itemFees;
      dailySkuMap[key].shippingCost += itemShipping;
      dailySkuMap[key].discounts += itemDiscounts;
      dailySkuMap[key].returns += itemReturns;

      if (isPaypal) {
        dailySkuMap[key].paypalOrders += orderShare;
        dailySkuMap[key].paypalRevenue += itemGrossRevenue;
      } else if (isApplePay) {
        dailySkuMap[key].applePayOrders = (dailySkuMap[key].applePayOrders || 0) + orderShare;
        dailySkuMap[key].applePayRevenue = (dailySkuMap[key].applePayRevenue || 0) + itemGrossRevenue;
      } else {
        dailySkuMap[key].cbOrders += orderShare;
        dailySkuMap[key].cbRevenue += itemGrossRevenue;
      }

      if (isExpress) {
        dailySkuMap[key].expressOrders = (dailySkuMap[key].expressOrders || 0) + orderShare;
        dailySkuMap[key].expressRevenue = (dailySkuMap[key].expressRevenue || 0) + itemGrossRevenue;
      } else if (isRelais) {
        dailySkuMap[key].relaisOrders += orderShare;
        dailySkuMap[key].relaisRevenue += itemGrossRevenue;
      } else {
        dailySkuMap[key].domicileOrders += orderShare;
        dailySkuMap[key].domicileRevenue += itemGrossRevenue;
      }
    });
  });

  return Object.values(dailySkuMap).map(item => ({
    ...item,
    revenue: parseFloat(item.revenue.toFixed(2)),
    fees: parseFloat(item.fees.toFixed(2)),
    shippingCost: parseFloat(item.shippingCost.toFixed(2))
  }));
}

/**
 * Générateur de données de simulation pour Shopify.
 */
function generateMockShopifyData(startDate, endDate) {
  const skus = [
    { sku: 'SH-KIT-01', name: 'Kit Entretien Premium' },
    { sku: 'SH-BAG-02', name: 'Sac de Sport Lumios' },
    { sku: 'SH-SHO-03', name: 'Chaussures Athlétiques' }
  ];

  const data = [];
  let current = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const seed = dateStr.split('-').reduce((acc, val) => acc + parseInt(val), 0);

    skus.forEach((skuObj, idx) => {
      // Les ventes varient selon le SKU et la date
      const skuSeed = seed + idx;
      const count = skuSeed % 4; // 0 à 3 ventes par jour
      if (count > 0) {
        const unitPrice = idx === 0 ? 29.90 : idx === 1 ? 49.90 : 89.90;
        const revenue = count * unitPrice;
        const fees = revenue * 0.02; // Frais moyens de 2%

        data.push({
          date: dateStr,
          sku: skuObj.sku,
          name: skuObj.name,
          source: 'shopify',
          salesCount: count,
          revenue: parseFloat(revenue.toFixed(2)),
          fees: parseFloat(fees.toFixed(2))
        });
      }
    });

    current.setDate(current.getDate() + 1);
  }

  return data;
}
