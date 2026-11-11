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
  return db.all(`SELECT * FROM amazon_monthly_reports ORDER BY period_key DESC`);
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
