import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Upload,
  FileText,
  TrendingUp,
  DollarSign,
  Percent,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Landmark,
  Megaphone,
  Package
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
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('all'); // 'all' ou period_key
  const [expanded, setExpanded] = useState({
    revenues: true,
    expenses: true,
    taxes: false
  });

  const loadReports = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/amazon/reports`);
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (err) {
      console.error('Erreur chargement rapports Amazon:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setFeedback({ type: 'error', text: 'Veuillez sélectionner un fichier PDF Amazon Seller Central.' });
      return;
    }

    setUploading(true);
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
        text: `Rapport "${data.report.period_label}" importé et analysé avec succès !`
      });
      await loadReports();
      setSelectedPeriod(data.report.period_key);
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
    } finally {
      setUploading(false);
      e.target.value = '';
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

  // Trier chronologiquement (ancien -> récent) pour graphique et colonnes
  const sortedChrono = [...reports].sort((a, b) => a.period_key.localeCompare(b.period_key));

  // Données filtrées pour les KPI cards (soit cumul historique, soit mois sélectionné)
  const activeReports = selectedPeriod === 'all'
    ? sortedChrono
    : sortedChrono.filter(r => r.period_key === selectedPeriod);

  const summary = activeReports.reduce((acc, r) => {
    acc.revenues += r.revenues_total || 0;
    acc.taxes += r.taxes_total || 0;
    acc.expenses += Math.abs(r.expenses_total || 0);
    acc.adSpend += Math.abs(r.ad_spend || 0);
    acc.fbaFees += Math.abs(r.fba_transaction_fees || 0) + Math.abs(r.selling_fees || 0) + Math.abs(r.storage_fees || 0) + Math.abs(r.service_fees || 0) + Math.abs(r.other_fees || 0);
    acc.transfers += r.transfers_total || 0;
    return acc;
  }, { revenues: 0, taxes: 0, expenses: 0, adSpend: 0, fbaFees: 0, transfers: 0 });

  const totalTtc = summary.revenues + summary.taxes;
  const retentionRate = totalTtc > 0 ? (summary.transfers / totalTtc) * 100 : 0;
  const realCostRate = totalTtc > 0 ? (summary.expenses / totalTtc) * 100 : 0;
  const realAcos = summary.revenues > 0 ? (summary.adSpend / summary.revenues) * 100 : 0;
  const realRoas = summary.adSpend > 0 ? (summary.revenues / summary.adSpend) : 0;

  // Données pour graphique
  const chartData = sortedChrono.map(r => {
    const ads = Math.abs(r.ad_spend || 0);
    const totalExp = Math.abs(r.expenses_total || 0);
    const amazonFeesOnly = Math.max(0, totalExp - ads);
    return {
      name: r.period_label,
      'Virement Bancaire Net': Math.round((r.transfers_total || 0) * 100) / 100,
      'Frais Amazon & FBA': Math.round(amazonFeesOnly * 100) / 100,
      'Amazon Ads': Math.round(ads * 100) / 100,
      'CA Net HT': Math.round((r.revenues_total || 0) * 100) / 100
    };
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* HEADER + UPLOAD PDF */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-200/70">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">
              Détail Amazon Seller Central — Coûts Réels & Historique PDF
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Importez chaque mois votre rapport PDF « Résumés » Seller Central pour suivre vos frais réels FBA, Ads et virements bancaires
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* SÉLECTEUR DE MOIS */}
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

          {/* BOUTON IMPORT PDF */}
          <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold text-white transition-all shadow-xs cursor-pointer ${
            uploading ? 'bg-slate-400 cursor-wait' : 'bg-amber-600 hover:bg-amber-500'
          }`}>
            <Upload className="w-4 h-4" />
            {uploading ? 'Analyse en cours...' : 'Importer un rapport PDF'}
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleFileUpload}
              disabled={uploading}
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

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-extrabold uppercase text-slate-500">Revenus Net HT</p>
              <h4 className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(summary.revenues)}</h4>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-semibold mt-3 pt-2.5 border-t border-slate-100">
            CA TTC (avec TVA) : <b className="text-slate-800">{formatCurrency(totalTtc)}</b>
          </p>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-extrabold uppercase text-slate-500">Coût Réel Total Amazon</p>
              <h4 className="text-2xl font-black text-rose-600 mt-1">-{formatCurrency(summary.expenses)}</h4>
            </div>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-semibold mt-3 pt-2.5 border-t border-slate-100">
            Ponction sur TTC : <b className="text-rose-700">{realCostRate.toFixed(1)}%</b> (dont FBA/Com : {formatCurrency(summary.fbaFees)})
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

        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[11px] font-extrabold uppercase text-slate-500">Virement Bancaire Net</p>
              <h4 className="text-2xl font-black text-emerald-600 mt-1">{formatCurrency(summary.transfers)}</h4>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-semibold mt-3 pt-2.5 border-t border-slate-100">
            Cash conservé sur TTC : <b className="text-emerald-700">{retentionRate.toFixed(1)}%</b>
          </p>
        </div>
      </div>

      {/* GRAPHIQUE COMPARATIF MENSUEL */}
      {chartData.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
          <div className="mb-4">
            <h4 className="text-sm font-extrabold text-slate-900">Évolution Mensuelle : Revenus vs Coûts Réels & Virement Net</h4>
            <p className="text-xs text-slate-500">Visualisation de la répartition du cash Amazon mois par mois</p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} fontWeight={700} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} tickFormatter={(v) => `${v} €`} />
                <Tooltip formatter={(val) => formatCurrency(val)} />
                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 700 }} />
                <Bar dataKey="Virement Bancaire Net" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Frais Amazon & FBA" stackId="a" fill="#f43f5e" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Amazon Ads" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* TABLEAU HISTORIQUE DÉTAILLÉ DES RAPPORTS PDF */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-amber-600" />
            <div>
              <h4 className="text-sm font-extrabold text-slate-900">Historique Comparatif des Rapports PDF Seller Central</h4>
              <p className="text-xs text-slate-500">Décomposition exacte ligne par ligne de chaque relevé mensuel</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Chargement de l'historique...</div>
        ) : sortedChrono.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">Aucun rapport importé pour le moment.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[650px]">
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
                {/* SECTION REVENUS */}
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

                {/* SECTION DÉPENSES */}
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
                      <td className="px-10 py-2">Frais de transaction FBA (Logistique / Livraison)</td>
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
                      <td className="px-10 py-2">Frais sur les services (Abonnement Pro, etc.)</td>
                      {sortedChrono.map(r => <td key={r.period_key} className="px-4 py-2 text-center text-slate-600">{formatCurrency(r.service_fees)}</td>)}
                    </tr>
                    <tr className="text-[11px] text-slate-700">
                      <td className="px-10 py-2">Autres frais de transaction & administratifs</td>
                      {sortedChrono.map(r => <td key={r.period_key} className="px-4 py-2 text-center text-slate-600">{formatCurrency(r.other_fees)}</td>)}
                    </tr>
                  </>
                )}

                {/* SECTION TAXES */}
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

                {/* SECTION TRANSFERT BANCAIRE NET */}
                <tr className="bg-emerald-900 text-white font-black border-t-2 border-emerald-700">
                  <td className="px-6 py-3.5 text-xs uppercase tracking-wider">
                    🏦 VIREMENT NET SUR COMPTE BANCAIRE
                  </td>
                  {sortedChrono.map(r => {
                    const ttc = (r.revenues_total || 0) + (r.taxes_total || 0);
                    const pct = ttc > 0 ? ((r.transfers_total || 0) / ttc) * 100 : 0;
                    return (
                      <td key={r.period_key} className="px-4 py-3.5 text-center">
                        <div className="text-sm font-black text-emerald-300">{formatCurrency(r.transfers_total)}</div>
                        <div className="text-[10px] font-bold text-emerald-400/90 mt-0.5">
                          {pct.toFixed(1)}% du CA TTC
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* TACOS & POIDS COÛTS AMAZON */}
                <tr className="bg-slate-900 text-slate-200 font-bold border-t border-slate-800">
                  <td className="px-6 py-3 text-[11px] uppercase">
                    Part Coûts Amazon (Frais + Ads) / CA TTC
                  </td>
                  {sortedChrono.map(r => {
                    const ttc = (r.revenues_total || 0) + (r.taxes_total || 0);
                    const exp = Math.abs(r.expenses_total || 0);
                    const pct = ttc > 0 ? (exp / ttc) * 100 : 0;
                    const tacos = r.revenues_total > 0 ? (Math.abs(r.ad_spend || 0) / r.revenues_total) * 100 : 0;
                    return (
                      <td key={r.period_key} className="px-4 py-3 text-center text-[11px]">
                        <span className="text-rose-300 font-extrabold">{pct.toFixed(1)}%</span>
                        <span className="text-slate-500 mx-1.5">|</span>
                        <span className="text-amber-300 font-bold">TACOS {tacos.toFixed(1)}%</span>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
