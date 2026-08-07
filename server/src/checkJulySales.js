import { initDb, getDb } from './db.js';
import { syncAndGetSalesData } from './services/syncService.js';

async function check() {
  await initDb();
  const db = getDb();
  
  const rows = await db.all(
    `SELECT source, SUM(revenue) as rev, SUM(discounts) as disc, SUM(returns) as ret FROM daily_sku_sales WHERE date LIKE '2026-07%' GROUP BY source`
  );

  console.log("SQLITE JULY 2026 STORED SUMS BY SOURCE:");
  console.log(JSON.stringify(rows, null, 2));

  console.log("\nRE-TESTING VIA syncAndGetSalesData('2024-08-01', '2026-08-05', false, 'monthly'):");
  const monthlyData = await syncAndGetSalesData('2024-08-01', '2026-08-05', false, 'monthly');
  const julyRow = monthlyData.find(d => d.date === '2026-07');
  console.log("JULY 2026 ROW:", JSON.stringify(julyRow, null, 2));

  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
