import { initDb, getDb } from './db.js';
import { syncAndGetSalesData } from './services/syncService.js';

async function run() {
  await initDb();
  const db = getDb();
  console.log("1. Purge des dépenses mock Google Ads et Amazon Ads dans SQLite...");
  await db.run("DELETE FROM ad_spends WHERE source = 'google' OR source = 'amazon'");
  
  console.log("2. Synchronisation en direct des ventes Shopify (8 141+ commandes), réductions réelles, retours et Meta Ads (FB)...");
  const data = await syncAndGetSalesData('2024-08-01', '2026-08-05', true, 'monthly');

  console.log(`3. Synchronisation terminée avec succès ! (${data.length} mois calculés)`);
  const sample = data.find(d => d.date === '2026-07');
  console.log("Extrait 07/2026 :", JSON.stringify(sample, null, 2));
  process.exit(0);
}

run().catch(err => {
  console.error("Erreur lors de la ré-synchronisation :", err);
  process.exit(1);
});
