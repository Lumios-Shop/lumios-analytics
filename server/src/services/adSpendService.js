import { initDb } from '../db.js';

/**
 * Service pour gérer les dépenses publicitaires (Facebook Ads, Google Ads, Amazon Ads).
 */

export async function getAdSpends(startDate, endDate) {
  const db = await initDb();
  const rows = await db.all(
    `SELECT date, source, spend, COALESCE(orders, 0.0) as orders, COALESCE(units_sold, 0.0) as units_sold, COALESCE(conversion_value, 0.0) as conversion_value FROM ad_spends WHERE date BETWEEN ? AND ? ORDER BY date ASC`,
    [startDate, endDate]
  );
  return rows;
}

export async function saveAdSpend(date, source, spend, orders = null, unitsSold = null, conversionValue = null) {
  const db = await initDb();
  await db.run(
    `INSERT INTO ad_spends (date, source, spend, orders, units_sold, conversion_value)
     VALUES (?, ?, ?, COALESCE(?, 0.0), COALESCE(?, 0.0), COALESCE(?, 0.0))
     ON CONFLICT(date, source) DO UPDATE SET
       spend = excluded.spend,
       orders = COALESCE(?, ad_spends.orders),
       units_sold = COALESCE(?, ad_spends.units_sold),
       conversion_value = COALESCE(?, ad_spends.conversion_value)`,
    [
      date, source, parseFloat(spend) || 0.0,
      orders, unitsSold, conversionValue,
      orders, unitsSold, conversionValue
    ]
  );
}

export async function saveBatchAdSpends(spendsArray) {
  const db = await initDb();
  const stmt = await db.prepare(
    `INSERT INTO ad_spends (date, source, spend, orders, units_sold, conversion_value)
     VALUES (?, ?, ?, COALESCE(?, 0.0), COALESCE(?, 0.0), COALESCE(?, 0.0))
     ON CONFLICT(date, source) DO UPDATE SET
       spend = excluded.spend,
       orders = COALESCE(?, ad_spends.orders),
       units_sold = COALESCE(?, ad_spends.units_sold),
       conversion_value = COALESCE(?, ad_spends.conversion_value)`
  );

  for (const item of spendsArray) {
    if (item.date && item.source) {
      const ordersVal = item.orders !== undefined ? parseFloat(item.orders) : null;
      const unitsVal = item.unitsSold !== undefined ? parseFloat(item.unitsSold) : null;
      const convVal = item.conversionValue !== undefined ? parseFloat(item.conversionValue) : null;
      await stmt.run(
        item.date,
        item.source,
        parseFloat(item.spend) || 0.0,
        ordersVal,
        unitsVal,
        convVal,
        ordersVal,
        unitsVal,
        convVal
      );
    }
  }
  await stmt.finalize();
}
