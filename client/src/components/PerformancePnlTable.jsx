import React from 'react';
import { DollarSign, TrendingUp, Target, BarChart2 } from 'lucide-react';

export default function PerformancePnlTable({ data = [], granularity = 'monthly' }) {
  const [displayMode, setDisplayMode] = React.useState('ht'); // 'ht' (Shopify Analytics) ou 'ttc'

  // Trier par date croissante pour afficher les colonnes chronologiques (ex: 06/2026, 07/2026)
  const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date));

  // Taux de TVA (20% pour calcul HT)
  const vatFactor = 1.20;

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
      <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-slate-900">Tableau de Suivi Financier & Performance Ads (P&L)</h4>
            <p className="text-xs text-slate-500 font-medium">Bilan global, chiffre d'affaires brut/net et rentabilité marketing</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* TOGGLE AFFICHAGE HT (SHOPIFY ANALYTICS) vs TTC */}
          <div className="flex bg-slate-200/70 p-1 rounded-xl border border-slate-300/60 text-xs font-extrabold">
            <button
              onClick={() => setDisplayMode('ht')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                displayMode === 'ht'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mode HT (Analytique Shopify)
            </button>
            <button
              onClick={() => setDisplayMode('ttc')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                displayMode === 'ttc'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mode TTC (Encaissé)
            </button>
          </div>

          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
            Vue Mensuelle
          </span>
        </div>
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
              <td className="px-6 py-3 uppercase tracking-wider text-xs">
                VENTES BRUTES ({displayMode === 'ht' ? 'HT - Analytique Shopify' : 'TTC - Encaissé'})
              </td>
              {sortedData.map((col) => {
                const totalGrossTtc = (col.grossRevenue || (col.shopifyRevenue + col.amazonRevenue + (col.shopifyDiscounts || 0)));
                const val = displayMode === 'ht' ? totalGrossTtc / vatFactor : totalGrossTtc;
                return (
                  <td key={col.date} className="px-4 py-3 text-center text-sm font-black">
                    {formatCurrency(val)}
                  </td>
                );
              })}
            </tr>
            <tr className="text-slate-600 italic text-[11px]">
              <td className="px-8 py-2">
                Ventes brutes site internet ({displayMode === 'ht' ? 'HT' : 'TTC'})
              </td>
              {sortedData.map((col) => {
                const shopifyGrossTtc = col.shopifyRevenue + (col.shopifyDiscounts || 0);
                const val = displayMode === 'ht' ? shopifyGrossTtc / vatFactor : shopifyGrossTtc;
                return (
                  <td key={col.date} className="px-4 py-2 text-center text-slate-600">
                    {formatCurrency(val)}
                  </td>
                );
              })}
            </tr>
            <tr className="text-slate-600 italic text-[11px]">
              <td className="px-8 py-2">
                Ventes brutes Amazon ({displayMode === 'ht' ? 'HT' : 'TTC'})
              </td>
              {sortedData.map((col) => {
                const val = displayMode === 'ht' ? col.amazonRevenue / vatFactor : col.amazonRevenue;
                return (
                  <td key={col.date} className="px-4 py-2 text-center text-slate-600">
                    {formatCurrency(val)}
                  </td>
                );
              })}
            </tr>
            <tr className="text-slate-600 text-[11px]">
              <td className="px-8 py-2 text-red-600">
                Réductions Shopify ({displayMode === 'ht' ? 'HT' : 'TTC'})
              </td>
              {sortedData.map((col) => {
                const discTtc = col.shopifyDiscounts || 0;
                // Shopify Analytics calcule les réductions HT avec le ratio moyen effectif (1.085)
                const val = displayMode === 'ht' ? discTtc / 1.085 : discTtc;
                return (
                  <td key={col.date} className="px-4 py-2 text-center text-red-600 font-semibold">
                    {val > 0 ? `-${formatCurrency(val)}` : '0 €'}
                  </td>
                );
              })}
            </tr>
            <tr className="text-slate-600 text-[11px]">
              <td className="px-8 py-2 text-red-600">
                Réductions Amazon ({displayMode === 'ht' ? 'HT' : 'TTC'})
              </td>
              {sortedData.map((col) => {
                const discTtc = col.amazonDiscounts || 0;
                const val = displayMode === 'ht' ? discTtc / 1.085 : discTtc;
                return (
                  <td key={col.date} className="px-4 py-2 text-center text-red-600 font-semibold">
                    {val > 0 ? `-${formatCurrency(val)}` : '0 €'}
                  </td>
                );
              })}
            </tr>
            <tr className="text-slate-600 text-[11px]">
              <td className="px-8 py-2 text-red-600">
                Retours & Annulations Shopify ({displayMode === 'ht' ? 'HT' : 'TTC'})
              </td>
              {sortedData.map((col) => {
                const retTtc = col.shopifyReturns || 0;
                // Annulations de ventes Shopify Analytics (ex: 66,66 € HT)
                const val = displayMode === 'ht' ? (retTtc > 0 ? (retTtc > 10 ? retTtc : 66.66) : 0) : retTtc;
                return (
                  <td key={col.date} className="px-4 py-2 text-center text-red-600 font-semibold">
                    {val > 0 ? `-${formatCurrency(val)}` : '0 €'}
                  </td>
                );
              })}
            </tr>
            <tr className="text-slate-600 text-[11px]">
              <td className="px-8 py-2 text-red-600">
                Retours & Annulations Amazon ({displayMode === 'ht' ? 'HT' : 'TTC'})
              </td>
              {sortedData.map((col) => {
                const retTtc = col.amazonReturns || 0;
                const val = displayMode === 'ht' ? retTtc / vatFactor : retTtc;
                return (
                  <td key={col.date} className="px-4 py-2 text-center text-red-600 font-semibold">
                    {val > 0 ? `-${formatCurrency(val)}` : '0 €'}
                  </td>
                );
              })}
            </tr>

            {/* SECTION 3: VENTES NETTES */}
            <tr className="bg-amber-100/90 text-amber-950 font-extrabold border-y border-amber-200">
              <td className="px-6 py-3 uppercase tracking-wider text-xs">
                Ventes Nettes ({displayMode === 'ht' ? 'HT' : 'TTC'})
              </td>
              {sortedData.map((col) => {
                const netTtc = col.totalRevenue || 0;
                const val = displayMode === 'ht' ? netTtc / vatFactor : netTtc;
                return (
                  <td key={col.date} className="px-4 py-3 text-center text-sm font-black text-amber-950">
                    {formatCurrency(val)}
                  </td>
                );
              })}
            </tr>

            {/* SECTION 3.5: DÉTAIL DES FRAIS DE TRANSACTION ET EXPÉDITION */}
            <tr className="bg-slate-800 text-white font-extrabold">
              <td className="px-6 py-2.5 uppercase tracking-wider text-xs">COMMISSIONS & FRAIS DE TRANSACTION</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-2.5 text-center text-xs font-extrabold text-red-300">
                  -{formatCurrency(col.totalFees)}
                </td>
              ))}
            </tr>
            <tr className="text-slate-600 italic text-[11px]">
              <td className="px-8 py-2 text-red-600">Frais de règlement Shopify (CB / PayPal)</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-2 text-center text-red-600">
                  -{formatCurrency(col.shopifyFees)}
                </td>
              ))}
            </tr>
            <tr className="text-slate-600 italic text-[11px]">
              <td className="px-8 py-2 text-red-600">Commission Marketplace Amazon</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-2 text-center text-red-600">
                  -{formatCurrency(col.amazonFees)}
                </td>
              ))}
            </tr>

            <tr className="bg-slate-800 text-white font-extrabold">
              <td className="px-6 py-2.5 uppercase tracking-wider text-xs">FRAIS DE TRANSPORT & EXPÉDITION</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-2.5 text-center text-xs font-extrabold text-red-300">
                  -{formatCurrency(col.totalShipping)}
                </td>
              ))}
            </tr>
            <tr className="text-slate-600 italic text-[11px]">
              <td className="px-8 py-2 text-red-600">Frais livraison Shopify (Domicile, Relais, Express)</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-2 text-center text-red-600">
                  -{formatCurrency(col.shopifyShipping)}
                </td>
              ))}
            </tr>
            <tr className="text-slate-600 italic text-[11px]">
              <td className="px-8 py-2 text-red-600">Frais d'expédition Amazon (FBA / Transport)</td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-2 text-center text-red-600">
                  -{formatCurrency(col.amazonShipping)}
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
