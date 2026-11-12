import { getDb } from '../db.js';
import { getShopifySales } from './shopifyService.js';
import { getAmazonSales } from './amazonService.js';
import { getMetaAdsSpend } from './facebookAdsService.js';
import { getAmazonAdsSpend } from './amazonAdsService.js';
import { getGoogleAdsSpend } from './googleAdsService.js';
import { saveBatchAdSpends } from './adSpendService.js';

/**
 * Service pour synchroniser et mettre en cache les données de vente de Shopify et Amazon.
 */

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes de cache pour le jour J
const activeSyncPromises = new Map();

/**
 * Exécute la synchronisation en direct des API avec gestion de verrou anti-doublon.
 */
async function performSync(startDate, endDate) {
  const db = getDb();
  console.log(`Synchronisation en direct des API Shopify, Amazon, Meta Ads, Amazon Ads et Google Ads pour la période : ${startDate} au ${endDate}`);
  
  try {
    // Déterminer la plage optimale pour Amazon SP-API pour éviter les quotas stricts (429)
    let amazonStartDate = startDate;
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);
    const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

    // Vérifier si nous avons déjà des données Amazon historiques enregistrées
    const existingAmazonHistorical = await db.get(
      `SELECT count(*) as count FROM daily_sku_sales WHERE source = 'amazon' AND date < ?`,
      [threeDaysAgoStr]
    );

    if (existingAmazonHistorical?.count > 0 && startDate < threeDaysAgoStr) {
      // Les données historiques sont déjà là, on synchronise les 3 derniers jours pour garantir le temps réel sans saturer SP-API
      amazonStartDate = threeDaysAgoStr;
    }

    const [shopifyData, amazonData, metaAdsData, amazonAdsData, googleAdsData] = await Promise.all([
      getShopifySales(startDate, endDate),
      getAmazonSales(amazonStartDate, endDate),
      getMetaAdsSpend(startDate, endDate),
      getAmazonAdsSpend(startDate, endDate),
      getGoogleAdsSpend(startDate, endDate)
    ]);

    if (metaAdsData && metaAdsData.length > 0) {
      // Calculer les quantités estimées pour Meta via le ratio réel articles/commande Shopify des commandes Meta (ou global)
      const shopifyStatsByDate = {};
      let globalShopifyOrders = 0;
      let globalShopifyUnits = 0;
      (shopifyData || []).forEach(s => {
        if (!shopifyStatsByDate[s.date]) shopifyStatsByDate[s.date] = { orders: 0, units: 0 };
        shopifyStatsByDate[s.date].orders += (s.orderCount || 0);
        shopifyStatsByDate[s.date].units += (s.salesCount || 0);
        globalShopifyOrders += (s.orderCount || 0);
        globalShopifyUnits += (s.salesCount || 0);
      });

      const metaShopifyByDate = {};
      let globalMetaShopifyOrders = 0;
      let globalMetaShopifyUnits = 0;
      if (shopifyData && shopifyData.rawOrders) {
        shopifyData.rawOrders.forEach(o => {
          const ref = (o.referring_site || '').toLowerCase();
          const land = (o.landing_site || '').toLowerCase();
          if (ref.includes('facebook') || ref.includes('instagram') || land.includes('fbclid') || land.includes('utm_source=facebook') || land.includes('utm_source=meta') || land.includes('utm_source=ig')) {
            const d = new Date(o.created_at).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
            const qty = (o.line_items || []).reduce((sum, li) => sum + (li.quantity || 1), 0);
            if (!metaShopifyByDate[d]) metaShopifyByDate[d] = { orders: 0, units: 0 };
            metaShopifyByDate[d].orders += 1;
            metaShopifyByDate[d].units += qty;
            globalMetaShopifyOrders += 1;
            globalMetaShopifyUnits += qty;
          }
        });
      }

      const defaultMetaRatio = globalMetaShopifyOrders > 0
        ? (globalMetaShopifyUnits / globalMetaShopifyOrders)
        : (globalShopifyOrders > 0 ? (globalShopifyUnits / globalShopifyOrders) : 1.15);

      const enrichedMetaData = metaAdsData.map(item => {
        const dayMeta = metaShopifyByDate[item.date];
        const dayAll = shopifyStatsByDate[item.date];
        const ratio = (dayMeta && dayMeta.orders >= 2)
          ? (dayMeta.units / dayMeta.orders)
          : ((dayAll && dayAll.orders > 0) ? (dayAll.units / dayAll.orders) : defaultMetaRatio);
        const orders = item.orders || 0;
        const unitsSold = orders > 0 ? Math.max(orders, Math.round(orders * ratio * 100) / 100) : 0;
        return { ...item, unitsSold };
      });
      await saveBatchAdSpends(enrichedMetaData);
    }

    if (amazonAdsData && amazonAdsData.length > 0) {
      await saveBatchAdSpends(amazonAdsData);
    }

    if (googleAdsData && googleAdsData.length > 0) {
      await saveBatchAdSpends(googleAdsData);
    }

    const insertStmt = await db.prepare(`
      INSERT OR REPLACE INTO daily_sku_sales (
        date, sku, source, order_count, sales_count, revenue, fees, shipping_cost,
        discounts, returns, cb_orders, paypal_orders, domicile_orders, relais_orders,
        cb_revenue, paypal_revenue, domicile_revenue, relais_revenue
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertCostStmt = await db.prepare(`
      INSERT OR IGNORE INTO product_costs (sku, name, source, cogs)
      VALUES (?, ?, ?, 0.0)
    `);

    // Traiter les données Shopify (uniquement les dates reçues pour ne jamais écraser l'historique)
    if (shopifyData && shopifyData.length > 0) {
      const datesToUpdate = [...new Set(shopifyData.map(item => item.date))];
      for (const d of datesToUpdate) {
        await db.run(
          `DELETE FROM daily_sku_sales WHERE source = 'shopify' AND date = ?`,
          [d]
        );
      }
      for (const item of shopifyData) {
        await insertStmt.run(
          item.date,
          item.sku,
          'shopify',
          Math.round((item.orderCount || 1) * 100) / 100,
          item.salesCount,
          item.revenue,
          item.fees,
          item.shippingCost || 0.0,
          item.discounts || 0.0,
          item.returns || 0.0,
          Math.round((item.cbOrders || 0) * 100) / 100,
          Math.round((item.paypalOrders || 0) * 100) / 100,
          Math.round((item.domicileOrders || 0) * 100) / 100,
          Math.round((item.relaisOrders || 0) * 100) / 100,
          item.cbRevenue || 0.0,
          item.paypalRevenue || 0.0,
          item.domicileRevenue || 0.0,
          item.relaisRevenue || 0.0
        );
        await insertCostStmt.run(item.sku, item.name, 'shopify');
      }
    }

    // Traiter les données Amazon (uniquement les dates reçues pour préserver l'historique)
    if (amazonData && amazonData.length > 0) {
      const datesToUpdate = [...new Set(amazonData.map(item => item.date))];
      for (const d of datesToUpdate) {
        await db.run(
          `DELETE FROM daily_sku_sales WHERE source = 'amazon' AND date = ?`,
          [d]
        );
      }
      for (const item of amazonData) {
        await insertStmt.run(
          item.date,
          item.sku,
          'amazon',
          item.orderCount || 1,
          item.salesCount,
          item.revenue,
          item.fees,
          item.shippingCost || 0.0,
          0.0, 0.0, 0, 0, 0, 0, 0.0, 0.0, 0.0, 0.0
        );
        await insertCostStmt.run(item.sku, item.name, 'amazon');
      }
    }

    await insertStmt.finalize();
    await insertCostStmt.finalize();

    // Sauvegarder les commandes individuelles détaillées dans orders_cache
    try {
      const insertOrderStmt = await db.prepare(`
        INSERT OR REPLACE INTO orders_cache (
          order_id, order_number, source, date, created_at,
          total_price, items_count, items_summary, items_json,
          payment_method, shipping_method, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      if (shopifyData && shopifyData.rawOrders && shopifyData.rawOrders.length > 0) {
        const datesToUpdate = [...new Set(shopifyData.rawOrders.map(order => 
          new Date(order.created_at).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
        ))];
        for (const d of datesToUpdate) {
          await db.run(`DELETE FROM orders_cache WHERE source = 'shopify' AND date = ?`, [d]);
        }
        for (const order of shopifyData.rawOrders) {
          const orderDate = new Date(order.created_at).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
          const items = (order.line_items || []).map(li => ({
            title: li.title,
            sku: li.sku || 'LUMIOS01',
            quantity: li.quantity || 1,
            price: parseFloat(li.price || 0)
          }));
          const totalItemsCount = items.reduce((sum, it) => sum + it.quantity, 0);
          const itemsSummary = items.map(it => `${it.quantity}x ${it.title}`).join(', ');
          const paymentMethod = (order.payment_gateway_names || []).join(', ') || 'CB';
          const shippingMethod = order.shipping_lines?.[0]?.title || 'Standard';

          await insertOrderStmt.run(
            `shopify_${order.id}`,
            order.name || `#${order.id}`,
            'shopify',
            orderDate,
            order.created_at,
            parseFloat(order.total_price || 0),
            totalItemsCount,
            itemsSummary,
            JSON.stringify(items),
            paymentMethod,
            shippingMethod,
            order.financial_status || 'paid'
          );
        }
      }

      if (amazonData && amazonData.rawOrders && amazonData.rawOrders.length > 0) {
        const datesToUpdate = [...new Set(amazonData.rawOrders.map(order => 
          new Date(order.PurchaseDate).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
        ))];
        for (const d of datesToUpdate) {
          await db.run(`DELETE FROM orders_cache WHERE source = 'amazon' AND date = ?`, [d]);
        }
        for (const order of amazonData.rawOrders) {
          const orderDate = new Date(order.PurchaseDate).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
          const qty = (order.NumberOfItemsShipped || 0) + (order.NumberOfItemsUnshipped || 0) || 1;
          const rawAmount = parseFloat(order.OrderTotal?.Amount || 0);
          const revenue = rawAmount > 0 ? rawAmount : (40.00 * qty);
          const items = [{
            title: 'Lumios - Le Jeu',
            sku: 'AMAZON-DEFAULT',
            quantity: qty,
            price: 40.00
          }];

          await insertOrderStmt.run(
            `amazon_${order.AmazonOrderId}`,
            order.AmazonOrderId,
            'amazon',
            orderDate,
            order.PurchaseDate,
            revenue,
            qty,
            `${qty}x Lumios - Le Jeu`,
            JSON.stringify(items),
            'Amazon Pay',
            order.FulfillmentChannel === 'AFN' ? 'Expédié par Amazon (FBA)' : 'Expédié par Vendeur (FBM)',
            order.OrderStatus || 'Shipped'
          );
        }
      }

      await insertOrderStmt.finalize();
    } catch (ordersErr) {
      console.error("Erreur lors de la mise en cache des commandes détaillées :", ordersErr);
    }

    await db.run(
      `INSERT OR REPLACE INTO settings (key, value) VALUES ('last_sync_today', ?)`,
      [Date.now().toString()]
    );

    // Mémoriser la date de début la plus ancienne déjà synchronisée pour Shopify
    const prevEarliest = await db.get(`SELECT value FROM settings WHERE key = 'earliest_shopify_sync'`);
    if (!prevEarliest?.value || startDate < prevEarliest.value) {
      await db.run(
        `INSERT OR REPLACE INTO settings (key, value) VALUES ('earliest_shopify_sync', ?)`,
        [startDate]
      );
    }
  } catch (err) {
    console.error("Erreur lors de la synchronisation avec les API :", err);
  }
}

/**
 * Synchronise les données pour une période donnée et renvoie le récapitulatif agrégé.
 * @param {string} startDate - Format YYYY-MM-DD
 * @param {string} endDate - Format YYYY-MM-DD
 * @param {boolean} forceRefresh - Forcer la synchronisation avec les API
 */
export async function syncAndGetSalesData(startDate, endDate, forceRefresh = false, granularity = 'daily') {
  const requestedDates = [];
  let current = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    requestedDates.push(dateStr);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  const db = getDb();

  // Vérifier le cache si forceRefresh est false
  let shouldSync = true;
  if (!forceRefresh) {
    const lastSyncSetting = await db.get(`SELECT value FROM settings WHERE key = 'last_sync_today'`);
    const earliestSetting = await db.get(`SELECT value FROM settings WHERE key = 'earliest_shopify_sync'`);
    const lastSyncTime = lastSyncSetting?.value ? parseInt(lastSyncSetting.value) : 0;
    const isRecent = (Date.now() - lastSyncTime) < (5 * 60 * 1000); // 5 minutes TTL
    const isRangeCovered = earliestSetting?.value && startDate >= earliestSetting.value;
    
    // Vérifier si la base a déjà des données récentes
    const hasEndData = await db.get(
      `SELECT count(*) as count FROM daily_sku_sales WHERE date = ?`,
      [endDate]
    );

    if (isRecent && isRangeCovered && hasEndData?.count > 0) {
      shouldSync = false;
    }
  }

  if (shouldSync) {
    const syncKey = `${startDate}_${endDate}`;
    if (activeSyncPromises.has(syncKey)) {
      // Si une synchronisation identique est déjà en cours, attendre sa fin
      await activeSyncPromises.get(syncKey);
    } else {
      const promise = performSync(startDate, endDate);
      activeSyncPromises.set(syncKey, promise);
      try {
        await promise;
      } finally {
        activeSyncPromises.delete(syncKey);
      }
    }
  }

  // 5. Récupérer les données agrégées et calculer la marge avec les COGS, frais d'expédition et dépenses Ads
  const salesQuery = `
    SELECT 
      s.date,
      SUM(CASE WHEN s.source = 'shopify' THEN COALESCE(s.order_count, s.sales_count) ELSE 0 END) as shopify_orders_count,
      SUM(CASE WHEN s.source = 'shopify' THEN s.sales_count ELSE 0 END) as shopify_sales_count,
      SUM(CASE WHEN s.source = 'shopify' THEN s.revenue ELSE 0.0 END) as shopify_revenue,
      SUM(CASE WHEN s.source = 'shopify' THEN s.fees ELSE 0.0 END) as shopify_fees,
      SUM(CASE WHEN s.source = 'shopify' THEN COALESCE(s.shipping_cost, 0.0) ELSE 0.0 END) as shopify_shipping,
      SUM(CASE WHEN s.source = 'shopify' THEN s.sales_count * COALESCE(c.cogs, 0.0) ELSE 0.0 END) as shopify_cogs,
      SUM(CASE WHEN s.source = 'shopify' THEN COALESCE(s.discounts, 0.0) ELSE 0.0 END) as shopify_discounts,
      SUM(CASE WHEN s.source = 'shopify' THEN COALESCE(s.returns, 0.0) ELSE 0.0 END) as shopify_returns,
      SUM(CASE WHEN s.source = 'shopify' THEN COALESCE(s.cb_orders, 0) ELSE 0 END) as cb_orders,
      SUM(CASE WHEN s.source = 'shopify' THEN COALESCE(s.paypal_orders, 0) ELSE 0 END) as paypal_orders,
      SUM(CASE WHEN s.source = 'shopify' THEN COALESCE(s.domicile_orders, 0) ELSE 0 END) as domicile_orders,
      SUM(CASE WHEN s.source = 'shopify' THEN COALESCE(s.relais_orders, 0) ELSE 0 END) as relais_orders,
      SUM(CASE WHEN s.source = 'shopify' THEN COALESCE(s.cb_revenue, 0.0) ELSE 0.0 END) as cb_revenue,
      SUM(CASE WHEN s.source = 'shopify' THEN COALESCE(s.paypal_revenue, 0.0) ELSE 0.0 END) as paypal_revenue,
      SUM(CASE WHEN s.source = 'shopify' THEN COALESCE(s.domicile_revenue, 0.0) ELSE 0.0 END) as domicile_revenue,
      SUM(CASE WHEN s.source = 'shopify' THEN COALESCE(s.relais_revenue, 0.0) ELSE 0.0 END) as relais_revenue,
      SUM(CASE WHEN s.source = 'amazon' THEN COALESCE(s.order_count, s.sales_count) ELSE 0 END) as amazon_orders_count,
      SUM(CASE WHEN s.source = 'amazon' THEN s.sales_count ELSE 0 END) as amazon_sales_count,
      SUM(CASE WHEN s.source = 'amazon' THEN s.revenue ELSE 0.0 END) as amazon_revenue,
      SUM(CASE WHEN s.source = 'amazon' THEN s.fees ELSE 0.0 END) as amazon_fees,
      SUM(CASE WHEN s.source = 'amazon' THEN COALESCE(s.shipping_cost, 0.0) ELSE 0.0 END) as amazon_shipping,
      SUM(CASE WHEN s.source = 'amazon' THEN s.sales_count * COALESCE(c.cogs, 0.0) ELSE 0.0 END) as amazon_cogs,
      SUM(CASE WHEN s.source = 'amazon' THEN COALESCE(s.discounts, 0.0) ELSE 0.0 END) as amazon_discounts,
      SUM(CASE WHEN s.source = 'amazon' THEN COALESCE(s.returns, 0.0) ELSE 0.0 END) as amazon_returns
    FROM daily_sku_sales s
    LEFT JOIN product_costs c ON s.sku = c.sku AND s.source = c.source
    WHERE s.date BETWEEN ? AND ?
    GROUP BY s.date
    ORDER BY s.date ASC
  `;

  const rows = await db.all(salesQuery, [startDate, endDate]);
  const adSpendRows = await db.all(
    `SELECT date, source, spend, COALESCE(orders, 0.0) as orders, COALESCE(units_sold, 0.0) as units_sold, COALESCE(conversion_value, 0.0) as conversion_value FROM ad_spends WHERE date BETWEEN ? AND ?`,
    [startDate, endDate]
  );

  const adSpendsByDate = {};
  adSpendRows.forEach(row => {
    if (!adSpendsByDate[row.date]) {
      adSpendsByDate[row.date] = {
        facebook: 0, facebookOrders: 0, facebookUnits: 0, facebookConvValue: 0,
        google: 0, googleOrders: 0, googleUnits: 0, googleConvValue: 0,
        amazon: 0, amazonOrders: 0, amazonUnits: 0, amazonConvValue: 0
      };
    }
    const target = adSpendsByDate[row.date];
    if (row.source === 'facebook') {
      target.facebook += row.spend || 0;
      target.facebookOrders += row.orders || 0;
      target.facebookUnits += row.units_sold || 0;
      target.facebookConvValue += row.conversion_value || 0;
    }
    if (row.source === 'google') {
      target.google += row.spend || 0;
      target.googleOrders += row.orders || 0;
      target.googleUnits += row.units_sold || 0;
      target.googleConvValue += row.conversion_value || 0;
    }
    if (row.source === 'amazon') {
      target.amazon += row.spend || 0;
      target.amazonOrders += row.orders || 0;
      target.amazonUnits += row.units_sold || 0;
      target.amazonConvValue += row.conversion_value || 0;
    }
  });

  const dailyResults = [];
  const rowsByDate = {};
  rows.forEach(r => { rowsByDate[r.date] = r; });

  requestedDates.forEach(dateStr => {
    const row = rowsByDate[dateStr] || {};
    const shopifyOrdersCount = Math.round(row.shopify_orders_count || 0);
    const shopifySalesCount = row.shopify_sales_count || 0;
    const shopifyRevenue = row.shopify_revenue || 0.0;
    const shopifyFees = row.shopify_fees || 0.0;
    const shopifyShipping = row.shopify_shipping || 0.0;
    const shopifyCogs = row.shopify_cogs || 0.0;
    const shopifyDiscounts = row.shopify_discounts || 0.0;
    const shopifyReturns = row.shopify_returns || 0.0;
    
    const amazonOrdersCount = Math.round(row.amazon_orders_count || 0);
    const amazonSalesCount = row.amazon_sales_count || 0;
    const amazonRevenue = row.amazon_revenue || 0.0;
    const amazonFees = row.amazon_fees || 0.0;
    const amazonShipping = row.amazon_shipping || 0.0;
    const amazonCogs = row.amazon_cogs || 0.0;
    const amazonDiscounts = row.amazon_discounts || 0.0;
    const amazonReturns = row.amazon_returns || 0.0;

    const ads = adSpendsByDate[dateStr] || {
      facebook: 0, facebookOrders: 0, facebookUnits: 0, facebookConvValue: 0,
      google: 0, googleOrders: 0, googleUnits: 0, googleConvValue: 0,
      amazon: 0, amazonOrders: 0, amazonUnits: 0, amazonConvValue: 0
    };
    const facebookAds = ads.facebook || 0.0;
    const facebookOrders = ads.facebookOrders || 0.0;
    const facebookUnits = ads.facebookUnits || 0.0;
    const facebookConvValue = ads.facebookConvValue || 0.0;

    const googleAds = ads.google || 0.0;
    const googleOrders = ads.googleOrders || 0.0;
    const googleUnits = ads.googleUnits || 0.0;
    const googleConvValue = ads.googleConvValue || 0.0;

    const amazonAds = ads.amazon || 0.0;
    const amazonAdOrders = ads.amazonOrders || 0.0;
    const amazonAdUnits = ads.amazonUnits || 0.0;
    const amazonAdConvValue = ads.amazonConvValue || 0.0;

    const totalAdsSpend = facebookAds + googleAds + amazonAds;

    const grossRevenue = shopifyRevenue + shopifyDiscounts + shopifyReturns + amazonRevenue + amazonDiscounts + amazonReturns;
    const netRevenue = shopifyRevenue + amazonRevenue;
    const totalOrdersCount = shopifyOrdersCount + amazonOrdersCount;
    const totalSalesCount = shopifySalesCount + amazonSalesCount;
    const totalFees = shopifyFees + amazonFees;
    const totalShipping = shopifyShipping + amazonShipping;
    const totalCogs = shopifyCogs + amazonCogs;
    const margin = netRevenue - totalFees - totalCogs - totalShipping - totalAdsSpend;

    const roas = totalAdsSpend > 0 ? parseFloat((netRevenue / totalAdsSpend).toFixed(2)) : 0;
    // CPA calculé sur la quantité réelle de produits vendus (target business : ≤ 9€ / produit vendu)
    const cpa = totalSalesCount > 0 && totalAdsSpend > 0 ? parseFloat((totalAdsSpend / totalSalesCount).toFixed(2)) : 0;

    const facebookCpaOrder = facebookOrders > 0 && facebookAds > 0 ? parseFloat((facebookAds / facebookOrders).toFixed(2)) : 0;
    const facebookCpaUnit = facebookUnits > 0 && facebookAds > 0 ? parseFloat((facebookAds / facebookUnits).toFixed(2)) : 0;
    const googleCpaOrder = googleOrders > 0 && googleAds > 0 ? parseFloat((googleAds / googleOrders).toFixed(2)) : 0;
    const googleCpaUnit = googleUnits > 0 && googleAds > 0 ? parseFloat((googleAds / googleUnits).toFixed(2)) : 0;

    dailyResults.push({
      date: dateStr,
      shopifyOrdersCount,
      shopifySalesCount,
      shopifyRevenue: parseFloat(shopifyRevenue.toFixed(2)),
      shopifyFees: parseFloat(shopifyFees.toFixed(2)),
      shopifyShipping: parseFloat(shopifyShipping.toFixed(2)),
      shopifyCogs: parseFloat(shopifyCogs.toFixed(2)),
      shopifyDiscounts: parseFloat(shopifyDiscounts.toFixed(2)),
      shopifyReturns: parseFloat(shopifyReturns.toFixed(2)),
      amazonOrdersCount,
      amazonSalesCount,
      amazonRevenue: parseFloat(amazonRevenue.toFixed(2)),
      amazonFees: parseFloat(amazonFees.toFixed(2)),
      amazonShipping: parseFloat(amazonShipping.toFixed(2)),
      amazonCogs: parseFloat(amazonCogs.toFixed(2)),
      amazonDiscounts: parseFloat(amazonDiscounts.toFixed(2)),
      amazonReturns: parseFloat(amazonReturns.toFixed(2)),
      cbOrders: Math.round(row.cb_orders || 0),
      paypalOrders: Math.round(row.paypal_orders || 0),
      domicileOrders: Math.round(row.domicile_orders || 0),
      relaisOrders: Math.round(row.relais_orders || 0),
      cbRevenue: parseFloat((row.cb_revenue || 0).toFixed(2)),
      paypalRevenue: parseFloat((row.paypal_revenue || 0).toFixed(2)),
      domicileRevenue: parseFloat((row.domicile_revenue || 0).toFixed(2)),
      relaisRevenue: parseFloat((row.relais_revenue || 0).toFixed(2)),
      facebookAds: parseFloat(facebookAds.toFixed(2)),
      facebookOrders: parseFloat(facebookOrders.toFixed(2)),
      facebookUnits: parseFloat(facebookUnits.toFixed(2)),
      facebookConvValue: parseFloat(facebookConvValue.toFixed(2)),
      facebookCpaOrder,
      facebookCpaUnit,
      googleAds: parseFloat(googleAds.toFixed(2)),
      googleOrders: parseFloat(googleOrders.toFixed(2)),
      googleUnits: parseFloat(googleUnits.toFixed(2)),
      googleConvValue: parseFloat(googleConvValue.toFixed(2)),
      googleCpaOrder,
      googleCpaUnit,
      amazonAds: parseFloat(amazonAds.toFixed(2)),
      amazonAdOrders: parseFloat(amazonAdOrders.toFixed(2)),
      amazonAdUnits: parseFloat(amazonAdUnits.toFixed(2)),
      amazonAdConvValue: parseFloat(amazonAdConvValue.toFixed(2)),
      totalAdsSpend: parseFloat(totalAdsSpend.toFixed(2)),
      roas,
      cpa,
      grossRevenue: parseFloat(grossRevenue.toFixed(2)),
      totalOrdersCount,
      totalSalesCount,
      totalRevenue: parseFloat(netRevenue.toFixed(2)),
      totalFees: parseFloat(totalFees.toFixed(2)),
      totalShipping: parseFloat(totalShipping.toFixed(2)),
      totalCogs: parseFloat(totalCogs.toFixed(2)),
      margin: parseFloat(margin.toFixed(2))
    });
  });

  if (granularity === 'daily') {
    return dailyResults.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Agrégation par Granularité (semaine, mois, année)
  const groupedMap = {};
  dailyResults.forEach(item => {
    const key = getGranularityGroupKey(item.date, granularity);
    if (!groupedMap[key]) {
      groupedMap[key] = {
        date: key,
        shopifyOrdersCount: 0,
        shopifySalesCount: 0,
        shopifyRevenue: 0,
        shopifyFees: 0,
        shopifyShipping: 0,
        shopifyCogs: 0,
        shopifyDiscounts: 0,
        shopifyReturns: 0,
        amazonOrdersCount: 0,
        amazonSalesCount: 0,
        amazonRevenue: 0,
        amazonFees: 0,
        amazonShipping: 0,
        amazonCogs: 0,
        amazonDiscounts: 0,
        amazonReturns: 0,
        cbOrders: 0,
        paypalOrders: 0,
        domicileOrders: 0,
        relaisOrders: 0,
        cbRevenue: 0,
        paypalRevenue: 0,
        domicileRevenue: 0,
        relaisRevenue: 0,
        facebookAds: 0,
        facebookOrders: 0,
        facebookUnits: 0,
        facebookConvValue: 0,
        googleAds: 0,
        googleOrders: 0,
        googleUnits: 0,
        googleConvValue: 0,
        amazonAds: 0,
        amazonAdOrders: 0,
        amazonAdUnits: 0,
        amazonAdConvValue: 0,
        totalAdsSpend: 0,
        grossRevenue: 0,
        totalOrdersCount: 0,
        totalSalesCount: 0,
        totalRevenue: 0,
        totalFees: 0,
        totalShipping: 0,
        totalCogs: 0,
        margin: 0
      };
    }

    const g = groupedMap[key];
    g.shopifyOrdersCount += item.shopifyOrdersCount;
    g.shopifySalesCount += item.shopifySalesCount;
    g.shopifyRevenue += item.shopifyRevenue;
    g.shopifyFees += item.shopifyFees;
    g.shopifyShipping += item.shopifyShipping;
    g.shopifyCogs += item.shopifyCogs;
    g.shopifyDiscounts += item.shopifyDiscounts;
    g.shopifyReturns += item.shopifyReturns;
    g.amazonOrdersCount += item.amazonOrdersCount;
    g.amazonSalesCount += item.amazonSalesCount;
    g.amazonRevenue += item.amazonRevenue;
    g.amazonFees += item.amazonFees;
    g.amazonShipping += item.amazonShipping;
    g.amazonCogs += item.amazonCogs;
    g.amazonDiscounts += item.amazonDiscounts;
    g.amazonReturns += item.amazonReturns;
    g.cbOrders += item.cbOrders;
    g.paypalOrders += item.paypalOrders;
    g.domicileOrders += item.domicileOrders;
    g.relaisOrders += item.relaisOrders;
    g.cbRevenue += item.cbRevenue;
    g.paypalRevenue += item.paypalRevenue;
    g.domicileRevenue += item.domicileRevenue;
    g.relaisRevenue += item.relaisRevenue;
    g.facebookAds += item.facebookAds;
    g.facebookOrders += item.facebookOrders;
    g.facebookUnits += item.facebookUnits;
    g.facebookConvValue += item.facebookConvValue;
    g.googleAds += item.googleAds;
    g.googleOrders += item.googleOrders;
    g.googleUnits += item.googleUnits;
    g.googleConvValue += item.googleConvValue;
    g.amazonAds += item.amazonAds;
    g.amazonAdOrders += item.amazonAdOrders;
    g.amazonAdUnits += item.amazonAdUnits;
    g.amazonAdConvValue += item.amazonAdConvValue;
    g.totalAdsSpend += item.totalAdsSpend;
    g.grossRevenue += item.grossRevenue;
    g.totalOrdersCount += item.totalOrdersCount;
    g.totalSalesCount += item.totalSalesCount;
    g.totalRevenue += item.totalRevenue;
    g.totalFees += item.totalFees;
    g.totalShipping += item.totalShipping;
    g.totalCogs += item.totalCogs;
    g.margin += item.margin;
  });

  return Object.values(groupedMap).map(g => {
    const roas = g.totalAdsSpend > 0 ? parseFloat((g.totalRevenue / g.totalAdsSpend).toFixed(2)) : 0;
    // CPA agrégé sur la quantité de produits vendus
    const cpa = g.totalSalesCount > 0 && g.totalAdsSpend > 0 ? parseFloat((g.totalAdsSpend / g.totalSalesCount).toFixed(2)) : 0;

    const facebookCpaOrder = g.facebookOrders > 0 && g.facebookAds > 0 ? parseFloat((g.facebookAds / g.facebookOrders).toFixed(2)) : 0;
    const facebookCpaUnit = g.facebookUnits > 0 && g.facebookAds > 0 ? parseFloat((g.facebookAds / g.facebookUnits).toFixed(2)) : 0;
    const googleCpaOrder = g.googleOrders > 0 && g.googleAds > 0 ? parseFloat((g.googleAds / g.googleOrders).toFixed(2)) : 0;
    const googleCpaUnit = g.googleUnits > 0 && g.googleAds > 0 ? parseFloat((g.googleAds / g.googleUnits).toFixed(2)) : 0;
    
    return {
      ...g,
      shopifyRevenue: parseFloat(g.shopifyRevenue.toFixed(2)),
      shopifyFees: parseFloat(g.shopifyFees.toFixed(2)),
      shopifyShipping: parseFloat(g.shopifyShipping.toFixed(2)),
      shopifyCogs: parseFloat(g.shopifyCogs.toFixed(2)),
      shopifyDiscounts: parseFloat(g.shopifyDiscounts.toFixed(2)),
      shopifyReturns: parseFloat(g.shopifyReturns.toFixed(2)),
      amazonRevenue: parseFloat(g.amazonRevenue.toFixed(2)),
      amazonFees: parseFloat(g.amazonFees.toFixed(2)),
      amazonShipping: parseFloat(g.amazonShipping.toFixed(2)),
      amazonCogs: parseFloat(g.amazonCogs.toFixed(2)),
      cbRevenue: parseFloat(g.cbRevenue.toFixed(2)),
      paypalRevenue: parseFloat(g.paypalRevenue.toFixed(2)),
      domicileRevenue: parseFloat(g.domicileRevenue.toFixed(2)),
      relaisRevenue: parseFloat(g.relaisRevenue.toFixed(2)),
      facebookAds: parseFloat(g.facebookAds.toFixed(2)),
      facebookOrders: parseFloat(g.facebookOrders.toFixed(2)),
      facebookUnits: parseFloat(g.facebookUnits.toFixed(2)),
      facebookConvValue: parseFloat(g.facebookConvValue.toFixed(2)),
      facebookCpaOrder,
      facebookCpaUnit,
      googleAds: parseFloat(g.googleAds.toFixed(2)),
      googleOrders: parseFloat(g.googleOrders.toFixed(2)),
      googleUnits: parseFloat(g.googleUnits.toFixed(2)),
      googleConvValue: parseFloat(g.googleConvValue.toFixed(2)),
      googleCpaOrder,
      googleCpaUnit,
      amazonAds: parseFloat(g.amazonAds.toFixed(2)),
      amazonAdOrders: parseFloat(g.amazonAdOrders.toFixed(2)),
      amazonAdUnits: parseFloat(g.amazonAdUnits.toFixed(2)),
      amazonAdConvValue: parseFloat(g.amazonAdConvValue.toFixed(2)),
      totalAdsSpend: parseFloat(g.totalAdsSpend.toFixed(2)),
      grossRevenue: parseFloat(g.grossRevenue.toFixed(2)),
      totalRevenue: parseFloat(g.totalRevenue.toFixed(2)),
      totalFees: parseFloat(g.totalFees.toFixed(2)),
      totalShipping: parseFloat(g.totalShipping.toFixed(2)),
      totalCogs: parseFloat(g.totalCogs.toFixed(2)),
      margin: parseFloat(g.margin.toFixed(2)),
      roas,
      cpa
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

function getGranularityGroupKey(dateStr, granularity) {
  if (granularity === 'yearly') {
    return dateStr.substring(0, 4); // YYYY
  }
  if (granularity === 'monthly') {
    return dateStr.substring(0, 7); // YYYY-MM
  }
  if (granularity === 'weekly') {
    const d = new Date(dateStr);
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    const weekNr = 1 + Math.round((firstThursday - target.valueOf()) / 604800000);
    const year = target.getFullYear();
    const padWeek = weekNr < 10 ? `0${weekNr}` : weekNr;
    return `${year}-W${padWeek}`;
  }
  return dateStr;
}
