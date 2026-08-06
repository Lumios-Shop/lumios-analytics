import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { initDb, getDb } from './db.js';
import { syncAndGetSalesData } from './services/syncService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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
  const adminPassword = process.env.ADMIN_PASSWORD || 'Lumios2026!';

  if (email && email.toLowerCase().trim() === adminEmail.toLowerCase() && password === adminPassword) {
    const token = Buffer.from(`${adminEmail}:${Date.now()}`).toString('base64');
    return res.json({ success: true, token, user: { email: adminEmail } });
  }

  return res.status(401).json({ error: 'Identifiants incorrects. Accès réservé à l\'administrateur.' });
});

/**
 * Endpoint : Récupérer les ventes et marges quotidiennes agrégées
 * GET /api/sales?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&force=true
 */
app.get('/api/sales', async (req, res) => {
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
 * Endpoint : Récupérer la configuration des coûts (COGS)
 * GET /api/config
 */
app.get('/api/config', async (req, res) => {
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
app.post('/api/config', async (req, res) => {
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
app.delete('/api/config/:sku', async (req, res) => {
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
app.get('/api/config/payment-fees', async (req, res) => {
  try {
    const db = getDb();
    const fees = await db.all('SELECT * FROM payment_method_fees');
    res.json(fees);
  } catch (error) {
    res.status(500).json({ error: 'Impossible de charger les frais de paiement.' });
  }
});

app.post('/api/config/payment-fees', async (req, res) => {
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
app.get('/api/config/shipping-costs', async (req, res) => {
  try {
    const db = getDb();
    const costs = await db.all('SELECT * FROM shipping_method_costs');
    res.json(costs);
  } catch (error) {
    res.status(500).json({ error: 'Impossible de charger les coûts d\'expédition.' });
  }
});

app.post('/api/config/shipping-costs', async (req, res) => {
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
app.get('/api/config/ad-spends', async (req, res) => {
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

app.post('/api/config/ad-spends', async (req, res) => {
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
app.get('/api/analytics/proportions', async (req, res) => {
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

// Lancer le serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port http://localhost:${PORT}`);
});
