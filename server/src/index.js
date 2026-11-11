import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import crypto from 'crypto';
import { initDb, getDb } from './db.js';
import { syncAndGetSalesData } from './services/syncService.js';
import {
  parseAmazonSummaryPdf,
  getAllAmazonMonthlyReports,
  saveAmazonMonthlyReport,
  deleteAmazonMonthlyReport,
  importAmazonTransactionsCsv,
  getAmazonReconciliation,
  applyAmazonCsvCostsToDashboard
} from './services/amazonReportService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Clé secrète de signature cryptographique HMAC pour les sessions administrateur
const JWT_SECRET = process.env.JWT_SECRET || (process.env.ADMIN_PASSWORD ? `${process.env.ADMIN_PASSWORD}_lumios_sec_key_2026` : 'lumios_secure_secret_token_key');

function generateToken(email) {
  const payload = JSON.stringify({ email, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }); // Valide 30 jours
  const hmac = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}.${hmac}`).toString('base64url');
}

function verifyToken(tokenStr) {
  try {
    if (!tokenStr) return null;
    const decoded = Buffer.from(tokenStr, 'base64url').toString('utf8');
    const dotIdx = decoded.lastIndexOf('.');
    if (dotIdx === -1) return null;
    const payloadStr = decoded.substring(0, dotIdx);
    const hmac = decoded.substring(dotIdx + 1);
    const expectedHmac = crypto.createHmac('sha256', JWT_SECRET).update(payloadStr).digest('hex');
    if (hmac !== expectedHmac) return null;
    const data = JSON.parse(payloadStr);
    if (Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Middleware de sécurité : Bloque tout accès non authentifié
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Accès non autorisé. Jeton d\'authentification manquant.' });
  }

  const token = authHeader.substring(7).trim();
  const valid = verifyToken(token);
  if (!valid) {
    return res.status(401).json({ error: 'Session expirée ou invalide. Veuillez vous reconnecter.' });
  }

  req.user = valid;
  next();
}

app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Initialiser la base de données
try {
  await initDb();
  console.log('Base de données SQLite connectée et initialisée.');
} catch (error) {
  console.error('Erreur lors de l\'initialisation de la base de données :', error);
  process.exit(1);
}

/**
 * Endpoint : Authentification Administrateur (davhuin@gmail.com)
 * POST /api/auth/login
 */
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL || 'davhuin@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(500).json({ error: 'Mot de passe administrateur non configuré dans .env.' });
  }

  if (email && email.toLowerCase().trim() === adminEmail.toLowerCase() && password === adminPassword) {
    const token = generateToken(adminEmail);
    return res.json({ success: true, token, user: { email: adminEmail } });
  }

  return res.status(401).json({ error: 'Identifiants incorrects. Accès réservé à l\'administrateur.' });
});

/**
 * Endpoint : Récupérer les ventes et marges quotidiennes agrégées
 * GET /api/sales?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&force=true
 */
app.get('/api/sales', requireAuth, async (req, res) => {
  const { startDate, endDate, force, granularity } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Les paramètres startDate et endDate sont requis (format YYYY-MM-DD).' });
  }

  try {
    const forceRefresh = force === 'true';
    const data = await syncAndGetSalesData(startDate, endDate, forceRefresh, granularity || 'daily');
    res.json(data);
  } catch (error) {
    console.error('Erreur lors du traitement de /api/sales :', error);
    res.status(500).json({ error: 'Une erreur interne est survenue.' });
  }
});

/**
 * Endpoint : Récupérer le détail de chaque commande et de ses produits vendus
 * GET /api/orders?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&source=shopify|amazon|all
 */
app.get('/api/orders', requireAuth, async (req, res) => {
  const { startDate, endDate, source } = req.query;

  try {
    const db = getDb();
    let query = `SELECT * FROM orders_cache`;
    const params = [];

    if (startDate && endDate) {
      query += ` WHERE date BETWEEN ? AND ?`;
      params.push(startDate, endDate);
      if (source && source !== 'all') {
        query += ` AND source = ?`;
        params.push(source);
      }
    } else if (source && source !== 'all') {
      query += ` WHERE source = ?`;
      params.push(source);
    }

    query += ` ORDER BY date DESC, created_at DESC LIMIT 500`;

    const rows = await db.all(query, params);
    const parsedOrders = rows.map(r => ({
      ...r,
      items: r.items_json ? JSON.parse(r.items_json) : []
    }));

    res.json(parsedOrders);
  } catch (error) {
    console.error('Erreur lors de la récupération des commandes détaillées :', error);
    res.status(500).json({ error: 'Impossible de récupérer le détail des commandes.' });
  }
});

/**
 * Endpoints : Configuration du Google Sheet pour la synchronisation Google Ads
 * GET & POST /api/config/google-ads-sheet
 */
app.get('/api/config/google-ads-sheet', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const row = await db.get(`SELECT value FROM settings WHERE key = 'google_ads_sheet_url'`);
    res.json({ sheetUrl: row ? row.value : '' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/config/google-ads-sheet', requireAuth, async (req, res) => {
  const { sheetUrl } = req.body;
  try {
    const db = getDb();
    await db.run(
      `INSERT OR REPLACE INTO settings (key, value) VALUES ('google_ads_sheet_url', ?)`,
      [sheetUrl ? sheetUrl.trim() : '']
    );

    let testCount = 0;
    if (sheetUrl && sheetUrl.trim()) {
      const { getGoogleAdsSpendFromSheet } = await import('./services/googleAdsService.js');
      const testData = await getGoogleAdsSpendFromSheet(sheetUrl.trim(), null, null);
      testCount = testData.length;
      if (testCount > 0) {
        const { saveBatchAdSpends } = await import('./services/adSpendService.js');
        await saveBatchAdSpends(testData);
      }
    }

    res.json({ success: true, message: 'Google Sheet configuré avec succès.', rowsImported: testCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/config/import-amazon-ads-csv
 * Importe un rapport CSV brut téléchargé depuis Amazon Ads
 */
app.post('/api/config/import-amazon-ads-csv', requireAuth, async (req, res) => {
  const { csvText } = req.body;
  if (!csvText) {
    return res.status(400).json({ error: 'Contenu CSV requis.' });
  }

  try {
    const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length <= 1) {
      return res.status(400).json({ error: 'Le fichier CSV est vide.' });
    }

    const headerParts = lines[0].toLowerCase().split(/[,;\t]/).map(h => h.replace(/^"|"$/g, '').trim());
    let dateIdx = headerParts.findIndex(h => h.includes('date') || h.includes('jour'));
    let spendIdx = headerParts.findIndex(h => h.includes('dépense') || h.includes('spend') || h.includes('coût') || h.includes('cost'));

    if (dateIdx === -1) dateIdx = 0;
    if (spendIdx === -1) spendIdx = headerParts.length > 1 ? 1 : -1;

    if (spendIdx === -1) {
      return res.status(400).json({ error: 'Colonne de dépenses (Coût / Dépenses / Spend) introuvable dans le CSV.' });
    }

    const spendByDate = {};

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(/[,;\t]/).map(p => p.replace(/^"|"$/g, '').trim());
      if (parts.length > Math.max(dateIdx, spendIdx)) {
        let dateStr = parts[dateIdx];
        if (dateStr.includes('/')) {
          const dp = dateStr.split('/');
          if (dp.length === 3) dateStr = `${dp[2]}-${dp[1].padStart(2, '0')}-${dp[0].padStart(2, '0')}`;
        }
        const costClean = parts[spendIdx].replace(/[^0-9.,-]/g, '').replace(',', '.');
        const spend = parseFloat(costClean);

        if (dateStr && !isNaN(spend) && spend > 0) {
          spendByDate[dateStr] = (spendByDate[dateStr] || 0) + spend;
        }
      }
    }

    const batch = Object.entries(spendByDate).map(([date, spend]) => ({
      date,
      source: 'amazon',
      spend: Math.round(spend * 100) / 100
    }));

    if (batch.length > 0) {
      const { saveBatchAdSpends } = await import('./services/adSpendService.js');
      await saveBatchAdSpends(batch);
    }

    res.json({
      success: true,
      importedDays: batch.length,
      message: `${batch.length} jours de dépenses Amazon Ads importés avec succès !`
    });
  } catch (error) {
    console.error('Erreur import CSV Amazon Ads :', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Endpoint : Récupérer la configuration des coûts (COGS)
 * GET /api/config
 */
app.get('/api/config', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const productCosts = await db.all('SELECT * FROM product_costs ORDER BY source, sku');
    res.json(productCosts);
  } catch (error) {
    console.error('Erreur lors de la récupération des coûts :', error);
    res.status(500).json({ error: 'Impossible de charger la configuration.' });
  }
});

/**
 * Endpoint : Ajouter ou mettre à jour un coût produit (COGS)
 * POST /api/config
 */
app.post('/api/config', requireAuth, async (req, res) => {
  const { sku, name, source, cogs, fees_override_percent } = req.body;

  if (!sku || !source) {
    return res.status(400).json({ error: 'Les champs sku et source sont requis.' });
  }

  const parsedCogs = parseFloat(cogs);
  if (isNaN(parsedCogs) || parsedCogs < 0) {
    return res.status(400).json({ error: 'Le COGS doit être un nombre positif ou nul.' });
  }

  const parsedFeesOverride = fees_override_percent !== undefined && fees_override_percent !== null 
    ? parseFloat(fees_override_percent) 
    : null;

  try {
    const db = getDb();
    await db.run(
      `INSERT OR REPLACE INTO product_costs (sku, name, source, cogs, fees_override_percent)
       VALUES (?, ?, ?, ?, ?)`,
      [sku, name || sku, source, parsedCogs, parsedFeesOverride]
    );

    // Mettre à jour également les frais ou recalculer les marges si nécessaire
    // SQLite recalculera dynamiquement lors du prochain SELECT, donc c'est automatique !
    res.json({ success: true, message: 'Coût produit mis à jour avec succès.' });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du coût produit :', error);
    res.status(500).json({ error: 'Impossible d\'enregistrer la configuration.' });
  }
});

/**
 * Endpoint : Supprimer un coût produit de la configuration
 * DELETE /api/config/:sku?source=shopify|amazon
 */
app.delete('/api/config/:sku', requireAuth, async (req, res) => {
  const { sku } = req.params;
  const { source } = req.query;

  if (!sku || !source) {
    return res.status(400).json({ error: 'Les paramètres sku (dans l\'URL) et source (query param) sont requis.' });
  }

  try {
    const db = getDb();
    await db.run('DELETE FROM product_costs WHERE sku = ? AND source = ?', [sku, source]);
    res.json({ success: true, message: 'Coût produit supprimé de la configuration.' });
  } catch (error) {
    console.error('Erreur lors de la suppression du coût produit :', error);
    res.status(500).json({ error: 'Impossible de supprimer la configuration.' });
  }
});

/**
 * Endpoints : Récupérer et mettre à jour les frais de transaction (CB vs PayPal)
 */
app.get('/api/config/payment-fees', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const fees = await db.all('SELECT * FROM payment_method_fees');
    res.json(fees);
  } catch (error) {
    res.status(500).json({ error: 'Impossible de charger les frais de paiement.' });
  }
});

app.post('/api/config/payment-fees', requireAuth, async (req, res) => {
  const { code, name, percent_fee, fixed_fee } = req.body;
  try {
    const db = getDb();
    await db.run(
      `INSERT OR REPLACE INTO payment_method_fees (code, name, percent_fee, fixed_fee) VALUES (?, ?, ?, ?)`,
      [code, name, parseFloat(percent_fee || 0), parseFloat(fixed_fee || 0)]
    );
    res.json({ success: true, message: 'Frais de paiement mis à jour.' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour des frais de paiement.' });
  }
});

/**
 * Endpoints : Récupérer et mettre à jour les coûts d'expédition (Domicile vs Relais)
 */
app.get('/api/config/shipping-costs', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const costs = await db.all('SELECT * FROM shipping_method_costs');
    res.json(costs);
  } catch (error) {
    res.status(500).json({ error: 'Impossible de charger les coûts d\'expédition.' });
  }
});

app.post('/api/config/shipping-costs', requireAuth, async (req, res) => {
  const { code, name, cost_per_order } = req.body;
  try {
    const db = getDb();
    await db.run(
      `INSERT OR REPLACE INTO shipping_method_costs (code, name, cost_per_order) VALUES (?, ?, ?)`,
      [code, name, parseFloat(cost_per_order || 0)]
    );
    res.json({ success: true, message: 'Coûts d\'expédition mis à jour.' });
  } catch (error) {
    res.status(500).json({ error: 'Erreur lors de la mise à jour des coûts d\'expédition.' });
  }
});

/**
 * Endpoint : Obtenir ou enregistrer les dépenses publicitaires (Ads)
 * GET /api/config/ad-spends?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * POST /api/config/ad-spends
 */
app.get('/api/config/ad-spends', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const db = getDb();
    const rows = await db.all(
      `SELECT date, source, spend FROM ad_spends WHERE date BETWEEN ? AND ? ORDER BY date ASC`,
      [startDate || '2024-01-01', endDate || '2030-12-31']
    );
    res.json(rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des dépenses Ads :', error);
    res.status(500).json({ error: 'Impossible de charger les dépenses Ads.' });
  }
});

app.post('/api/config/ad-spends', requireAuth, async (req, res) => {
  const { date, source, spend, batch } = req.body;

  try {
    const db = getDb();
    if (batch && Array.isArray(batch)) {
      const stmt = await db.prepare(`INSERT OR REPLACE INTO ad_spends (date, source, spend) VALUES (?, ?, ?)`);
      for (const item of batch) {
        if (item.date && item.source) {
          await stmt.run(item.date, item.source, parseFloat(item.spend) || 0.0);
        }
      }
      await stmt.finalize();
    } else if (date && source) {
      await db.run(
        `INSERT OR REPLACE INTO ad_spends (date, source, spend) VALUES (?, ?, ?)`,
        [date, source, parseFloat(spend) || 0.0]
      );
    } else {
      return res.status(400).json({ error: 'Renseignez date et source ou un tableau batch.' });
    }
    res.json({ success: true, message: 'Dépenses Ads enregistrées.' });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement des dépenses Ads :', error);
    res.status(500).json({ error: 'Impossible d\'enregistrer les dépenses Ads.' });
  }
});

/**
 * Endpoint : Obtenir la synthèse des proportions de paiement et de livraison
 * GET /api/analytics/proportions?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
app.get('/api/analytics/proportions', requireAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const db = getDb();
    
    const row = await db.get(`
      SELECT 
        SUM(COALESCE(cb_orders, 0)) as cbOrders,
        SUM(COALESCE(paypal_orders, 0)) as paypalOrders,
        SUM(COALESCE(domicile_orders, 0)) as domicileOrders,
        SUM(COALESCE(relais_orders, 0)) as relaisOrders,
        SUM(COALESCE(cb_revenue, 0.0)) as cbRevenue,
        SUM(COALESCE(paypal_revenue, 0.0)) as paypalRevenue,
        SUM(COALESCE(domicile_revenue, 0.0)) as domicileRevenue,
        SUM(COALESCE(relais_revenue, 0.0)) as relaisRevenue
      FROM daily_sku_sales
      WHERE source = 'shopify' AND date BETWEEN ? AND ?
    `, [startDate || '2024-01-01', endDate || '2030-12-31']);

    const totalPaymentOrders = (row.cbOrders || 0) + (row.paypalOrders || 0) || 1;
    const totalPaymentRevenue = (row.cbRevenue || 0) + (row.paypalRevenue || 0) || 1;
    
    const totalShippingOrders = (row.domicileOrders || 0) + (row.relaisOrders || 0) || 1;
    const totalShippingRevenue = (row.domicileRevenue || 0) + (row.relaisRevenue || 0) || 1;

    res.json({
      payments: {
        cb: {
          orders: row.cbOrders || 0,
          revenue: parseFloat((row.cbRevenue || 0).toFixed(2)),
          ordersPercent: parseFloat(((row.cbOrders / totalPaymentOrders) * 100).toFixed(1)),
          revenuePercent: parseFloat(((row.cbRevenue / totalPaymentRevenue) * 100).toFixed(1))
        },
        paypal: {
          orders: row.paypalOrders || 0,
          revenue: parseFloat((row.paypalRevenue || 0).toFixed(2)),
          ordersPercent: parseFloat(((row.paypalOrders / totalPaymentOrders) * 100).toFixed(1)),
          revenuePercent: parseFloat(((row.paypalRevenue / totalPaymentRevenue) * 100).toFixed(1))
        }
      },
      shipping: {
        domicile: {
          orders: row.domicileOrders || 0,
          revenue: parseFloat((row.domicileRevenue || 0).toFixed(2)),
          ordersPercent: parseFloat(((row.domicileOrders / totalShippingOrders) * 100).toFixed(1)),
          revenuePercent: parseFloat(((row.domicileRevenue / totalShippingRevenue) * 100).toFixed(1))
        },
        relais: {
          orders: row.relaisOrders || 0,
          revenue: parseFloat((row.relaisRevenue || 0).toFixed(2)),
          ordersPercent: parseFloat(((row.relaisOrders / totalShippingOrders) * 100).toFixed(1)),
          revenuePercent: parseFloat(((row.relaisRevenue / totalShippingRevenue) * 100).toFixed(1))
        }
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des proportions :', error);
    res.status(500).json({ error: 'Impossible de calculer les proportions.' });
  }
});

/**
 * Helper Endpoints : Google Ads OAuth 2.0 Flow pour générer facilement le GOOGLE_ADS_REFRESH_TOKEN
 * GET /api/auth/google/login
 * GET /api/auth/google/callback
 */
app.get('/api/auth/google/login', (req, res) => {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  if (!clientId) {
    return res.status(400).send("Veuillez renseigner GOOGLE_ADS_CLIENT_ID dans server/.env d'abord.");
  }
  const redirectUri = `http://localhost:${PORT}/api/auth/google/callback`;
  const scope = 'https://www.googleapis.com/auth/adwords';
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
  res.redirect(authUrl);
});

app.get('/api/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const redirectUri = `http://localhost:${PORT}/api/auth/google/callback`;

  if (!code) {
    return res.status(400).send("Code d'autorisation Google manquant.");
  }

  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: String(code),
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const refreshToken = response.data.refresh_token;
    console.log("==================================================");
    console.log(`GOOGLE ADS REFRESH TOKEN GÉNÉRÉ : ${refreshToken}`);
    console.log("==================================================");

    res.send(`
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 60px 20px; background: #0f172a; color: #f8fafc; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box;">
        <div style="max-width: 500px; width: 100%; background: #1e293b; padding: 40px; border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); border: 1px solid #334155;">
          <div style="width: 60px; height: 60px; background: #4f46e5; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
            <svg style="width: 32px; height: 32px; color: white;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0 0 12px;">Google Ads Connecté ! 🎉</h2>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">Voici votre <strong>GOOGLE_ADS_REFRESH_TOKEN</strong> généré :</p>
          
          <div style="position: relative; margin-bottom: 24px;">
            <code style="display: block; width: 100%; padding: 16px; background: #0f172a; border-radius: 12px; font-size: 13px; border: 1px solid #475569; color: #818cf8; font-family: monospace; word-break: break-all; text-align: center; font-weight: bold; box-sizing: border-box; user-select: all;">${refreshToken}</code>
          </div>

          <p style="color: #94a3b8; font-size: 13px; line-height: 1.6; margin: 0;">
            Copiez ce jeton et collez-le dans <strong style="color: #ffffff;">server/.env</strong> à la ligne :<br>
            <code style="background: #0f172a; padding: 4px 8px; border-radius: 6px; font-size: 12px; display: inline-block; margin-top: 8px; border: 1px solid #334155; color: #f1f5f9;">GOOGLE_ADS_REFRESH_TOKEN=${refreshToken}</code>
          </p>
        </div>
      </div>
    `);
  } catch (error) {
    console.error("Erreur lors de l'échange OAuth Google Ads :", error.response?.data || error.message);
    res.status(500).send(`Erreur lors de la génération du token Google Ads : ${error.response?.data?.error_description || error.message}`);
  }
});

/**
 * Endpoints : Historique et import PDF des rapports mensuels Amazon Seller Central
 */
app.get('/api/amazon/reports', requireAuth, async (req, res) => {
  try {
    const reports = await getAllAmazonMonthlyReports();
    res.json(reports);
  } catch (error) {
    console.error('Erreur lors de la récupération des rapports Amazon :', error);
    res.status(500).json({ error: 'Impossible de charger les rapports Amazon.' });
  }
});

app.post('/api/amazon/reports/upload', requireAuth, async (req, res) => {
  const { pdfBase64 } = req.body;
  if (!pdfBase64) {
    return res.status(400).json({ error: 'Fichier PDF manquant.' });
  }

  try {
    const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const parsed = await parseAmazonSummaryPdf(buffer);
    const saved = await saveAmazonMonthlyReport(parsed);
    res.json({ success: true, report: saved });
  } catch (error) {
    console.error('Erreur lors du parsing PDF Amazon :', error);
    res.status(400).json({ error: error.message || 'Impossible de lire ce rapport PDF Amazon.' });
  }
});

app.delete('/api/amazon/reports/:periodKey', requireAuth, async (req, res) => {
  try {
    await deleteAmazonMonthlyReport(req.params.periodKey);
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la suppression du rapport Amazon :', error);
    res.status(500).json({ error: 'Impossible de supprimer ce rapport.' });
  }
});

/**
 * Endpoints : Import CSV Transactions Amazon & Rapprochement Dashboard
 */
app.post('/api/amazon/transactions/upload', requireAuth, async (req, res) => {
  const { csvText } = req.body;
  if (!csvText) {
    return res.status(400).json({ error: 'Contenu CSV manquant.' });
  }

  try {
    const result = await importAmazonTransactionsCsv(csvText);
    const reconciliation = await getAmazonReconciliation(result.periodKey);
    res.json({ success: true, ...result, reconciliation });
  } catch (error) {
    console.error('Erreur lors de l\'import CSV Amazon :', error);
    res.status(400).json({ error: error.message || 'Impossible de parser ce fichier CSV Amazon.' });
  }
});

app.get('/api/amazon/reconciliation/:periodKey', requireAuth, async (req, res) => {
  try {
    const reconciliation = await getAmazonReconciliation(req.params.periodKey);
    res.json(reconciliation);
  } catch (error) {
    console.error('Erreur lors du rapprochement Amazon :', error);
    res.status(500).json({ error: 'Impossible de calculer le rapprochement.' });
  }
});

app.post('/api/amazon/reconciliation/:periodKey/apply', requireAuth, async (req, res) => {
  try {
    const stats = await applyAmazonCsvCostsToDashboard(req.params.periodKey);
    res.json({ success: true, ...stats });
  } catch (error) {
    console.error('Erreur lors de l\'application des coûts réels CSV :', error);
    res.status(400).json({ error: error.message || 'Impossible d\'appliquer les coûts CSV.' });
  }
});

// Lancer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port http://localhost:${PORT}`);
});
