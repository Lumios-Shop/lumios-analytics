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

/**
 * Synchronise les données pour une période donnée et renvoie le récapitulatif agrégé.
 * @param {string} startDate - Format YYYY-MM-DD
 * @param {string} endDate - Format YYYY-MM-DD
 * @param {boolean} forceRefresh - Forcer la synchronisation avec les API
 */
export async function syncAndGetSalesData(startDate, endDate, forceRefresh = false, granularity = 'daily') {
  const db = getDb();
  
  const requestedDates = [];
  let current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    requestedDates.push(dateStr);
    current.setDate(current.getDate() + 1);
  }

  console.log(`Synchronisation en direct des API Shopify, Amazon, Meta Ads, Amazon Ads et Google Ads pour la période : ${startDate} au ${endDate}`);
  
  try {
    const [shopifyData, amazonData, metaAdsData, amazonAdsData, googleAdsData] = await Promise.all([
      getShopifySales(startDate, endDate),
      getAmazonSales(startDate, endDate),
      getMetaAdsSpend(startDate, endDate),
      getAmazonAdsSpend(startDate, endDate),
      getGoogleAdsSpend(startDate, endDate)
    ]);

    if (metaAdsData && metaAdsData.length > 0) {
      await saveBatchAdSpends(metaAdsData);
    }

    if (amazonAdsData && amazonAdsData.length > 0) {
      await saveBatchAdSpends(amazonAdsData);
    }

    if (googleAdsData && googleAdsData.length > 0) {
      await saveBatchAdSpends(googleAdsData);
    }

    // Supprimer les données obsolètes ou de simulation sur la période synchronisée
    await db.run(
      `DELETE FROM daily_sku_sales WHERE date BETWEEN ? AND ?`,
      [startDate, endDate]
    );

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

        // Traiter les données Shopify
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

        // Traiter les données Amazon
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

        await insertStmt.finalize();
        await insertCostStmt.finalize();

        await db.run(
          `INSERT OR REPLACE INTO settings (key, value) VALUES ('last_sync_today', ?)`,
          [Date.now().toString()]
        );
      } catch (err) {
        console.error("Erreur lors de la synchronisation avec les API :", err);
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
    `SELECT date, source, spend FROM ad_spends WHERE date BETWEEN ? AND ?`,
    [startDate, endDate]
  );

  const adSpendsByDate = {};
  adSpendRows.forEach(row => {
    if (!adSpendsByDate[row.date]) {
      adSpendsByDate[row.date] = { facebook: 0, google: 0, amazon: 0 };
    }
    if (row.source === 'facebook') adSpendsByDate[row.date].facebook += row.spend;
    if (row.source === 'google') adSpendsByDate[row.date].google += row.spend;
    if (row.source === 'amazon') adSpendsByDate[row.date].amazon += row.spend;
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

    const ads = adSpendsByDate[dateStr] || { facebook: 0, google: 0, amazon: 0 };
    const facebookAds = ads.facebook || 0.0;
    const googleAds = ads.google || 0.0;
    const amazonAds = ads.amazon || 0.0;
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
    const cpa = totalOrdersCount > 0 && totalAdsSpend > 0 ? parseFloat((totalAdsSpend / totalOrdersCount).toFixed(2)) : 0;

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
      googleAds: parseFloat(googleAds.toFixed(2)),
      amazonAds: parseFloat(amazonAds.toFixed(2)),
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
        googleAds: 0,
        amazonAds: 0,
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
    g.googleAds += item.googleAds;
    g.amazonAds += item.amazonAds;
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
    const cpa = g.totalOrdersCount > 0 && g.totalAdsSpend > 0 ? parseFloat((g.totalAdsSpend / g.totalOrdersCount).toFixed(2)) : 0;
    
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
      googleAds: parseFloat(g.googleAds.toFixed(2)),
      amazonAds: parseFloat(g.amazonAds.toFixed(2)),
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
