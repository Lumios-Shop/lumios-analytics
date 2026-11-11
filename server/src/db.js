import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../../database.sqlite');

let db = null;

export async function initDb() {
  if (db) return db;

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Activer les clés étrangères
  await db.get('PRAGMA foreign_keys = ON');

  // Création des tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS daily_sku_sales (
      date TEXT,
      sku TEXT,
      source TEXT,
      sales_count INTEGER DEFAULT 0,
      revenue REAL DEFAULT 0.0,
      fees REAL DEFAULT 0.0,
      PRIMARY KEY (date, sku, source)
    );

    CREATE TABLE IF NOT EXISTS product_costs (
      sku TEXT,
      name TEXT,
      source TEXT,
      cogs REAL DEFAULT 0.0,
      fees_override_percent REAL DEFAULT NULL,
      PRIMARY KEY (sku, source)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS payment_method_fees (
      code TEXT PRIMARY KEY,
      name TEXT,
      percent_fee REAL DEFAULT 0.0,
      fixed_fee REAL DEFAULT 0.0
    );

    CREATE TABLE IF NOT EXISTS shipping_method_costs (
      code TEXT PRIMARY KEY,
      name TEXT,
      cost_per_order REAL DEFAULT 0.0
    );

    CREATE TABLE IF NOT EXISTS orders_cache (
      order_id TEXT PRIMARY KEY,
      order_number TEXT,
      source TEXT,
      date TEXT,
      created_at TEXT,
      total_price REAL,
      items_count INTEGER,
      items_summary TEXT,
      items_json TEXT,
      payment_method TEXT,
      shipping_method TEXT,
      status TEXT
    );

    CREATE TABLE IF NOT EXISTS ad_spends (
      date TEXT,
      source TEXT,
      spend REAL DEFAULT 0.0,
      orders REAL DEFAULT 0.0,
      units_sold REAL DEFAULT 0.0,
      conversion_value REAL DEFAULT 0.0,
      PRIMARY KEY (date, source)
    );
  `);

  // Migration pour ajouter les colonnes d'attribution (commandes, unités vendues, valeur) dans ad_spends
  try {
    const adSpendsInfo = await db.all("PRAGMA table_info(ad_spends)");
    const adCols = adSpendsInfo.map(c => c.name);
    if (adSpendsInfo.length > 0) {
      if (!adCols.includes('orders')) await db.exec(`ALTER TABLE ad_spends ADD COLUMN orders REAL DEFAULT 0.0`);
      if (!adCols.includes('units_sold')) await db.exec(`ALTER TABLE ad_spends ADD COLUMN units_sold REAL DEFAULT 0.0`);
      if (!adCols.includes('conversion_value')) await db.exec(`ALTER TABLE ad_spends ADD COLUMN conversion_value REAL DEFAULT 0.0`);
    }
  } catch (err) {
    console.error("Erreur lors de l'ajout des colonnes d'attribution dans ad_spends :", err);
  }

  // Migration pour ajouter les colonnes d'analyse approfondie dans daily_sku_sales
  try {
    const skuSalesInfo = await db.all("PRAGMA table_info(daily_sku_sales)");
    const cols = skuSalesInfo.map(c => c.name);
    
    if (skuSalesInfo.length > 0) {
      if (!cols.includes('shipping_cost')) await db.exec(`ALTER TABLE daily_sku_sales ADD COLUMN shipping_cost REAL DEFAULT 0.0`);
      if (!cols.includes('order_count')) await db.exec(`ALTER TABLE daily_sku_sales ADD COLUMN order_count INTEGER DEFAULT 0`);
      if (!cols.includes('discounts')) await db.exec(`ALTER TABLE daily_sku_sales ADD COLUMN discounts REAL DEFAULT 0.0`);
      if (!cols.includes('returns')) await db.exec(`ALTER TABLE daily_sku_sales ADD COLUMN returns REAL DEFAULT 0.0`);
      if (!cols.includes('cb_orders')) await db.exec(`ALTER TABLE daily_sku_sales ADD COLUMN cb_orders INTEGER DEFAULT 0`);
      if (!cols.includes('paypal_orders')) await db.exec(`ALTER TABLE daily_sku_sales ADD COLUMN paypal_orders INTEGER DEFAULT 0`);
      if (!cols.includes('domicile_orders')) await db.exec(`ALTER TABLE daily_sku_sales ADD COLUMN domicile_orders INTEGER DEFAULT 0`);
      if (!cols.includes('relais_orders')) await db.exec(`ALTER TABLE daily_sku_sales ADD COLUMN relais_orders INTEGER DEFAULT 0`);
      if (!cols.includes('cb_revenue')) await db.exec(`ALTER TABLE daily_sku_sales ADD COLUMN cb_revenue REAL DEFAULT 0.0`);
      if (!cols.includes('paypal_revenue')) await db.exec(`ALTER TABLE daily_sku_sales ADD COLUMN paypal_revenue REAL DEFAULT 0.0`);
      if (!cols.includes('domicile_revenue')) await db.exec(`ALTER TABLE daily_sku_sales ADD COLUMN domicile_revenue REAL DEFAULT 0.0`);
      if (!cols.includes('relais_revenue')) await db.exec(`ALTER TABLE daily_sku_sales ADD COLUMN relais_revenue REAL DEFAULT 0.0`);
      if (!cols.includes('payment_breakdown_json')) await db.exec(`ALTER TABLE daily_sku_sales ADD COLUMN payment_breakdown_json TEXT DEFAULT NULL`);
      if (!cols.includes('shipping_breakdown_json')) await db.exec(`ALTER TABLE daily_sku_sales ADD COLUMN shipping_breakdown_json TEXT DEFAULT NULL`);
    }
  } catch (err) {
    console.error("Erreur lors de l'ajout des colonnes dans daily_sku_sales :", err);
  }

  // Migration de la table product_costs si nécessaire (de sku PRIMARY KEY à PRIMARY KEY(sku, source))
  try {
    const tableInfo = await db.all("PRAGMA table_info(product_costs)");
    if (tableInfo.length > 0) {
      const pkColumns = tableInfo.filter(col => col.pk > 0);
      if (pkColumns.length === 1 && pkColumns[0].name === 'sku') {
        console.log("Migration de la table product_costs vers une clé primaire composite (sku, source)...");
        await db.exec(`
          BEGIN TRANSACTION;
          ALTER TABLE product_costs RENAME TO old_product_costs;
          CREATE TABLE product_costs (
            sku TEXT,
            name TEXT,
            source TEXT,
            cogs REAL DEFAULT 0.0,
            fees_override_percent REAL DEFAULT NULL,
            PRIMARY KEY (sku, source)
          );
          INSERT INTO product_costs (sku, name, source, cogs, fees_override_percent)
          SELECT sku, name, source, cogs, fees_override_percent FROM old_product_costs;
          DROP TABLE old_product_costs;
          COMMIT;
        `);
        console.log("Migration de product_costs terminée avec succès.");
      }
    }
  } catch (migErr) {
    console.error("Erreur lors de la migration de la table product_costs :", migErr);
  }

  // Insertion de paramètres par défaut si non existants
  await db.run(
    `INSERT OR IGNORE INTO settings (key, value) VALUES ('default_amazon_fee_percent', '15.0')`
  );
  await db.run(
    `INSERT OR IGNORE INTO settings (key, value) VALUES ('default_shopify_fee_percent', '2.0')`
  );
  await db.run(
    `INSERT OR IGNORE INTO payment_method_fees (code, name, percent_fee, fixed_fee) VALUES ('cb', 'Carte Bancaire / Stripe / Shopify Payments', 1.4, 0.25)`
  );
  await db.run(
    `INSERT OR IGNORE INTO payment_method_fees (code, name, percent_fee, fixed_fee) VALUES ('paypal', 'PayPal', 2.9, 0.35)`
  );
  await db.run(
    `INSERT OR IGNORE INTO shipping_method_costs (code, name, cost_per_order) VALUES ('domicile', 'Livraison à Domicile (Colissimo / Chronopost)', 5.50)`
  );
  await db.run(
    `INSERT OR IGNORE INTO shipping_method_costs (code, name, cost_per_order) VALUES ('relais', 'Livraison en Point Relais (Mondial Relay / Relais Colis)', 3.50)`
  );

  // Table pour l'historique des rapports mensuels PDF Amazon Seller Central
  await db.exec(`
    CREATE TABLE IF NOT EXISTS amazon_monthly_reports (
      period_key TEXT PRIMARY KEY,
      period_label TEXT,
      date_range TEXT,
      revenues_total REAL DEFAULT 0.0,
      product_sales REAL DEFAULT 0.0,
      product_refunds REAL DEFAULT 0.0,
      fba_inventory_credit REAL DEFAULT 0.0,
      shipping_credits REAL DEFAULT 0.0,
      promo_rebates REAL DEFAULT 0.0,
      expenses_total REAL DEFAULT 0.0,
      selling_fees REAL DEFAULT 0.0,
      fba_transaction_fees REAL DEFAULT 0.0,
      storage_fees REAL DEFAULT 0.0,
      ad_spend REAL DEFAULT 0.0,
      service_fees REAL DEFAULT 0.0,
      other_fees REAL DEFAULT 0.0,
      taxes_total REAL DEFAULT 0.0,
      taxes_collected REAL DEFAULT 0.0,
      taxes_refunded REAL DEFAULT 0.0,
      transfers_total REAL DEFAULT 0.0,
      raw_json TEXT DEFAULT NULL,
      uploaded_at TEXT
    );
  `);

  // Pré-remplir avec les 2 rapports fournis (Septembre 2026 & Octobre 2026) s'ils n'existent pas encore
  await db.run(`
    INSERT OR IGNORE INTO amazon_monthly_reports (
      period_key, period_label, date_range,
      revenues_total, product_sales, product_refunds, fba_inventory_credit, shipping_credits, promo_rebates,
      expenses_total, selling_fees, fba_transaction_fees, storage_fees, ad_spend, service_fees, other_fees,
      taxes_total, taxes_collected, taxes_refunded, transfers_total, uploaded_at
    ) VALUES (
      '2026-09', 'Septembre 2026', 'Sep 1, 2026 - Sep 30, 2026',
      14542.78, 15231.85, -433.29, 78.45, 241.83, -576.06,
      -5570.00, -1249.04, -3317.80, -75.66, -737.59, -46.80, -143.11,
      2873.66, 2964.57, -90.91, 12092.50, '2026-11-11T21:45:00Z'
    )
  `);

  await db.run(`
    INSERT OR IGNORE INTO amazon_monthly_reports (
      period_key, period_label, date_range,
      revenues_total, product_sales, product_refunds, fba_inventory_credit, shipping_credits, promo_rebates,
      expenses_total, selling_fees, fba_transaction_fees, storage_fees, ad_spend, service_fees, other_fees,
      taxes_total, taxes_collected, taxes_refunded, transfers_total, uploaded_at
    ) VALUES (
      '2026-10', 'Octobre 2026', 'Oct 1, 2026 - Oct 31, 2026',
      9291.15, 9365.36, -199.98, 97.40, 108.57, -80.20,
      -4723.63, -14.40, -2049.21, -204.38, -2345.37, -46.80, -63.47,
      1833.79, 1876.51, -42.72, 7261.44, '2026-11-11T21:45:00Z'
    )
  `);

  // Table pour les transactions individuelles issues du CSV mensuel Amazon Seller Central
  await db.exec(`
    CREATE TABLE IF NOT EXISTS amazon_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      period_key TEXT,
      tx_date TEXT,
      tx_datetime TEXT,
      tx_type TEXT,
      order_id TEXT,
      sku TEXT,
      description TEXT,
      quantity INTEGER DEFAULT 0,
      product_sales_ht REAL DEFAULT 0.0,
      product_taxes REAL DEFAULT 0.0,
      shipping_credits REAL DEFAULT 0.0,
      promo_rebates REAL DEFAULT 0.0,
      selling_fees REAL DEFAULT 0.0,
      fba_fees REAL DEFAULT 0.0,
      other_fees REAL DEFAULT 0.0,
      other_amount REAL DEFAULT 0.0,
      total_payout REAL DEFAULT 0.0,
      status TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_amz_tx_period ON amazon_transactions(period_key);
    CREATE INDEX IF NOT EXISTS idx_amz_tx_order ON amazon_transactions(order_id);
  `);

  return db;
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}
