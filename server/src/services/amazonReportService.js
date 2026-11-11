import { createRequire } from 'module';
import { getDb } from '../db.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

const MONTH_MAP = {
  jan: { num: '01', fr: 'Janvier' },
  janv: { num: '01', fr: 'Janvier' },
  feb: { num: '02', fr: 'Février' },
  fev: { num: '02', fr: 'Février' },
  févr: { num: '02', fr: 'Février' },
  mar: { num: '03', fr: 'Mars' },
  mars: { num: '03', fr: 'Mars' },
  apr: { num: '04', fr: 'Avril' },
  avr: { num: '04', fr: 'Avril' },
  may: { num: '05', fr: 'Mai' },
  mai: { num: '05', fr: 'Mai' },
  jun: { num: '06', fr: 'Juin' },
  juin: { num: '06', fr: 'Juin' },
  jul: { num: '07', fr: 'Juillet' },
  juil: { num: '07', fr: 'Juillet' },
  aug: { num: '08', fr: 'Août' },
  aoû: { num: '08', fr: 'Août' },
  aou: { num: '08', fr: 'Août' },
  sep: { num: '09', fr: 'Septembre' },
  sept: { num: '09', fr: 'Septembre' },
  oct: { num: '10', fr: 'Octobre' },
  nov: { num: '11', fr: 'Novembre' },
  dec: { num: '12', fr: 'Décembre' },
  déc: { num: '12', fr: 'Décembre' }
};

function parseFrNumber(str) {
  if (!str) return 0;
  const cleaned = String(str).replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Extraction coordonnée par coordonnées (Y puis X) pour lire proprement
 * les tableaux à 2 colonnes des PDF Amazon Seller Central.
 */
function renderPageWithLayout(pageData) {
  return pageData.getTextContent({ normalizeWhitespace: true }).then((textContent) => {
    const rows = [];
    for (const item of textContent.items) {
      const y = Math.round(item.transform[5] / 3) * 3;
      const x = item.transform[4];
      const text = item.str.trim();
      if (!text) continue;

      // Séparer colonne gauche (x < 395) et colonne droite (x >= 395) sur les PDF paysage Amazon
      const col = x < 395 ? 'L' : 'R';
      let row = rows.find(r => r.col === col && Math.abs(r.y - y) <= 4);
      if (!row) {
        row = { col, y, items: [] };
        rows.push(row);
      }
      row.items.push({ x, text });
    }

    const leftRows = rows.filter(r => r.col === 'L').sort((a, b) => b.y - a.y);
    const rightRows = rows.filter(r => r.col === 'R').sort((a, b) => b.y - a.y);

    const formatRows = (list) =>
      list.map(r => r.items.sort((a, b) => a.x - b.x).map(i => i.text).join(' ')).join('\n');

    return formatRows(leftRows) + '\n---RIGHT_COL---\n' + formatRows(rightRows);
  });
}

function findNumberInLine(lines, patternRegex, sumAllNumbers = true) {
  for (const line of lines) {
    if (patternRegex.test(line)) {
      const nums = line.match(/-?\d[\d\s]*,\d{2}|(?<=\s)-?\d+(?=\s|$)/g) || [];
      // Exclure les nombres qui font partie d'une date ou du texte (ex: 2026)
      const validNums = nums.map(parseFrNumber);
      if (validNums.length === 0) return 0;
      if (sumAllNumbers) {
        return Math.round(validNums.reduce((a, b) => a + b, 0) * 100) / 100;
      }
      return validNums[validNums.length - 1];
    }
  }
  return 0;
}

export async function parseAmazonSummaryPdf(pdfBuffer) {
  const data = await pdfParse(pdfBuffer, { pagerender: renderPageWithLayout });
  const rawText = data.text || '';
  const allLines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // 1. Extraire la période (ex: "Activité du compte du Oct 1, 2026 ... au Oct 31, 2026 ...")
  let periodKey = '';
  let periodLabel = '';
  let dateRange = '';

  const dateLine = allLines.find(l => /Activité du compte du/i.test(l)) || rawText;
  const dateMatch = dateLine.match(/du\s+([A-Za-zÀ-ÿ]+)\s+(\d{1,2}),?\s+(\d{4}).*?au\s+([A-Za-zÀ-ÿ]+)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (dateMatch) {
    const m1 = dateMatch[1].toLowerCase().slice(0, 4);
    const mKey = MONTH_MAP[m1] || MONTH_MAP[m1.slice(0, 3)];
    const year = dateMatch[3];
    if (mKey) {
      periodKey = `${year}-${mKey.num}`;
      periodLabel = `${mKey.fr} ${year}`;
      dateRange = `${dateMatch[1]} ${dateMatch[2]}, ${year} - ${dateMatch[4]} ${dateMatch[5]}, ${dateMatch[6]}`;
    }
  }

  if (!periodKey) {
    throw new Error("Impossible de détecter la période du rapport Amazon Seller Central dans ce PDF.");
  }

  // 2. Séparer en sections / lignes pour extraire précisément chaque poste
  // Dans les 2 colonnes:
  const productSales = findNumberInLine(allLines, /Vente des produits Expédié par Amazon/i);
  const sellerSales = findNumberInLine(allLines, /Vente de produits expédiés par le vendeur/i);
  const productRefunds = findNumberInLine(allLines, /Remboursement des produits vendus et « Expédié par Amazon »/i);
  const sellerRefunds = findNumberInLine(allLines, /Remboursement des produits vendus et expédiés par le vendeur/i);
  const fbaInventoryCredit = findNumberInLine(allLines, /Crédit inventaire FBA/i);
  const shippingCredits =
    findNumberInLine(allLines, /^Crédits pour l'expédition/i) +
    findNumberInLine(allLines, /^Crédits des frais d'emballage/i) +
    findNumberInLine(allLines, /^Remboursement des crédits sur l'expédition/i);
  const promoRebates =
    findNumberInLine(allLines, /^Rabais promotionnels/i) +
    findNumberInLine(allLines, /^Remboursement des rabais promotionnels/i);

  // Totaux des blocs (Revenus, Dépenses, Taxe, Transferts)
  const revenuesTotal = findNumberInLine(allLines, /^Revenus\s+-?\d/i, false) ||
    Math.round((productSales + sellerSales + productRefunds + sellerRefunds + fbaInventoryCredit + shippingCredits + promoRebates) * 100) / 100;

  const sellingFees =
    findNumberInLine(allLines, /^Frais de vente « Expédié par Amazon »/i) +
    findNumberInLine(allLines, /^Frais de vente expédié par le vendeur/i) +
    findNumberInLine(allLines, /^Remboursement des frais de vente/i);

  const fbaTransactionFees =
    findNumberInLine(allLines, /^Frais de transaction « Expédié par Amazon »/i) +
    findNumberInLine(allLines, /^Remboursement des frais de transaction/i);

  const storageFees = findNumberInLine(allLines, /^Frais de stockage et de services logistiques/i);
  const adSpend =
    findNumberInLine(allLines, /^Prix de la publicité/i) +
    findNumberInLine(allLines, /^Remboursement pour le publicitaire/i);
  const serviceFees = findNumberInLine(allLines, /^Frais sur les services/i);
  const otherFees =
    findNumberInLine(allLines, /^Autres frais de transaction/i) +
    findNumberInLine(allLines, /^Remboursement d'autres frais de transaction/i) +
    findNumberInLine(allLines, /^Remboursement des frais administratifs/i) +
    findNumberInLine(allLines, /^Ajustements de l'étiquette/i) +
    findNumberInLine(allLines, /^Achats d'étiquettes/i);

  const expensesTotal = findNumberInLine(allLines, /^Dépenses\s+-?\d/i, false) ||
    Math.round((sellingFees + fbaTransactionFees + storageFees + adSpend + serviceFees + otherFees) * 100) / 100;

  const taxesCollected = findNumberInLine(allLines, /^Taxes prélevées sur les produits/i);
  const taxesRefunded =
    findNumberInLine(allLines, /^Taxes remboursées sur les produits/i) +
    findNumberInLine(allLines, /^TVA Amazon retenue à la source/i);
  const taxesTotal = findNumberInLine(allLines, /^Taxe\s+-?\d/i, false) ||
    Math.round((taxesCollected + taxesRefunded) * 100) / 100;

  const rawTransfer = findNumberInLine(allLines, /^Transfert sur le compte bancaire/i);
  const transfersTotal = Math.abs(rawTransfer || findNumberInLine(allLines, /^Transferts\s+-?\d/i, false));

  return {
    period_key: periodKey,
    period_label: periodLabel,
    date_range: dateRange,
    revenues_total: Math.round(revenuesTotal * 100) / 100,
    product_sales: Math.round((productSales + sellerSales) * 100) / 100,
    product_refunds: Math.round((productRefunds + sellerRefunds) * 100) / 100,
    fba_inventory_credit: Math.round(fbaInventoryCredit * 100) / 100,
    shipping_credits: Math.round(shippingCredits * 100) / 100,
    promo_rebates: Math.round(promoRebates * 100) / 100,
    expenses_total: Math.round(expensesTotal * 100) / 100,
    selling_fees: Math.round(sellingFees * 100) / 100,
    fba_transaction_fees: Math.round(fbaTransactionFees * 100) / 100,
    storage_fees: Math.round(storageFees * 100) / 100,
    ad_spend: Math.round(adSpend * 100) / 100,
    service_fees: Math.round(serviceFees * 100) / 100,
    other_fees: Math.round(otherFees * 100) / 100,
    taxes_total: Math.round(taxesTotal * 100) / 100,
    taxes_collected: Math.round(taxesCollected * 100) / 100,
    taxes_refunded: Math.round(taxesRefunded * 100) / 100,
    transfers_total: Math.round(transfersTotal * 100) / 100
  };
}

export async function getAllAmazonMonthlyReports() {
  const db = getDb();
  const reports = await db.all(`SELECT * FROM amazon_monthly_reports ORDER BY period_key DESC`);
  const txStats = await db.all(`
    SELECT
      period_key,
      SUM(CASE WHEN tx_type = 'Commande' THEN 1 ELSE 0 END) as csv_orders,
      SUM(CASE WHEN tx_type = 'Commande' THEN quantity ELSE 0 END) as csv_units,
      SUM(CASE WHEN tx_type = 'Commande' THEN ABS(fba_fees) ELSE 0.0 END) as csv_fba_fees,
      SUM(CASE WHEN tx_type = 'Commande' THEN ABS(selling_fees) ELSE 0.0 END) as csv_selling_fees,
      SUM(CASE WHEN tx_type = 'Commande' THEN ABS(other_fees) ELSE 0.0 END) as csv_other_fees,
      SUM(CASE WHEN tx_type = 'Frais de service' AND LOWER(description) LIKE '%publicit%' THEN ABS(other_fees) ELSE 0.0 END) as csv_ads_ht,
      SUM(CASE WHEN tx_type = 'Frais de service' AND LOWER(description) LIKE '%publicit%' THEN ABS(total_payout) ELSE 0.0 END) as csv_ads_ttc
    FROM amazon_transactions
    GROUP BY period_key
  `);

  const statsMap = {};
  txStats.forEach(s => { statsMap[s.period_key] = s; });

  const cogsRow = await db.get(`SELECT cogs FROM product_costs WHERE source = 'amazon' AND cogs > 0 ORDER BY cogs DESC LIMIT 1`);
  const defaultUnitCogs = cogsRow?.cogs || 8.0;

  return reports.map(r => {
    const st = statsMap[r.period_key] || {};
    const orders = st.csv_orders || 0;
    const units = st.csv_units || 0;
    const fbaFees = st.csv_fba_fees || Math.abs(r.fba_transaction_fees || 0);
    return {
      ...r,
      csv_orders: orders,
      csv_units: units,
      csv_fba_fees: Math.round(fbaFees * 100) / 100,
      csv_avg_fba_per_unit: units > 0 ? Math.round((fbaFees / units) * 100) / 100 : 0,
      csv_avg_fba_per_order: orders > 0 ? Math.round((fbaFees / orders) * 100) / 100 : 0,
      csv_ads_ht: Math.round((st.csv_ads_ht || 0) * 100) / 100,
      csv_ads_ttc: Math.round((st.csv_ads_ttc || Math.abs(r.ad_spend || 0)) * 100) / 100,
      default_unit_cogs: defaultUnitCogs
    };
  });
}

export async function saveAmazonMonthlyReport(report) {
  const db = getDb();
  const now = new Date().toISOString();
  await db.run(
    `INSERT OR REPLACE INTO amazon_monthly_reports (
      period_key, period_label, date_range,
      revenues_total, product_sales, product_refunds, fba_inventory_credit, shipping_credits, promo_rebates,
      expenses_total, selling_fees, fba_transaction_fees, storage_fees, ad_spend, service_fees, other_fees,
      taxes_total, taxes_collected, taxes_refunded, transfers_total, uploaded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      report.period_key,
      report.period_label,
      report.date_range,
      report.revenues_total,
      report.product_sales,
      report.product_refunds,
      report.fba_inventory_credit,
      report.shipping_credits,
      report.promo_rebates,
      report.expenses_total,
      report.selling_fees,
      report.fba_transaction_fees,
      report.storage_fees,
      report.ad_spend,
      report.service_fees,
      report.other_fees,
      report.taxes_total,
      report.taxes_collected,
      report.taxes_refunded,
      report.transfers_total,
      now
    ]
  );
  return db.get(`SELECT * FROM amazon_monthly_reports WHERE period_key = ?`, [report.period_key]);
}

export async function deleteAmazonMonthlyReport(periodKey) {
  const db = getDb();
  await db.run(`DELETE FROM amazon_monthly_reports WHERE period_key = ?`, [periodKey]);
}

function parseCsvLine(line, sep = ';') {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseAmazonFrenchDate(str) {
  if (!str) return null;
  // Format: "1 oct. 2026 00:37:45 UTC"
  const m = str.match(/(\d{1,2})\s+([a-zA-Zéèêàùûîôïç.]+)\s+(\d{4})/i);
  if (!m) return null;
  const day = m[1].padStart(2, '0');
  const rawMonth = m[2].toLowerCase().replace('.', '');
  const mInfo = MONTH_MAP[rawMonth] || MONTH_MAP[rawMonth.slice(0, 4)] || MONTH_MAP[rawMonth.slice(0, 3)];
  if (!mInfo) return null;
  const year = m[3];
  return {
    date: `${year}-${mInfo.num}-${day}`,
    periodKey: `${year}-${mInfo.num}`,
    periodLabel: `${mInfo.fr} ${year}`
  };
}

export async function importAmazonTransactionsCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  // Trouver la véritable ligne d'en-tête contenant "date/heure" et ("type" ou "numéro de la commande")
  const headerIdx = lines.findIndex(l => {
    const low = l.toLowerCase();
    return low.includes('date/heure') && (low.includes(';type;') || low.includes('"type"') || low.includes('numéro de la commande'));
  });
  if (headerIdx === -1) {
    throw new Error("Format CSV Amazon invalide : en-tête 'date/heure ... type' introuvable.");
  }

  const sep = lines[headerIdx].includes(';') ? ';' : ',';
  const headerCols = parseCsvLine(lines[headerIdx], sep).map(h => h.toLowerCase().trim());
  const idx = (namePart) => headerCols.findIndex(h => h.includes(namePart.toLowerCase()));

  const iDate = 0;
  const iType = headerCols.findIndex(h => h === 'type') !== -1 ? headerCols.findIndex(h => h === 'type') : idx('type');
  const iOrder = idx('numéro de la commande');
  const iSku = idx('sku');
  const iDesc = idx('description');
  const iQty = idx('quantité');
  const iProdSales = idx('ventes de produits');
  const iProdTax = idx('taxes sur la vente');
  const iShipCred = idx("crédits d'expédition");
  const iShipTax = idx("taxe sur les crédits");
  const iPromo = idx('rabais promotionnels');
  const iPromoTax = idx('taxes sur les remises');
  const iSellFee = idx('frais de vente');
  const iFbaFee = idx('frais expédié par amazon');
  const iOtherFee = idx('autres frais de transaction');
  const iOtherAmt = headerCols.findIndex(h => h === 'autre');
  const iTotal = headerCols.findIndex(h => h === 'total');
  const iStatus = idx('statut');

  const parsedRows = [];
  const periodCounts = {};

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], sep);
    if (cols.length < 15) continue;

    const dateInfo = parseAmazonFrenchDate(cols[iDate]);
    if (!dateInfo) continue;

    periodCounts[dateInfo.periodKey] = (periodCounts[dateInfo.periodKey] || 0) + 1;

    parsedRows.push({
      period_key: dateInfo.periodKey,
      tx_date: dateInfo.date,
      tx_datetime: cols[iDate],
      tx_type: cols[iType] || '',
      order_id: cols[iOrder] || '',
      sku: cols[iSku] || '',
      description: cols[iDesc] || '',
      quantity: parseInt(cols[iQty] || '0', 10) || 0,
      product_sales_ht: parseFrNumber(cols[iProdSales]),
      product_taxes: parseFrNumber(cols[iProdTax]),
      shipping_credits: parseFrNumber(cols[iShipCred]) + parseFrNumber(cols[iShipTax]),
      promo_rebates: parseFrNumber(cols[iPromo]) + parseFrNumber(cols[iPromoTax]),
      selling_fees: parseFrNumber(cols[iSellFee]),
      fba_fees: parseFrNumber(cols[iFbaFee]),
      other_fees: parseFrNumber(cols[iOtherFee]),
      other_amount: parseFrNumber(cols[iOtherAmt]),
      total_payout: parseFrNumber(cols[iTotal]),
      status: cols[iStatus] || ''
    });
  }

  if (parsedRows.length === 0) {
    throw new Error("Aucune transaction valide trouvée dans ce fichier CSV.");
  }

  // Période majoritaire du CSV
  const mainPeriodKey = Object.entries(periodCounts).sort((a, b) => b[1] - a[1])[0][0];

  const db = getDb();
  await db.run(`DELETE FROM amazon_transactions WHERE period_key = ?`, [mainPeriodKey]);

  const stmt = await db.prepare(`
    INSERT INTO amazon_transactions (
      period_key, tx_date, tx_datetime, tx_type, order_id, sku, description, quantity,
      product_sales_ht, product_taxes, shipping_credits, promo_rebates,
      selling_fees, fba_fees, other_fees, other_amount, total_payout, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const r of parsedRows) {
    await stmt.run(
      mainPeriodKey,
      r.tx_date,
      r.tx_datetime,
      r.tx_type,
      r.order_id,
      r.sku,
      r.description,
      r.quantity,
      r.product_sales_ht,
      r.product_taxes,
      r.shipping_credits,
      r.promo_rebates,
      r.selling_fees,
      r.fba_fees,
      r.other_fees,
      r.other_amount,
      r.total_payout,
      r.status
    );
  }
  await stmt.finalize();

  return {
    periodKey: mainPeriodKey,
    count: parsedRows.length
  };
}

export async function getAmazonReconciliation(periodKey) {
  const db = getDb();
  const txRows = await db.all(
    `SELECT * FROM amazon_transactions WHERE period_key = ? ORDER BY tx_date DESC, id DESC`,
    [periodKey]
  );

  if (txRows.length === 0) {
    return { hasCsv: false, periodKey };
  }

  const startDate = `${periodKey}-01`;
  const endDate = `${periodKey}-31`;

  // Récupérer les commandes SP-API du dashboard sur la même période
  const spOrders = await db.all(
    `SELECT order_number, date, total_price, items_count, status FROM orders_cache WHERE source = 'amazon' AND date BETWEEN ? AND ?`,
    [startDate, endDate]
  );
  const spDaily = await db.get(
    `SELECT SUM(order_count) as orders, SUM(sales_count) as units, SUM(revenue) as rev, SUM(fees) as est_fees, SUM(shipping_cost) as est_fba FROM daily_sku_sales WHERE source = 'amazon' AND date BETWEEN ? AND ?`,
    [startDate, endDate]
  );

  // Aussi chercher toutes les commandes amazon connues dans orders_cache (pour matcher celles commandées fin du mois précédent)
  const allSpOrders = await db.all(
    `SELECT order_number, date, total_price, items_count, status FROM orders_cache WHERE source = 'amazon'`
  );
  const spMap = new Map();
  allSpOrders.forEach(o => spMap.set(o.order_number, o));

  const csvOrders = txRows.filter(r => r.tx_type === 'Commande');
  const csvRefunds = txRows.filter(r => r.tx_type === 'Remboursement');
  const csvAds = txRows.filter(r => r.tx_type === 'Frais de service' && /publicit/i.test(r.description));

  let csvOrdersCount = csvOrders.length;
  let csvUnits = 0;
  let csvRevHt = 0;
  let csvRevTtc = 0;
  let csvSellingFees = 0;
  let csvFbaFees = 0;
  let csvOtherFees = 0;
  let csvNetPayout = 0;
  let matchedCount = 0;

  const csvOrderIds = new Set();
  const reconciledOrders = csvOrders.map(tx => {
    csvOrderIds.add(tx.order_id);
    const qty = tx.quantity || 1;
    csvUnits += qty;
    csvRevHt += tx.product_sales_ht || 0;
    csvRevTtc += (tx.product_sales_ht || 0) + (tx.product_taxes || 0);
    csvSellingFees += Math.abs(tx.selling_fees || 0);
    csvFbaFees += Math.abs(tx.fba_fees || 0);
    csvOtherFees += Math.abs(tx.other_fees || 0);
    csvNetPayout += tx.total_payout || 0;

    const spMatch = spMap.get(tx.order_id);
    if (spMatch) matchedCount++;

    return {
      orderId: tx.order_id,
      txDate: tx.tx_date,
      spDate: spMatch?.date || null,
      matched: !!spMatch,
      quantity: qty,
      revHt: Math.round((tx.product_sales_ht || 0) * 100) / 100,
      revTtc: Math.round(((tx.product_sales_ht || 0) + (tx.product_taxes || 0)) * 100) / 100,
      sellingFee: Math.round(Math.abs(tx.selling_fees || 0) * 100) / 100,
      fbaFee: Math.round(Math.abs(tx.fba_fees || 0) * 100) / 100,
      otherFee: Math.round(Math.abs(tx.other_fees || 0) * 100) / 100,
      netPayout: Math.round((tx.total_payout || 0) * 100) / 100,
      status: tx.status
    };
  });

  // Commandes présentes dans SP-API pour ce mois mais absentes du CSV (ex: annulées ou expédiées le mois suivant)
  const spOnlyOrders = spOrders.filter(o => !csvOrderIds.has(o.order_number));

  const csvAdsTotalTtc = csvAds.reduce((sum, r) => sum + Math.abs(r.total_payout || 0), 0);
  const csvAdsTotalHt = csvAds.reduce((sum, r) => sum + Math.abs(r.other_fees || 0), 0);

  return {
    hasCsv: true,
    periodKey,
    totalTxRows: txRows.length,
    csvSummary: {
      orders: csvOrdersCount,
      units: csvUnits,
      revHt: Math.round(csvRevHt * 100) / 100,
      revTtc: Math.round(csvRevTtc * 100) / 100,
      sellingFees: Math.round(csvSellingFees * 100) / 100,
      fbaFees: Math.round(csvFbaFees * 100) / 100,
      otherFees: Math.round(csvOtherFees * 100) / 100,
      netPayout: Math.round(csvNetPayout * 100) / 100,
      avgFbaPerUnit: csvUnits > 0 ? Math.round((csvFbaFees / csvUnits) * 100) / 100 : 0,
      avgFbaPerOrder: csvOrdersCount > 0 ? Math.round((csvFbaFees / csvOrdersCount) * 100) / 100 : 0,
      refundsCount: csvRefunds.length,
      refundsTotal: Math.round(csvRefunds.reduce((s, r) => s + (r.total_payout || 0), 0) * 100) / 100,
      adsTtc: Math.round(csvAdsTotalTtc * 100) / 100,
      adsHt: Math.round(csvAdsTotalHt * 100) / 100
    },
    dashboardSummary: {
      orders: Math.round(spDaily?.orders || 0),
      units: Math.round(spDaily?.units || 0),
      rev: Math.round((spDaily?.rev || 0) * 100) / 100,
      estFees: Math.round((spDaily?.est_fees || 0) * 100) / 100,
      estFba: Math.round((spDaily?.est_fba || 0) * 100) / 100
    },
    reconciliation: {
      matchedCount,
      csvOnlyCount: csvOrdersCount - matchedCount,
      spOnlyCount: spOnlyOrders.length,
      spOnlyOrders: spOnlyOrders.slice(0, 30)
    },
    orders: reconciledOrders
  };
}

/**
 * Applique les frais FBA réels, commissions réelles et dépenses Amazon Ads du CSV
 * dans daily_sku_sales et ad_spends pour le mois donné.
 */
export async function applyAmazonCsvCostsToDashboard(periodKey) {
  const db = getDb();
  const txRows = await db.all(
    `SELECT * FROM amazon_transactions WHERE period_key = ?`,
    [periodKey]
  );
  if (txRows.length === 0) {
    throw new Error("Aucune transaction CSV trouvée pour ce mois.");
  }

  // Agréger par jour pour daily_sku_sales (source = 'amazon')
  const dailyMap = {};
  const dailyAdsMap = {};

  for (const r of txRows) {
    if (r.tx_type === 'Commande') {
      if (!dailyMap[r.tx_date]) {
        dailyMap[r.tx_date] = { orders: 0, units: 0, revTtc: 0, fees: 0, fba: 0 };
      }
      dailyMap[r.tx_date].orders += 1;
      dailyMap[r.tx_date].units += (r.quantity || 1);
      dailyMap[r.tx_date].revTtc += (r.product_sales_ht || 0) + (r.product_taxes || 0);
      dailyMap[r.tx_date].fees += Math.abs(r.selling_fees || 0) + Math.abs(r.other_fees || 0);
      dailyMap[r.tx_date].fba += Math.abs(r.fba_fees || 0);
    } else if (r.tx_type === 'Frais de service' && /publicit/i.test(r.description)) {
      dailyAdsMap[r.tx_date] = (dailyAdsMap[r.tx_date] || 0) + Math.abs(r.total_payout || 0);
    }
  }

  // Mettre à jour daily_sku_sales pour chaque jour présent dans le CSV
  for (const [d, stats] of Object.entries(dailyMap)) {
    const existing = await db.get(
      `SELECT sku FROM daily_sku_sales WHERE source = 'amazon' AND date = ? LIMIT 1`,
      [d]
    );
    if (existing) {
      await db.run(
        `UPDATE daily_sku_sales SET fees = ?, shipping_cost = ? WHERE source = 'amazon' AND date = ? AND sku = ?`,
        [Math.round(stats.fees * 100) / 100, Math.round(stats.fba * 100) / 100, d, existing.sku]
      );
    }
  }

  // Mettre à jour ad_spends (source = 'amazon') si aucune dépense API n'est déjà là
  for (const [d, spend] of Object.entries(dailyAdsMap)) {
    await db.run(
      `INSERT INTO ad_spends (date, source, spend) VALUES (?, 'amazon', ?)
       ON CONFLICT(date, source) DO UPDATE SET spend = excluded.spend`,
      [d, Math.round(spend * 100) / 100]
    );
  }

  return {
    updatedDays: Object.keys(dailyMap).length,
    updatedAdsDays: Object.keys(dailyAdsMap).length
  };
}
