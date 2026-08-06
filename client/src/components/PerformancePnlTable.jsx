import React from 'react';
import { DollarSign, TrendingUp, Target, BarChart2 } from 'lucide-react';

export default function PerformancePnlTable({ data = [], granularity = 'monthly' }) {
  // Trier par date croissante pour afficher les colonnes chronologiques (ex: 06/2026, 07/2026)
  const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date));

  const formatCurrency = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '0 €';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(val);
  };

  const formatNumber = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '0';
    return new Intl.NumberFormat('fr-FR').format(val);
  };

  const formatDateHeader = (dateStr) => {
    if (!dateStr) return '';
    try {
      if (granularity === 'monthly') {
        const parts = dateStr.split('-');
        if (parts.length === 2) return `${parts[1]}/${parts[0]}`;
      }
      if (granularity === 'weekly') return `Sem. ${dateStr.replace(/^.*-W/, '')}`;
      if (granularity === 'yearly') return dateStr;
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  if (sortedData.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden mb-8">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-slate-900">Tableau de Suivi Financier & Performance Ads (P&L)</h4>
            <p className="text-xs text-slate-500 font-medium">Bilan global, chiffre d'affaires brut/net et rentabilité marketing</p>
          </div>
        </div>
        <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
          Vue {granularity === 'daily' ? 'Quotidienne' : granularity === 'weekly' ? 'Hebdomadaire' : granularity === 'monthly' ? 'Mensuelle' : 'Annuelle'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-slate-100/80 text-slate-700 text-xs font-extrabold border-b border-slate-200">
              <th className="px-6 py-3.5 w-64 min-w-[240px] bg-slate-100">Indicateurs</th>
              {sortedData.map((col) => (
                <th key={col.date} className="px-4 py-3.5 text-center font-extrabold min-w-[120px]">
                  {formatDateHeader(col.date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-medium">
            {/* SECTION 1: JEUX VENDUS */}
            <tr className="bg-slate-50/40">
              <td className="px-6 py-2.5 font-bold text-slate-900">Jeux vendus Global</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-2.5 text-center font-extrabold text-slate-900">
                  {formatNumber(col.totalSalesCount)}
                </td>
              ))}
            </tr>
            <tr className="text-slate-600 italic text-[11px]">
              <td className="px-8 py-2">Jeux vendus Site internet</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-2 text-center text-slate-600">
                  {formatNumber(col.shopifySalesCount)}
                </td>
              ))}
            </tr>
            <tr className="text-slate-600 italic text-[11px]">
              <td className="px-8 py-2">Jeux vendus Amazon</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-2 text-center text-slate-600">
                  {formatNumber(col.amazonSalesCount)}
                </td>
              ))}
            </tr>

            {/* SECTION 2: VENTES BRUTES */}
            <tr className="bg-slate-900 text-white font-extrabold">
              <td className="px-6 py-3 uppercase tracking-wider text-xs">VENTES BRUTES (TTC)</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-3 text-center text-sm font-black">
                  {formatCurrency(col.grossRevenue || (col.shopifyRevenue + col.amazonRevenue + (col.shopifyDiscounts || 0)))}
                </td>
              ))}
            </tr>
            <tr className="text-slate-600 italic text-[11px]">
              <td className="px-8 py-2">Ventes brutes site internet (TTC)</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-2 text-center text-slate-600">
                  {formatCurrency(col.shopifyRevenue + (col.shopifyDiscounts || 0))}
                </td>
              ))}
            </tr>
            <tr className="text-slate-600 italic text-[11px]">
              <td className="px-8 py-2">Ventes brutes Amazon (TTC)</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-2 text-center text-slate-600">
                  {formatCurrency(col.amazonRevenue)}
                </td>
              ))}
            </tr>
            <tr className="text-slate-600 text-[11px]">
              <td className="px-8 py-2 text-red-600">Réductions Shopify</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-2 text-center text-red-600 font-semibold">
                  {col.shopifyDiscounts > 0 ? `-${formatCurrency(col.shopifyDiscounts)}` : '0 €'}
                </td>
              ))}
            </tr>
            <tr className="text-slate-600 text-[11px]">
              <td className="px-8 py-2 text-red-600">Réductions Amazon</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-2 text-center text-red-600 font-semibold">
                  {col.amazonDiscounts > 0 ? `-${formatCurrency(col.amazonDiscounts)}` : '0 €'}
                </td>
              ))}
            </tr>
            <tr className="text-slate-600 text-[11px]">
              <td className="px-8 py-2 text-red-600">Retours Shopify</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-2 text-center text-red-600 font-semibold">
                  {col.shopifyReturns > 0 ? `-${formatCurrency(col.shopifyReturns)}` : '0 €'}
                </td>
              ))}
            </tr>
            <tr className="text-slate-600 text-[11px]">
              <td className="px-8 py-2 text-red-600">Retours Amazon</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-2 text-center text-red-600 font-semibold">
                  {col.amazonReturns > 0 ? `-${formatCurrency(col.amazonReturns)}` : '0 €'}
                </td>
              ))}
            </tr>

            {/* SECTION 3: VENTES NETTES */}
            <tr className="bg-amber-100/90 text-amber-950 font-extrabold border-y border-amber-200">
              <td className="px-6 py-3 uppercase tracking-wider text-xs">Ventes Nettes (TTC)</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-3 text-center text-sm font-black text-amber-950">
                  {formatCurrency(col.totalRevenue)}
                </td>
              ))}
            </tr>

            {/* SECTION 4: DÉPENSES ADS */}
            <tr className="bg-slate-700 text-white font-extrabold">
              <td className="px-6 py-2.5 uppercase tracking-wider text-xs">Dépenses Ads</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-2.5 text-center text-xs font-extrabold text-amber-300">
                  {formatCurrency(col.totalAdsSpend)}
                </td>
              ))}
            </tr>
            <tr className="text-slate-700 text-[11px]">
              <td className="px-8 py-2">Facebook</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-2 text-center text-slate-700">
                  {formatCurrency(col.facebookAds)}
                </td>
              ))}
            </tr>
            <tr className="text-slate-700 text-[11px]">
              <td className="px-8 py-2">Google</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-2 text-center text-slate-700">
                  {formatCurrency(col.googleAds)}
                </td>
              ))}
            </tr>
            <tr className="text-slate-700 text-[11px]">
              <td className="px-8 py-2">Amazon</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-2 text-center text-slate-700 font-semibold">
                  {formatCurrency(col.amazonAds)}
                </td>
              ))}
            </tr>

            {/* SECTION 5: ROAS & CPA */}
            <tr className="bg-slate-50 font-black border-t border-slate-200">
              <td className="px-6 py-3 font-black text-slate-900 text-xs uppercase">ROAS</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-3 text-center">
                  <span className={`px-2.5 py-0.5 rounded-full font-black text-xs ${
                    col.roas >= 4 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                    col.roas >= 2 ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                    'bg-slate-200 text-slate-700'
                  }`}>
                    {col.roas ? col.roas.toFixed(2) : '0.00'}
                  </span>
                </td>
              ))}
            </tr>
            <tr className="bg-slate-50 font-black border-t border-slate-200">
              <td className="px-6 py-3 font-black text-slate-900 text-xs uppercase">CPA</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-3 text-center text-slate-900 font-extrabold text-xs">
                  {col.cpa ? formatCurrency(col.cpa) : '0 €'}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
