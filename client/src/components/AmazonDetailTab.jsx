import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Upload,
  FileText,
  DollarSign,
  Percent,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Landmark,
  Megaphone,
  FileSpreadsheet,
  RefreshCw,
  ArrowRightLeft,
  Truck,
  TrendingUp
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { authFetch, getApiBase } from '../utils/api';

const API_BASE = getApiBase();

export default function AmazonDetailTab() {
  const [reports, setReports] = useState([]);
  const [shippingRates, setShippingRates] = useState({ domicile: 5.50, relais: 3.50 });
  const [unitCogs, setUnitCogs] = useState(8.0);
  const [loading, setLoading] = useState(true);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [applyingCosts, setApplyingCosts] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('all'); // 'all' ou period_key
  const [reconciliation, setReconciliation] = useState(null);
  const [showCsvOrders, setShowCsvOrders] = useState(false);
  const [expanded, setExpanded] = useState({
    revenues: true,
    expenses: true,
    taxes: false,
    roi: true
  });

  const loadReports = async () => {
    setLoading(true);
    try {
      const [repRes, shipRes] = await Promise.all([
        authFetch(`${API_BASE}/amazon/reports`),
        authFetch(`${API_BASE}/config/shipping-costs`)
      ]);

      if (repRes.ok) {
        const data = await repRes.json();
        setReports(data);
        if (data[0]?.default_unit_cogs) {
          setUnitCogs(data[0].default_unit_cogs);
        }
        const targetPeriod = selectedPeriod !== 'all' ? selectedPeriod : (data[0]?.period_key || '2026-10');
        if (targetPeriod) {
          loadReconciliation(targetPeriod);
        }
      }
      if (shipRes.ok) {
        const shipData = await shipRes.json();
        const dom = shipData.find(s => s.code === 'domicile')?.cost_per_order ?? 5.50;
        const rel = shipData.find(s => s.code === 'relais')?.cost_per_order ?? 3.50;
        setShippingRates({ domicile: dom, relais: rel });
      }
    } catch (err) {
      console.error('Erreur chargement rapports Amazon:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadReconciliation = async (periodKey) => {
    try {
      const res = await authFetch(`${API_BASE}/amazon/reconciliation/${periodKey}`);
      if (res.ok) {
        const data = await res.json();
        setReconciliation(data);
      }
    } catch (err) {
      console.error('Erreur chargement rapprochement:', err);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    if (selectedPeriod !== 'all') {
      loadReconciliation(selectedPeriod);
    } else if (reports.length > 0) {
      loadReconciliation(reports[0].period_key);
    }
  }, [selectedPeriod]);

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setFeedback({ type: 'error', text: 'Veuillez sélectionner un fichier PDF Amazon Seller Central.' });
      return;
    }

    setUploadingPdf(true);
    setFeedback(null);

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await authFetch(`${API_BASE}/amazon/reports/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64: base64 })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Échec de l’analyse du PDF.');
      }

      setFeedback({
        type: 'success',
        text: `Rapport PDF "${data.report.period_label}" importé et analysé avec succès !`
      });
      await loadReports();
      setSelectedPeriod(data.report.period_key);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setUploadingPdf(false);
      e.target.value = '';
    }
  };

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCsv(true);
    setFeedback(null);

    try {
      const csvText = await file.text();
      const res = await authFetch(`${API_BASE}/amazon/transactions/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Échec de l’import du CSV.');
      }

      setFeedback({
        type: 'success',
        text: `CSV "${file.name}" importé : ${data.count} transactions analysées pour ${data.periodKey} ! Coût FBA moyen réel : ${formatCurrency(data.reconciliation?.csvSummary?.avgFbaPerUnit)}/unité.`
      });
      await loadReports();
      setSelectedPeriod(data.periodKey);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setUploadingCsv(false);
      e.target.value = '';
    }
  };

  const handleApplyCsvCosts = async (periodKey) => {
    setApplyingCosts(true);
    setFeedback(null);
    try {
      const res = await authFetch(`${API_BASE}/amazon/reconciliation/${periodKey}/apply`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Impossible d’appliquer les coûts CSV.');
      }
      setFeedback({
        type: 'success',
        text: `Coûts réels CSV appliqués au Dashboard (${data.updatedDays} jours de frais FBA/com + ${data.updatedAdsDays} jours d'Amazon Ads mis à jour) !`
      });
      await loadReconciliation(periodKey);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setApplyingCosts(false);
    }
  };

  const handleDelete = async (periodKey, label) => {
    if (!window.confirm(`Supprimer le rapport ${label} de l'historique ?`)) return;
    try {
      const res = await authFetch(`${API_BASE}/amazon/reports/${periodKey}`, { method: 'DELETE' });
      if (res.ok) {
        await loadReports();
        if (selectedPeriod === periodKey) setSelectedPeriod('all');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(val || 0);
  };

  const sortedChrono = [...reports].sort((a, b) => a.period_key.localeCompare(b.period_key));

  const activeReports = selectedPeriod === 'all'
    ? sortedChrono
    : sortedChrono.filter(r => r.period_key === selectedPeriod);

  // Calcul consolidé incluant le Vrai ROI (Revenus HT - Frais Amazon - Ads - COGS)
  const computeMetrics = (r) => {
    const revenuesHt = r.revenues_total || 0;
    const taxes = r.taxes_total || 0;
    const totalTtc = revenuesHt + taxes;
    const amazonExpenses = Math.abs(r.expenses_total || 0);
    const adSpend = Math.abs(r.ad_spend || 0);
    const fbaFees = Math.abs(r.csv_fba_fees || r.fba_transaction_fees || 0);
    const storageFees = Math.abs(r.storage_fees || 0);
    const otherAmazonFees = Math.max(0, amazonExpenses - adSpend - fbaFees - storageFees);
    const units = r.csv_units > 0 ? r.csv_units : Math.round(revenuesHt / 33.33);
    const orders = r.csv_orders > 0 ? r.csv_orders : units;
    const cogsTotal = units * (parseFloat(unitCogs) || 0);

    const totalAllCosts = amazonExpenses + cogsTotal;
    const netProfit = revenuesHt - totalAllCosts;
    const netMarginPct = revenuesHt > 0 ? (netProfit / revenuesHt) * 100 : 0;
    const trueRoiPct = totalAllCosts > 0 ? (netProfit / totalAllCosts) * 100 : 0;
    const avgFbaPerUnit = units > 0 ? fbaFees / units : 0;
    const avgFbaPerOrder = orders > 0 ? fbaFees / orders : 0;

    return {
      revenuesHt,
      taxes,
      totalTtc,
      amazonExpenses,
      adSpend,
      fbaFees,
      storageFees,
      otherAmazonFees,
      units,
      orders,
      cogsTotal,
      totalAllCosts,
      netProfit,
      netMarginPct,
      trueRoiPct,
      avgFbaPerUnit,
      avgFbaPerOrder,
      transfers: r.transfers_total || 0
    };
  };

  const summary = activeReports.reduce((acc, r) => {
    const m = computeMetrics(r);
    acc.revenues += m.revenuesHt;
    acc.taxes += m.taxes;
    acc.expenses += m.amazonExpenses;
    acc.adSpend += m.adSpend;
    acc.fbaFees += m.fbaFees;
    acc.storageFees += m.storageFees;
    acc.otherAmazonFees += m.otherAmazonFees;
    acc.units += m.units;
    acc.orders += m.orders;
    acc.cogsTotal += m.cogsTotal;
    acc.netProfit += m.netProfit;
    acc.transfers += m.transfers;
    return acc;
  }, {
    revenues: 0, taxes: 0, expenses: 0, adSpend: 0, fbaFees: 0, storageFees: 0,
    otherAmazonFees: 0, units: 0, orders: 0, cogsTotal: 0, netProfit: 0, transfers: 0
  });

  const totalTtc = summary.revenues + summary.taxes;
  const totalAllCosts = summary.expenses + summary.cogsTotal;
  const trueRoiPct = totalAllCosts > 0 ? (summary.netProfit / totalAllCosts) * 100 : 0;
  const netMarginPct = summary.revenues > 0 ? (summary.netProfit / summary.revenues) * 100 : 0;
  const avgFbaPerUnitGlobal = summary.units > 0 ? summary.fbaFees / summary.units : 0;
  const avgFbaPerOrderGlobal = summary.orders > 0 ? summary.fbaFees / summary.orders : 0;
  const realCostRate = totalTtc > 0 ? (summary.expenses / totalTtc) * 100 : 0;
  const realAcos = summary.revenues > 0 ? (summary.adSpend / summary.revenues) * 100 : 0;
  const realRoas = summary.adSpend > 0 ? (summary.revenues / summary.adSpend) : 0;

  const chartData = sortedChrono.map(r => {
    const m = computeMetrics(r);
    return {
      name: r.period_label,
      'Bénéfice Net Réel (après COGS)': Math.round(m.netProfit * 100) / 100,
      'Frais Amazon & FBA': Math.round((m.amazonExpenses - m.adSpend) * 100) / 100,
      'Amazon Ads': Math.round(m.adSpend * 100) / 100,
      'COGS Fabrication': Math.round(m.cogsTotal * 100) / 100
    };
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* HEADER + UPLOAD PDF & CSV */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-200/70">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">
              Détail Amazon Seller Central — Coûts Réels, Expédition FBA & Vrai ROI
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Comparatif des coûts d'expédition FBA vs Shopify et calcul du ROI net complet (Pub, Commissions, FBA, Stockage, COGS)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            <option value="all">Historique Complet ({sortedChrono.length} mois)</option>
            {sortedChrono.map(r => (
              <option key={r.period_key} value={r.period_key}>{r.period_label}</option>
            ))}
          </select>

          <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold text-white transition-all shadow-xs cursor-pointer ${
            uploadingPdf ? 'bg-slate-400 cursor-wait' : 'bg-amber-600 hover:bg-amber-500'
          }`}>
            <Upload className="w-4 h-4" />
            {uploadingPdf ? 'Import PDF...' : 'Importer PDF Résumé'}
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={handlePdfUpload}
              disabled={uploadingPdf}
              className="hidden"
            />
          </label>

          <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold text-white transition-all shadow-xs cursor-pointer ${
            uploadingCsv ? 'bg-slate-400 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-500'
          }`}>
            <FileSpreadsheet className="w-4 h-4" />
            {uploadingCsv ? 'Import CSV...' : 'Importer CSV Transactions'}
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvUpload}
              disabled={uploadingCsv}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {feedback && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl text-xs font-bold border ${
          feedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* KPI CARDS : REVENUS, COÛTS, PUB & VRAI ROI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-extrabold uppercase text-slate-500">Revenus Net HT Amazon</p>
              <h4 className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(summary.revenues)}</h4>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-semibold mt-3 pt-2.5 border-t border-slate-100">
            <b>{summary.orders}</b> cmd ({summary.units} art.) • TTC : <b>{formatCurrency(totalTtc)}</b>
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-extrabold uppercase text-slate-500">Coûts Amazon + COGS</p>
              <h4 className="text-2xl font-black text-rose-600 mt-1">-{formatCurrency(totalAllCosts)}</h4>
            </div>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-semibold mt-3 pt-2.5 border-t border-slate-100">
            Amazon : -{formatCurrency(summary.expenses)} ({realCostRate.toFixed(1)}%) • COGS : -{formatCurrency(summary.cogsTotal)}
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-extrabold uppercase text-slate-500">Amazon Ads Réel (Facturé)</p>
              <h4 className="text-2xl font-black text-amber-600 mt-1">-{formatCurrency(summary.adSpend)}</h4>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
              <Megaphone className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-semibold mt-3 pt-2.5 border-t border-slate-100">
            TACOS HT : <b className="text-amber-700">{realAcos.toFixed(1)}%</b> • ROAS HT : <b className="text-slate-800">{realRoas.toFixed(2)}x</b>
          </p>
        </div>

        <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-5 shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-extrabold uppercase text-emerald-400">Vrai Résultat Net & ROI</p>
              <div className="flex items-baseline gap-2 mt-1">
                <h4 className={`text-2xl font-black ${summary.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatCurrency(summary.netProfit)}
                </h4>
                <span className="text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                  ROI {trueRoiPct.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[11px] text-slate-300 font-semibold mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between">
            <span>Marge nette HT : <b className="text-white">{netMarginPct.toFixed(1)}%</b></span>
            <label className="flex items-center gap-1">
              <span className="text-slate-400">COGS/u:</span>
              <input
                type="number"
                step="0.5"
                min="0"
                value={unitCogs}
                onChange={(e) => setUnitCogs(parseFloat(e.target.value) || 0)}
                className="w-12 bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 text-center text-white font-bold text-[11px]"
              />
              <span>€</span>
            </label>
          </div>
        </div>
      </div>

      {/* COMPARATIF COÛTS EXPÉDITION : AMAZON FBA VS SHOPIFY DOMICILE VS MONDIAL RELAY */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-slate-900">
                Comparatif Coût d'Expédition : Amazon FBA Réel vs Shopify (Domicile & Mondial Relay)
              </h4>
              <p className="text-xs text-slate-500">
                Basé sur vos factures réelles « Frais Expédié par Amazon » des 4 relevés CSV mensuels
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-extrabold uppercase text-emerald-700">Shopify — Mondial Relay</div>
              <div className="text-2xl font-black text-emerald-900 mt-1">{formatCurrency(shippingRates.relais)}</div>
              <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">Par commande</div>
            </div>
            <span className="text-xs font-black bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200">
              -{formatCurrency(Math.max(0, avgFbaPerUnitGlobal - shippingRates.relais))} vs FBA
            </span>
          </div>

          <div className="bg-indigo-50/50 border border-indigo-200/80 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-extrabold uppercase text-indigo-700">Shopify — Domicile</div>
              <div className="text-2xl font-black text-indigo-900 mt-1">{formatCurrency(shippingRates.domicile)}</div>
              <div className="text-[11px] text-indigo-700 font-semibold mt-0.5">Colissimo / Chronopost</div>
            </div>
            <span className="text-xs font-black bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-full border border-indigo-200">
              -{formatCurrency(Math.max(0, avgFbaPerUnitGlobal - shippingRates.domicile))} vs FBA
            </span>
          </div>

          <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-extrabold uppercase text-amber-800">Amazon FBA Réel</div>
              <div className="text-2xl font-black text-amber-950 mt-1">{formatCurrency(avgFbaPerUnitGlobal)}</div>
              <div className="text-[11px] text-amber-800 font-semibold mt-0.5">
                / produit ({formatCurrency(avgFbaPerOrderGlobal)} / cmd)
              </div>
            </div>
            <span className="text-[11px] font-black bg-amber-100 text-amber-900 px-2.5 py-1 rounded-full border border-amber-300">
              Total : {formatCurrency(summary.fbaFees)}
            </span>
          </div>
        </div>

        {/* BARRE MENSUELLE DES COÛTS FBA */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          {sortedChrono.map(r => {
            const m = computeMetrics(r);
            return (
              <div key={r.period_key} className="bg-slate-50 border border-slate-200/70 rounded-xl p-3 text-xs">
                <div className="font-extrabold text-slate-800">{r.period_label}</div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-amber-700 font-black text-sm">{formatCurrency(m.avgFbaPerUnit)}/u</span>
                  <span className="text-[10px] text-slate-500 font-semibold">{m.units} prod.</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {formatCurrency(m.avgFbaPerOrder)} / cmd • Total {formatCurrency(m.fbaFees)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION RAPPROCHEMENT CSV TRANSACTIONS VS DASHBOARD SP-API */}
      {reconciliation && reconciliation.hasCsv && (
        <div className="bg-gradient-to-br from-indigo-50/50 via-white to-slate-50 border border-indigo-200/80 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-indigo-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900">
                  Rapprochement CSV Transactions vs Dashboard ({reconciliation.periodKey})
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  Coût d'expédition réel « Frais Expédié par Amazon » et rapprochement commande par commande avec SP-API
                </p>
              </div>
            </div>

            <button
              onClick={() => handleApplyCsvCosts(reconciliation.periodKey)}
              disabled={applyingCosts}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-extrabold transition-all shadow-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${applyingCosts ? 'animate-spin' : ''}`} />
              {applyingCosts ? 'Application...' : 'Appliquer les coûts réels CSV au Dashboard'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-2">
              <div className="text-[11px] font-extrabold uppercase text-indigo-600">Coût Expédition FBA Réel</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">
                  {formatCurrency(reconciliation.csvSummary.avgFbaPerUnit)}
                </span>
                <span className="text-xs font-bold text-slate-500">/ produit</span>
              </div>
              <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                <div className="flex justify-between">
                  <span>Coût moyen / commande :</span>
                  <b className="text-slate-900">{formatCurrency(reconciliation.csvSummary.avgFbaPerOrder)}</b>
                </div>
                <div className="flex justify-between">
                  <span>Total FBA CSV ({reconciliation.csvSummary.units} art.) :</span>
                  <b className="text-rose-600">-{formatCurrency(reconciliation.csvSummary.fbaFees)}</b>
                </div>
                <div className="flex justify-between">
                  <span>Total FBA dans Dashboard :</span>
                  <b className="text-slate-700">-{formatCurrency(reconciliation.dashboardSummary.estFba)}</b>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-2">
              <div className="text-[11px] font-extrabold uppercase text-emerald-600">Rapprochement Commandes</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-700">
                  {reconciliation.reconciliation.matchedCount}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  / {reconciliation.csvSummary.orders} cmd matchées
                </span>
              </div>
              <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                <div className="flex justify-between">
                  <span>Encaissées CSV (date expéd.) :</span>
                  <b className="text-slate-900">{reconciliation.csvSummary.orders} cmd ({reconciliation.csvSummary.units} art.)</b>
                </div>
                <div className="flex justify-between">
                  <span>Passées SP-API (date achat) :</span>
                  <b className="text-slate-900">{reconciliation.dashboardSummary.orders} cmd ({reconciliation.dashboardSummary.units} art.)</b>
                </div>
                <div className="flex justify-between text-[11px] text-amber-700">
                  <span>Écart (annulées / mois suiv.) :</span>
                  <b>{reconciliation.reconciliation.spOnlyCount} cmd SP-API non encaissées</b>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-2">
              <div className="text-[11px] font-extrabold uppercase text-amber-600">Commissions, Pub & Payout CSV</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">
                  {formatCurrency(reconciliation.csvSummary.netPayout)}
                </span>
                <span className="text-xs font-bold text-slate-500">net commandes</span>
              </div>
              <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                <div className="flex justify-between">
                  <span>Frais de vente réels CSV :</span>
                  <b className="text-rose-600">-{formatCurrency(reconciliation.csvSummary.sellingFees)}</b>
                </div>
                <div className="flex justify-between">
                  <span>Factures Amazon Ads CSV :</span>
                  <b className="text-amber-700">-{formatCurrency(reconciliation.csvSummary.adsTtc)}</b>
                </div>
                <div className="flex justify-between">
                  <span>Remboursements ({reconciliation.csvSummary.refundsCount}) :</span>
                  <b className="text-rose-600">{formatCurrency(reconciliation.csvSummary.refundsTotal)}</b>
                </div>
              </div>
            </div>
          </div>

          {/* TABLEAU DÉPLIANT DES COMMANDES CSV */}
          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
            <button
              onClick={() => setShowCsvOrders(!showCsvOrders)}
              className="w-full px-5 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-extrabold text-slate-800 cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-2">
                <ChevronRight className={`w-4 h-4 text-indigo-600 transition-transform ${showCsvOrders ? 'rotate-90' : ''}`} />
                Voir le détail par commande du relevé CSV ({reconciliation.orders.length} commandes)
              </span>
              <span className="text-[11px] font-bold text-indigo-600">
                {showCsvOrders ? 'Masquer ▲' : 'Déplier ▾'}
              </span>
            </button>

            {showCsvOrders && (
              <div className="max-h-96 overflow-y-auto overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 sticky top-0 text-[11px] font-extrabold text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Date Tx</th>
                      <th className="px-4 py-2.5">N° Commande</th>
                      <th className="px-4 py-2.5 text-center">Rapprochement</th>
                      <th className="px-4 py-2.5 text-center">Qté</th>
                      <th className="px-4 py-2.5 text-right">Vente TTC</th>
                      <th className="px-4 py-2.5 text-right">Frais Vente</th>
                      <th className="px-4 py-2.5 text-right text-rose-700">Frais FBA</th>
                      <th className="px-4 py-2.5 text-right text-emerald-700">Net Versé</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reconciliation.orders.map((o, idx) => (
                      <tr key={`${o.orderId}_${idx}`} className="hover:bg-slate-50/80">
                        <td className="px-4 py-2 text-slate-600">{o.txDate}</td>
                        <td className="px-4 py-2 font-mono font-bold text-slate-800">{o.orderId}</td>
                        <td className="px-4 py-2 text-center">
                          {o.matched ? (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              Match SP-API ({o.spDate})
                            </span>
                          ) : (
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                              Hors plage SP-API
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-center font-bold">{o.quantity}</td>
                        <td className="px-4 py-2 text-right font-semibold">{formatCurrency(o.revTtc)}</td>
                        <td className="px-4 py-2 text-right text-slate-500">-{formatCurrency(o.sellingFee)}</td>
                        <td className="px-4 py-2 text-right font-bold text-rose-600">-{formatCurrency(o.fbaFee)}</td>
                        <td className="px-4 py-2 text-right font-black text-emerald-700">{formatCurrency(o.netPayout)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GRAPHIQUE COMPARATIF MENSUEL (BÉNÉFICE NET RÉEL VS COÛTS) */}
      {chartData.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
          <div className="mb-4">
            <h4 className="text-sm font-extrabold text-slate-900">Évolution Mensuelle : Bénéfice Net Réel vs Coûts Totaux (FBA, Ads, COGS)</h4>
            <p className="text-xs text-slate-500">Décomposition du Revenu Net HT mois par mois (COGS fixé à {formatCurrency(unitCogs)}/u)</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} fontWeight={700} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} tickFormatter={(v) => `${v} €`} />
                <Tooltip formatter={(val) => formatCurrency(val)} />
                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 700 }} />
                <Bar dataKey="Bénéfice Net Réel (après COGS)" stackId="a" fill="#10b981" />
                <Bar dataKey="COGS Fabrication" stackId="a" fill="#6366f1" />
                <Bar dataKey="Frais Amazon & FBA" stackId="a" fill="#f43f5e" />
                <Bar dataKey="Amazon Ads" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* TABLEAU HISTORIQUE DÉTAILLÉ DES RAPPORTS PDF + CALCUL VRAI ROI */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-amber-600" />
            <div>
              <h4 className="text-sm font-extrabold text-slate-900">Historique Comparatif Mensuel & Calcul du Vrai ROI Amazon</h4>
              <p className="text-xs text-slate-500">Synthèse exacte de Juillet à Octobre 2026 (PDF Seller Central + CSV FBA + COGS)</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Chargement de l'historique...</div>
        ) : sortedChrono.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">Aucun rapport importé pour le moment.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-100/80 text-slate-700 text-xs font-extrabold border-b border-slate-200">
                  <th className="px-6 py-3.5 w-72 min-w-[260px]">Poste du Rapport Amazon</th>
                  {sortedChrono.map(r => (
                    <th key={r.period_key} className="px-4 py-3.5 text-center min-w-[140px]">
                      <div className="flex items-center justify-center gap-2">
                        <span>{r.period_label}</span>
                        <button
                          onClick={() => handleDelete(r.period_key, r.period_label)}
                          title="Supprimer ce mois"
                          className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium">
                <tr
                  onClick={() => setExpanded(p => ({ ...p, revenues: !p.revenues }))}
                  className="bg-indigo-50/50 hover:bg-indigo-100/60 cursor-pointer font-extrabold text-indigo-950"
                >
                  <td className="px-6 py-3 flex items-center gap-2">
                    <ChevronRight className={`w-4 h-4 text-indigo-600 transition-transform ${expanded.revenues ? 'rotate-90' : ''}`} />
                    <span>REVENUS TOTAUX (HT)</span>
                  </td>
                  {sortedChrono.map(r => (
                    <td key={r.period_key} className="px-4 py-3 text-center text-sm font-black text-indigo-900">
                      {formatCurrency(r.revenues_total)}
                    </td>
                  ))}
                </tr>
                {expanded.revenues && (
                  <>
                    <tr className="text-[11px] text-slate-600">
                      <td className="px-10 py-2">Vente des produits Expédié par Amazon (FBA)</td>
                      {sortedChrono.map(r => <td key={r.period_key} className="px-4 py-2 text-center font-semibold">{formatCurrency(r.product_sales)}</td>)}
                    </tr>
                    <tr className="text-[11px] text-rose-600">
                      <td className="px-10 py-2">Remboursement des produits vendus</td>
                      {sortedChrono.map(r => <td key={r.period_key} className="px-4 py-2 text-center font-semibold">{formatCurrency(r.product_refunds)}</td>)}
                    </tr>
                    <tr className="text-[11px] text-slate-600">
                      <td className="px-10 py-2">Crédit inventaire FBA</td>
                      {sortedChrono.map(r => <td key={r.period_key} className="px-4 py-2 text-center">{formatCurrency(r.fba_inventory_credit)}</td>)}
                    </tr>
                    <tr className="text-[11px] text-slate-600">
                      <td className="px-10 py-2">Crédits expédition & emballage</td>
                      {sortedChrono.map(r => <td key={r.period_key} className="px-4 py-2 text-center">{formatCurrency(r.shipping_credits)}</td>)}
                    </tr>
                    <tr className="text-[11px] text-rose-600">
                      <td className="px-10 py-2">Rabais promotionnels nets</td>
                      {sortedChrono.map(r => <td key={r.period_key} className="px-4 py-2 text-center">{formatCurrency(r.promo_rebates)}</td>)}
                    </tr>
                  </>
                )}

                <tr
                  onClick={() => setExpanded(p => ({ ...p, expenses: !p.expenses }))}
                  className="bg-rose-50/70 hover:bg-rose-100/70 cursor-pointer font-extrabold text-rose-950 border-t border-rose-200/60"
                >
                  <td className="px-6 py-3 flex items-center gap-2">
                    <ChevronRight className={`w-4 h-4 text-rose-600 transition-transform ${expanded.expenses ? 'rotate-90' : ''}`} />
                    <span>DÉPENSES & COÛTS RÉELS AMAZON</span>
                  </td>
                  {sortedChrono.map(r => (
                    <td key={r.period_key} className="px-4 py-3 text-center text-sm font-black text-rose-700">
                      {formatCurrency(r.expenses_total)}
                    </td>
                  ))}
                </tr>
                {expanded.expenses && (
                  <>
                    <tr className="text-[11px] text-slate-700">
                      <td className="px-10 py-2">Frais d'expédition FBA (Transaction)</td>
                      {sortedChrono.map(r => <td key={r.period_key} className="px-4 py-2 text-center font-semibold text-rose-600">{formatCurrency(r.fba_transaction_fees)}</td>)}
                    </tr>
                    <tr className="text-[11px] text-slate-700">
                      <td className="px-10 py-2">Coût FBA moyen par produit vendu</td>
                      {sortedChrono.map(r => {
                        const m = computeMetrics(r);
                        return <td key={r.period_key} className="px-4 py-2 text-center font-bold text-amber-700">{formatCurrency(m.avgFbaPerUnit)} / prod</td>;
                      })}
                    </tr>
                    <tr className="text-[11px] text-slate-700">
                      <td className="px-10 py-2">Frais de vente / Commission Marketplace</td>
                      {sortedChrono.map(r => <td key={r.period_key} className="px-4 py-2 text-center font-semibold text-rose-600">{formatCurrency(r.selling_fees)}</td>)}
                    </tr>
                    <tr className="text-[11px] text-slate-700 bg-amber-50/40">
                      <td className="px-10 py-2 font-bold text-amber-900">Prix de la publicité (Amazon Ads)</td>
                      {sortedChrono.map(r => <td key={r.period_key} className="px-4 py-2 text-center font-black text-amber-700">{formatCurrency(r.ad_spend)}</td>)}
                    </tr>
                    <tr className="text-[11px] text-slate-700">
                      <td className="px-10 py-2">Frais de stockage & services logistiques FBA</td>
                      {sortedChrono.map(r => <td key={r.period_key} className="px-4 py-2 text-center text-rose-600">{formatCurrency(r.storage_fees)}</td>)}
                    </tr>
                    <tr className="text-[11px] text-slate-700">
                      <td className="px-10 py-2">Frais sur les services & administratifs</td>
                      {sortedChrono.map(r => <td key={r.period_key} className="px-4 py-2 text-center text-slate-600">{formatCurrency((r.service_fees || 0) + (r.other_fees || 0))}</td>)}
                    </tr>
                  </>
                )}

                <tr
                  onClick={() => setExpanded(p => ({ ...p, taxes: !p.taxes }))}
                  className="bg-slate-50 hover:bg-slate-100 cursor-pointer font-bold text-slate-800 border-t border-slate-200/70"
                >
                  <td className="px-6 py-3 flex items-center gap-2">
                    <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${expanded.taxes ? 'rotate-90' : ''}`} />
                    <span>TAXES NETTES COLLECTÉES (TVA)</span>
                  </td>
                  {sortedChrono.map(r => (
                    <td key={r.period_key} className="px-4 py-3 text-center font-extrabold text-slate-800">
                      {formatCurrency(r.taxes_total)}
                    </td>
                  ))}
                </tr>
                {expanded.taxes && (
                  <>
                    <tr className="text-[11px] text-slate-600">
                      <td className="px-10 py-2">Taxes prélevées sur produits & expédition</td>
                      {sortedChrono.map(r => <td key={r.period_key} className="px-4 py-2 text-center">{formatCurrency(r.taxes_collected)}</td>)}
                    </tr>
                    <tr className="text-[11px] text-rose-600">
                      <td className="px-10 py-2">Taxes remboursées & TVA retenue à la source</td>
                      {sortedChrono.map(r => <td key={r.period_key} className="px-4 py-2 text-center">{formatCurrency(r.taxes_refunded)}</td>)}
                    </tr>
                  </>
                )}

                {/* SECTION CALCUL VRAI ROI */}
                <tr className="bg-slate-900 text-white font-black border-t-2 border-slate-700">
                  <td className="px-6 py-3 text-xs uppercase">
                    Coût de revient Produits (COGS à {formatCurrency(unitCogs)}/u)
                  </td>
                  {sortedChrono.map(r => {
                    const m = computeMetrics(r);
                    return (
                      <td key={r.period_key} className="px-4 py-3 text-center text-indigo-300">
                        -{formatCurrency(m.cogsTotal)} <span className="text-[10px] text-slate-400">({m.units} u)</span>
                      </td>
                    );
                  })}
                </tr>

                <tr className="bg-emerald-950 text-white font-black border-t border-emerald-800">
                  <td className="px-6 py-3.5 text-xs uppercase tracking-wider">
                    💎 BÉNÉFICE NET RÉEL & VRAI ROI AMAZON
                  </td>
                  {sortedChrono.map(r => {
                    const m = computeMetrics(r);
                    return (
                      <td key={r.period_key} className="px-4 py-3.5 text-center">
                        <div className={`text-sm font-black ${m.netProfit >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                          {formatCurrency(m.netProfit)}
                        </div>
                        <div className="text-[10px] font-bold text-emerald-400 mt-0.5">
                          ROI {m.trueRoiPct.toFixed(1)}% • Marge {m.netMarginPct.toFixed(1)}%
                        </div>
                      </td>
                    );
                  })}
                </tr>

                <tr className="bg-slate-800 text-slate-200 font-bold border-t border-slate-700">
                  <td className="px-6 py-3 text-[11px] uppercase">
                    🏦 Virement Bancaire Amazon (Dépôt)
                  </td>
                  {sortedChrono.map(r => (
                    <td key={r.period_key} className="px-4 py-3 text-center text-xs text-slate-300 font-extrabold">
                      {formatCurrency(r.transfers_total)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
