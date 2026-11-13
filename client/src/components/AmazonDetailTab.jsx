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
  Megaphone,
  FileSpreadsheet,
  RefreshCw,
  ArrowRightLeft,
  TrendingUp,
  Tag
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
    taxes: false
  });

  const loadReports = async () => {
    setLoading(true);
    try {
      const repRes = await authFetch(`${API_BASE}/amazon/reports`);
      if (repRes.ok) {
        const data = await repRes.json();
        setReports(data);
        const targetPeriod = selectedPeriod !== 'all' ? selectedPeriod : (data[0]?.period_key || '2026-10');
        if (targetPeriod) {
          loadReconciliation(targetPeriod);
        }
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
        text: `CSV "${file.name}" importé : ${data.count} transactions analysées pour ${data.periodKey} !`
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

  const handleSaveAdSales = async (periodKey, val) => {
    try {
      const res = await authFetch(`${API_BASE}/amazon/reports/${periodKey}/ad-sales`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad_attributed_sales: parseFloat(val) || 0 })
      });
      if (res.ok) {
        setReports(prev => prev.map(r => r.period_key === periodKey ? { ...r, ad_attributed_sales: parseFloat(val) || 0 } : r));
      }
    } catch (err) {
      console.error(err);
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

  // Calcul du Bénéfice Net Amazon (hors COGS) : Revenus Net HT - Toutes Dépenses Amazon (Rabais déjà déduits, FBA, Com, Stockage, Ads, Services)
  const computeMetrics = (r) => {
    const revenuesHt = r.revenues_total || 0;
    const taxes = r.taxes_total || 0;
    const totalTtc = revenuesHt + taxes;
    const amazonExpenses = Math.abs(r.expenses_total || 0);
    const adSpend = Math.abs(r.ad_spend || 0);
    const fbaFees = Math.abs(r.csv_fba_fees || r.fba_transaction_fees || 0);
    const storageFees = Math.abs(r.storage_fees || 0);
    const units = r.csv_units > 0 ? r.csv_units : Math.round(revenuesHt / 33.33);
    const orders = r.csv_orders > 0 ? r.csv_orders : units;

    // Commission FBA globale (hors pubs ads et transport)
    // Regroupe tous les autres frais Amazon : frais de vente (commission marketplace), stockage, abonnement et autres services
    const globalFbaCommission = Math.max(0, amazonExpenses - adSpend - fbaFees);
    const globalFbaCommissionPct = revenuesHt > 0 ? (globalFbaCommission / revenuesHt) * 100 : 0;
    const globalFbaCommissionPerUnit = units > 0 ? globalFbaCommission / units : 0;

    const netBenefit = revenuesHt - amazonExpenses;
    const benefitPerUnit = units > 0 ? netBenefit / units : 0;
    const netMarginPct = revenuesHt > 0 ? (netBenefit / revenuesHt) * 100 : 0;
    const avgFbaPerUnit = units > 0 ? fbaFees / units : 0;
    const fbaCostPct = revenuesHt > 0 ? (fbaFees / revenuesHt) * 100 : 0;

    const tacosPct = revenuesHt > 0 ? (adSpend / revenuesHt) * 100 : 0;
    const adAttributedSales = r.ad_attributed_sales || 0;
    const acosPct = adAttributedSales > 0 ? (adSpend / adAttributedSales) * 100 : 0;

    return {
      revenuesHt,
      taxes,
      totalTtc,
      amazonExpenses,
      adSpend,
      fbaFees,
      storageFees,
      units,
      orders,
      globalFbaCommission,
      globalFbaCommissionPct,
      globalFbaCommissionPerUnit,
      netBenefit,
      benefitPerUnit,
      netMarginPct,
      avgFbaPerUnit,
      fbaCostPct,
      tacosPct,
      adAttributedSales,
      acosPct,
      transfers: r.transfers_total || 0
    };
  };

  const summary = activeReports.reduce((acc, r) => {
    const m = computeMetrics(r);
    acc.revenues += m.revenuesHt;
    acc.taxes += m.taxes;
    acc.expenses += m.amazonExpenses;
    acc.adSpend += m.adSpend;
    acc.adAttributedSales += m.adAttributedSales;
    acc.fbaFees += m.fbaFees;
    acc.globalFbaCommission += m.globalFbaCommission;
    acc.units += m.units;
    acc.orders += m.orders;
    acc.netBenefit += m.netBenefit;
    acc.transfers += m.transfers;
    return acc;
  }, {
    revenues: 0, taxes: 0, expenses: 0, adSpend: 0, adAttributedSales: 0,
    fbaFees: 0, globalFbaCommission: 0, units: 0, orders: 0, netBenefit: 0, transfers: 0
  });

  const totalTtc = summary.revenues + summary.taxes;
  const benefitPerUnitGlobal = summary.units > 0 ? summary.netBenefit / summary.units : 0;
  const netMarginPct = summary.revenues > 0 ? (summary.netBenefit / summary.revenues) * 100 : 0;
  const realCostRate = summary.revenues > 0 ? (summary.expenses / summary.revenues) * 100 : 0;
  const globalFbaCommissionPct = summary.revenues > 0 ? (summary.globalFbaCommission / summary.revenues) * 100 : 0;
  const globalFbaCommissionPerUnit = summary.units > 0 ? summary.globalFbaCommission / summary.units : 0;
  const fbaCostGlobalPct = summary.revenues > 0 ? (summary.fbaFees / summary.revenues) * 100 : 0;
  const tacosGlobal = summary.revenues > 0 ? (summary.adSpend / summary.revenues) * 100 : 0;
  const acosGlobal = summary.adAttributedSales > 0 ? (summary.adSpend / summary.adAttributedSales) * 100 : 0;
  const realRoas = summary.adSpend > 0 ? (summary.revenues / summary.adSpend) : 0;

  const chartData = sortedChrono.map(r => {
    const m = computeMetrics(r);
    return {
      name: r.period_label,
      'Bénéfice Net Amazon': Math.round(m.netBenefit * 100) / 100,
      'Commission FBA globale': Math.round(m.globalFbaCommission * 100) / 100,
      'Transport FBA': Math.round(m.fbaFees * 100) / 100,
      'Amazon Ads': Math.round(m.adSpend * 100) / 100
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
              Détail Amazon Seller Central — Bénéfice Net / Produit, ACOS & TACOS
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Gain net réel après déduction de toutes les dépenses Amazon (rabais, ads, expédition FBA, commissions, stockage) — hors COGS
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

      {/* KPI CARDS : REVENUS, DÉPENSES, COMMISSION FBA GLOBALE, ACOS/TACOS & BÉNÉFICE PAR PRODUIT */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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
              <p className="text-[11px] font-extrabold uppercase text-slate-500">Dépenses Totales Amazon</p>
              <h4 className="text-2xl font-black text-rose-600 mt-1">-{formatCurrency(summary.expenses)}</h4>
            </div>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-semibold mt-3 pt-2.5 border-t border-slate-100">
            Poids sur CA HT : <b className="text-rose-700">{realCostRate.toFixed(1)}%</b> (FBA, Com, Ads, Stock)
          </p>
        </div>

        {/* NOUVELLE CARTE : COMMISSION FBA GLOBALE (HORS PUBS ADS ET TRANSPORT) */}
        <div className="bg-white border-2 border-indigo-300 rounded-2xl p-5 shadow-xs relative overflow-hidden bg-gradient-to-br from-indigo-50/50 via-white to-white">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-black uppercase text-indigo-700 tracking-wide">
                Commission FBA Globale
              </p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <h4 className="text-2xl font-black text-indigo-900">{globalFbaCommissionPct.toFixed(1)}%</h4>
                <span className="text-[11px] font-bold text-indigo-600">du CA HT</span>
              </div>
            </div>
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[11px] text-slate-700 font-bold mt-3 pt-2.5 border-t border-indigo-100 flex items-center justify-between">
            <span>Total : <b className="text-indigo-900">-{formatCurrency(summary.globalFbaCommission)}</b></span>
            <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md font-black">
              {formatCurrency(globalFbaCommissionPerUnit)} / prod
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-medium mt-1.5 leading-tight">
            Hors pubs ads & transport (frais de vente, stockage, services)
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-extrabold uppercase text-slate-500">Amazon Ads — TACOS & ACOS</p>
              <div className="flex items-baseline gap-2 mt-1">
                <h4 className="text-2xl font-black text-amber-600">-{formatCurrency(summary.adSpend)}</h4>
              </div>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
              <Megaphone className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[11px] text-slate-600 font-semibold mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
            <span>TACOS : <b className="text-amber-700">{tacosGlobal.toFixed(1)}%</b></span>
            <span>ACOS : <b className="text-indigo-700">{acosGlobal > 0 ? `${acosGlobal.toFixed(1)}%` : '—'}</b></span>
            <span>ROAS : <b className="text-slate-800">{realRoas.toFixed(2)}x</b></span>
          </div>
        </div>

        <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-5 shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-extrabold uppercase text-emerald-400">Bénéfice par Produit (Hors COGS)</p>
              <div className="flex items-baseline gap-2 mt-1">
                <h4 className={`text-2xl font-black ${benefitPerUnitGlobal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatCurrency(benefitPerUnitGlobal)}
                </h4>
                <span className="text-xs font-bold text-slate-400">/ prod</span>
              </div>
            </div>
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-[11px] text-slate-300 font-semibold mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between">
            <span>Total net : <b className="text-emerald-400">{formatCurrency(summary.netBenefit)}</b></span>
            <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-black">
              Marge {netMarginPct.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* DÉCOMPOSITION COMPLÈTE DU CA HT AMAZON (100%) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-extrabold text-slate-900">
              Décomposition du Revenu Net HT Amazon (100%) :
            </span>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            CA Net HT analysé : <b className="text-slate-800">{formatCurrency(summary.revenues)}</b>
          </span>
        </div>
        <div className="w-full bg-slate-100 rounded-xl h-4 overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${Math.min(100, Math.max(0, globalFbaCommissionPct))}%` }}
            className="bg-indigo-600 transition-all"
            title={`Commission FBA globale (hors pub et transport) : ${globalFbaCommissionPct.toFixed(1)}% (-${formatCurrency(summary.globalFbaCommission)})`}
          />
          <div
            style={{ width: `${Math.min(100, Math.max(0, fbaCostGlobalPct))}%` }}
            className="bg-rose-500 transition-all"
            title={`Transport FBA : ${fbaCostGlobalPct.toFixed(1)}% (-${formatCurrency(summary.fbaFees)})`}
          />
          <div
            style={{ width: `${Math.min(100, Math.max(0, tacosGlobal))}%` }}
            className="bg-amber-500 transition-all"
            title={`Amazon Ads (TACOS) : ${tacosGlobal.toFixed(1)}% (-${formatCurrency(summary.adSpend)})`}
          />
          <div
            style={{ width: `${Math.min(100, Math.max(0, netMarginPct))}%` }}
            className="bg-emerald-500 transition-all"
            title={`Bénéfice Net restant : ${netMarginPct.toFixed(1)}% (${formatCurrency(summary.netBenefit)})`}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-md bg-indigo-600 shrink-0" />
            <div>
              <span className="text-slate-500 font-medium">Commission FBA globale :</span>{' '}
              <b className="text-indigo-900 font-black">{globalFbaCommissionPct.toFixed(1)}%</b>{' '}
              <span className="text-[11px] text-slate-400">(-{formatCurrency(summary.globalFbaCommission)})</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-md bg-rose-500 shrink-0" />
            <div>
              <span className="text-slate-500 font-medium">Transport FBA :</span>{' '}
              <b className="text-rose-700 font-black">{fbaCostGlobalPct.toFixed(1)}%</b>{' '}
              <span className="text-[11px] text-slate-400">(-{formatCurrency(summary.fbaFees)})</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-md bg-amber-500 shrink-0" />
            <div>
              <span className="text-slate-500 font-medium">Amazon Ads (TACOS) :</span>{' '}
              <b className="text-amber-700 font-black">{tacosGlobal.toFixed(1)}%</b>{' '}
              <span className="text-[11px] text-slate-400">(-{formatCurrency(summary.adSpend)})</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-md bg-emerald-500 shrink-0" />
            <div>
              <span className="text-slate-500 font-medium">Bénéfice Net (Hors COGS) :</span>{' '}
              <b className="text-emerald-700 font-black">{netMarginPct.toFixed(1)}%</b>{' '}
              <span className="text-[11px] text-slate-400">({formatCurrency(summary.netBenefit)})</span>
            </div>
          </div>
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

      {/* GRAPHIQUE COMPARATIF MENSUEL (BÉNÉFICE NET VS COÛTS AMAZON) */}
      {chartData.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
          <div className="mb-4">
            <h4 className="text-sm font-extrabold text-slate-900">Évolution Mensuelle : Bénéfice Net Amazon vs Frais & Publicité</h4>
            <p className="text-xs text-slate-500">Répartition exacte de chaque euro de Revenu Net HT (hors COGS)</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} fontWeight={700} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} tickFormatter={(v) => `${v} €`} />
                <Tooltip formatter={(val) => formatCurrency(val)} />
                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 700 }} />
                <Bar dataKey="Bénéfice Net Amazon" stackId="a" fill="#10b981" />
                <Bar dataKey="Commission FBA globale" stackId="a" fill="#6366f1" />
                <Bar dataKey="Transport FBA" stackId="a" fill="#f43f5e" />
                <Bar dataKey="Amazon Ads" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* TABLEAU HISTORIQUE DÉTAILLÉ DES RAPPORTS PDF + BÉNÉFICE PAR PRODUIT, TACOS & ACOS */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-amber-600" />
            <div>
              <h4 className="text-sm font-extrabold text-slate-900">Historique Mensuel — Bénéfice par Produit, ACOS & TACOS</h4>
              <p className="text-xs text-slate-500">Synthèse exacte après déduction de toutes les dépenses Amazon (hors COGS)</p>
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
                    <span>REVENUS NETS HT (Après rabais/retours)</span>
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
                    <span>DÉPENSES TOTALES AMAZON</span>
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

                {/* SYNTHÈSE DES 3 COMPOSANTES COÛTS : COMMISSION FBA GLOBALE, TRANSPORT & ADS */}
                <tr className="bg-gradient-to-r from-indigo-100/90 via-indigo-50/80 to-white font-black border-t-2 border-indigo-300 text-indigo-950">
                  <td className="px-6 py-3.5 text-xs uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Percent className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div>
                        <div className="font-black text-indigo-950 text-xs">
                          🏷️ Commission FBA globale (hors pubs ads et transport)
                        </div>
                        <div className="text-[10px] font-medium text-slate-500 normal-case mt-0.5">
                          Regroupe tous les autres frais Amazon (commission de vente, stockage, services)
                        </div>
                      </div>
                    </div>
                  </td>
                  {sortedChrono.map(r => {
                    const m = computeMetrics(r);
                    return (
                      <td key={r.period_key} className="px-4 py-3.5 text-center bg-indigo-50/40">
                        <div className="inline-block px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-black text-xs shadow-xs">
                          {m.globalFbaCommissionPct.toFixed(1)} %
                        </div>
                        <div className="text-[11px] font-extrabold text-indigo-950 mt-1">
                          -{formatCurrency(m.globalFbaCommission)}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-500">
                          ({formatCurrency(m.globalFbaCommissionPerUnit)} / prod)
                        </div>
                      </td>
                    );
                  })}
                </tr>

                <tr className="text-xs bg-slate-50/80 font-bold text-slate-700 border-t border-slate-200/80">
                  <td className="px-10 py-2.5 flex items-center justify-between">
                    <span className="text-slate-600">↳ Coût Transport FBA (Expédié par Amazon)</span>
                    <span className="text-[10px] font-semibold text-slate-400">Poids sur CA HT</span>
                  </td>
                  {sortedChrono.map(r => {
                    const m = computeMetrics(r);
                    return (
                      <td key={r.period_key} className="px-4 py-2.5 text-center">
                        <span className="font-extrabold text-rose-700">{m.fbaCostPct.toFixed(1)} %</span>
                        <span className="text-[10px] text-slate-500 ml-1.5">(-{formatCurrency(m.fbaFees)})</span>
                      </td>
                    );
                  })}
                </tr>

                <tr className="text-xs bg-slate-50/80 font-bold text-slate-700 border-t border-slate-200/80">
                  <td className="px-10 py-2.5 flex items-center justify-between">
                    <span className="text-amber-800">↳ Coût Amazon Ads (TACOS)</span>
                    <span className="text-[10px] font-semibold text-slate-400">Poids sur CA HT</span>
                  </td>
                  {sortedChrono.map(r => {
                    const m = computeMetrics(r);
                    return (
                      <td key={r.period_key} className="px-4 py-2.5 text-center">
                        <span className="font-extrabold text-amber-700">{m.tacosPct.toFixed(1)} %</span>
                        <span className="text-[10px] text-slate-500 ml-1.5">(-{formatCurrency(m.adSpend)})</span>
                      </td>
                    );
                  })}
                </tr>

                {/* BÉNÉFICE NET GLOBAL (HORS COGS) */}
                <tr className="bg-emerald-950 text-white font-black border-t-2 border-emerald-800">
                  <td className="px-6 py-3.5 text-xs uppercase tracking-wider">
                    💎 BÉNÉFICE NET AMAZON (Hors COGS)
                  </td>
                  {sortedChrono.map(r => {
                    const m = computeMetrics(r);
                    return (
                      <td key={r.period_key} className="px-4 py-3.5 text-center">
                        <div className={`text-sm font-black ${m.netBenefit >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                          {formatCurrency(m.netBenefit)}
                        </div>
                        <div className="text-[10px] font-bold text-emerald-400 mt-0.5">
                          Marge {m.netMarginPct.toFixed(1)}% ({m.units} prod.)
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* BÉNÉFICE PAR PRODUIT VENDU */}
                <tr className="bg-slate-900 text-white font-black border-t border-slate-800">
                  <td className="px-6 py-3.5 text-xs uppercase tracking-wider text-emerald-400">
                    📦 BÉNÉFICE PAR PRODUIT VENDU
                  </td>
                  {sortedChrono.map(r => {
                    const m = computeMetrics(r);
                    return (
                      <td key={r.period_key} className="px-4 py-3.5 text-center">
                        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-sm font-black">
                          {formatCurrency(m.benefitPerUnit)} / prod
                        </span>
                      </td>
                    );
                  })}
                </tr>

                {/* TACOS & ACOS */}
                <tr className="bg-slate-900 text-slate-200 font-bold border-t border-slate-800">
                  <td className="px-6 py-3 text-xs uppercase">
                    📣 TACOS & ACOS
                  </td>
                  {sortedChrono.map(r => {
                    const m = computeMetrics(r);
                    return (
                      <td key={r.period_key} className="px-4 py-3 text-center text-xs space-y-1.5">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-amber-300 font-extrabold">TACOS : {m.tacosPct.toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center justify-center gap-1 text-[11px]">
                          <span className="text-indigo-300 font-bold">
                            ACOS : {m.acosPct > 0 ? `${m.acosPct.toFixed(1)}%` : '—'}
                          </span>
                        </div>
                        <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
                          <span>CA Ads (€):</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="CA Pub"
                            defaultValue={r.ad_attributed_sales || ''}
                            onBlur={(e) => handleSaveAdSales(r.period_key, e.target.value)}
                            className="w-16 bg-slate-800 border border-slate-700 rounded px-1 py-0.5 text-center text-white text-[10px] font-bold"
                            title="Saisir le CA attribué aux annonces (Campaign Manager) pour calculer l'ACOS exact"
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* VIREMENT BANCAIRE */}
                <tr className="bg-slate-800 text-slate-300 font-bold border-t border-slate-700">
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
