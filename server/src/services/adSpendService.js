import { initDb } from '../db.js';

/**
 * Service pour gérer les dépenses publicitaires (Facebook Ads, Google Ads, Amazon Ads).
 */

export async function getAdSpends(startDate, endDate) {
  const db = await initDb();
  const rows = await db.all(
    `SELECT date, source, spend FROM ad_spends WHERE date BETWEEN ? AND ? ORDER BY date ASC`,
    [startDate, endDate]
  );
  return rows;
}

export async function saveAdSpend(date, source, spend) {
  const db = await initDb();
  await db.run(
    `INSERT OR REPLACE INTO ad_spends (date, source, spend) VALUES (?, ?, ?)`,
    [date, source, parseFloat(spend) || 0.0]
  );
}

export async function saveBatchAdSpends(spendsArray) {
  const db = await initDb();
  const stmt = await db.prepare(
    `INSERT OR REPLACE INTO ad_spends (date, source, spend) VALUES (?, ?, ?)`
  );

  for (const item of spendsArray) {
    if (item.date && item.source) {
      await stmt.run(item.date, item.source, parseFloat(item.spend) || 0.0);
    }
  }
}
