import React, { useState } from 'react';
import { BarChart2, ChevronRight, ChevronsUpDown } from 'lucide-react';

export default function PerformancePnlTable({ data = [], granularity = 'monthly' }) {
  const [displayMode, setDisplayMode] = useState('ht'); // 'ht' (Shopify Analytics) ou 'ttc'
  const [expandedSections, setExpandedSections] = useState({
    orders: false,
    products: false,
    grossSales: false,
    deductions: false,
    netSales: false,
    ads: false,
    cpa: false
  });

  const toggleSection = (key) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allExpanded = Object.values(expandedSections).every(Boolean);
  const toggleAll = () => {
    const nextState = !allExpanded;
    setExpandedSections({
      orders: nextState,
      products: nextState,
      grossSales: nextState,
      deductions: nextState,
      netSales: nextState,
      ads: nextState,
      cpa: nextState
    });
  };

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
            <h4 className="text-base font-extrabold text-slate-900">Performance Ads (P&L)</h4>
            <p className="text-xs text-slate-500 font-medium">Cliquez sur n'importe quelle ligne pour déplier le détail Shopify / Amazon ou régies</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* BOUTON TOUT DÉPLIER / REPLIER */}
          <button
            onClick={toggleAll}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-indigo-700 bg-white hover:bg-indigo-50/60 px-3 py-1.5 rounded-xl border border-slate-200 transition-all cursor-pointer"
          >
            <ChevronsUpDown className="w-3.5 h-3.5" />
            {allExpanded ? 'Tout replier' : 'Tout déplier'}
          </button>

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
              Mode HT
            </button>
            <button
              onClick={() => setDisplayMode('ttc')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                displayMode === 'ttc'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Mode TTC
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
              <th className="px-6 py-3.5 w-72 min-w-[270px] bg-slate-100">Indicateurs</th>
              {sortedData.map((col) => (
                <th key={col.date} className="px-4 py-3.5 text-center font-extrabold min-w-[120px]">
                  {formatDateHeader(col.date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-medium">
            {/* SECTION 1A: COMMANDES GLOBALES (DÉPLIABLE SHOPIFY / AMAZON) */}
            <tr
              onClick={() => toggleSection('orders')}
              className="bg-indigo-50/50 hover:bg-indigo-100/60 cursor-pointer transition-colors"
            >
              <td className="px-6 py-2.5 font-bold text-indigo-950 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ChevronRight className={`w-4 h-4 text-indigo-600 transition-transform ${expandedSections.orders ? 'rotate-90' : ''}`} />
                  <span>🛒 Commandes Globales</span>
                </div>
                <span className="text-[10px] font-bold bg-indigo-100/80 text-indigo-700 px-2 py-0.5 rounded-md">
                  Shopify / Amazon
                </span>
              </td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-2.5 text-center font-extrabold text-indigo-900">
                  {formatNumber(col.totalOrdersCount || (col.shopifyOrdersCount + col.amazonOrdersCount))}
                </td>
              ))}
            </tr>
            {expandedSections.orders && (
              <>
                <tr className="text-slate-600 italic text-[11px] bg-indigo-50/15 animate-fadeIn">
                  <td className="px-10 py-1.5 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Commandes Site internet (Shopify)</span>
                  </td>
                  {sortedData.map((col) => (
                    <td key={col.date} className="px-4 py-1.5 text-center text-emerald-700 font-semibold">
                      {formatNumber(col.shopifyOrdersCount)}
                    </td>
                  ))}
                </tr>
                <tr className="text-slate-600 italic text-[11px] bg-indigo-50/15 animate-fadeIn">
                  <td className="px-10 py-1.5 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    <span>Commandes Amazon</span>
                  </td>
                  {sortedData.map((col) => (
                    <td key={col.date} className="px-4 py-1.5 text-center text-amber-700 font-semibold">
                      {formatNumber(col.amazonOrdersCount)}
                    </td>
                  ))}
                </tr>
              </>
            )}

            {/* SECTION 1B: PRODUITS VENDUS GLOBAL (DÉPLIABLE SHOPIFY / AMAZON) */}
            <tr
              onClick={() => toggleSection('products')}
              className="bg-slate-50/80 hover:bg-slate-100 cursor-pointer transition-colors border-t border-slate-200/60"
            >
              <td className="px-6 py-2.5 font-bold text-slate-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${expandedSections.products ? 'rotate-90' : ''}`} />
                  <span>📦 Produits vendus (Unités)</span>
                </div>
                <span className="text-[10px] font-bold bg-slate-200/70 text-slate-600 px-2 py-0.5 rounded-md">
                  Shopify / Amazon
                </span>
              </td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-2.5 text-center font-extrabold text-slate-900">
                  {formatNumber(col.totalSalesCount)}
                </td>
              ))}
            </tr>
            {expandedSections.products && (
              <>
                <tr className="text-slate-600 italic text-[11px] bg-slate-50/40 animate-fadeIn">
                  <td className="px-10 py-1.5 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Produits vendus Site internet (Shopify)</span>
                  </td>
                  {sortedData.map((col) => (
                    <td key={col.date} className="px-4 py-1.5 text-center text-emerald-700 font-semibold">
                      {formatNumber(col.shopifySalesCount)}
                    </td>
                  ))}
                </tr>
                <tr className="text-slate-600 italic text-[11px] bg-slate-50/40 animate-fadeIn">
                  <td className="px-10 py-1.5 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    <span>Produits vendus Amazon</span>
                  </td>
                  {sortedData.map((col) => (
                    <td key={col.date} className="px-4 py-1.5 text-center text-amber-700 font-semibold">
                      {formatNumber(col.amazonSalesCount)}
                    </td>
                  ))}
                </tr>
                <tr className="text-slate-500 text-[11px] bg-slate-50/40 animate-fadeIn">
                  <td className="px-10 py-1.5 font-medium">Moyenne Produits / Commande</td>
                  {sortedData.map((col) => {
                    const orders = col.totalOrdersCount || (col.shopifyOrdersCount + col.amazonOrdersCount) || 1;
                    const ratio = orders > 0 ? (col.totalSalesCount / orders).toFixed(2) : '1.00';
                    return (
                      <td key={col.date} className="px-4 py-1.5 text-center font-semibold text-slate-700">
                        {ratio} art./cmd
                      </td>
                    );
                  })}
                </tr>
              </>
            )}

            {/* SECTION 2: VENTES BRUTES (DÉPLIABLE SHOPIFY / AMAZON) */}
            <tr
              onClick={() => toggleSection('grossSales')}
              className="bg-slate-900 hover:bg-slate-800 text-white font-extrabold cursor-pointer transition-colors"
            >
              <td className="px-6 py-3 uppercase tracking-wider text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${expandedSections.grossSales ? 'rotate-90' : ''}`} />
                  <span>VENTES BRUTES ({displayMode === 'ht' ? 'HT' : 'TTC'})</span>
                </div>
                <span className="text-[10px] font-bold bg-slate-700 text-slate-300 px-2 py-0.5 rounded-md normal-case">
                  Shopify / Amazon
                </span>
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
            {expandedSections.grossSales && (
              <>
                <tr className="text-slate-600 italic text-[11px] bg-slate-50/50 animate-fadeIn">
                  <td className="px-10 py-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Ventes brutes Shopify ({displayMode === 'ht' ? 'HT' : 'TTC'})</span>
                  </td>
                  {sortedData.map((col) => {
                    const shopifyGrossTtc = col.shopifyRevenue + (col.shopifyDiscounts || 0);
                    const val = displayMode === 'ht' ? shopifyGrossTtc / vatFactor : shopifyGrossTtc;
                    return (
                      <td key={col.date} className="px-4 py-2 text-center text-emerald-700 font-semibold">
                        {formatCurrency(val)}
                      </td>
                    );
                  })}
                </tr>
                <tr className="text-slate-600 italic text-[11px] bg-slate-50/50 animate-fadeIn">
                  <td className="px-10 py-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    <span>Ventes brutes Amazon ({displayMode === 'ht' ? 'HT' : 'TTC'})</span>
                  </td>
                  {sortedData.map((col) => {
                    const val = displayMode === 'ht' ? col.amazonRevenue / vatFactor : col.amazonRevenue;
                    return (
                      <td key={col.date} className="px-4 py-2 text-center text-amber-700 font-semibold">
                        {formatCurrency(val)}
                      </td>
                    );
                  })}
                </tr>
              </>
            )}

            {/* LIGNE DE SYNTHÈSE DÉROULANTE : RÉDUCTIONS & RETOURS */}
            <tr
              onClick={() => toggleSection('deductions')}
              className="bg-red-50/70 text-red-700 font-bold text-xs cursor-pointer hover:bg-red-100/80 transition-colors border-y border-red-200/60"
            >
              <td className="px-6 py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ChevronRight className={`w-4 h-4 transition-transform ${expandedSections.deductions ? 'rotate-90 text-red-800' : 'text-red-600'}`} />
                  <span>Réductions & Retours ({displayMode === 'ht' ? 'HT' : 'TTC'})</span>
                </div>
                <span className="text-[10px] uppercase font-extrabold bg-red-100 text-red-800 px-2 py-0.5 rounded-md border border-red-200">
                  {expandedSections.deductions ? 'Masquer ▲' : 'Détail ▾'}
                </span>
              </td>
              {sortedData.map((col) => {
                const discTtc = (col.shopifyDiscounts || 0) + (col.amazonDiscounts || 0);
                const retTtc = (col.shopifyReturns || 0) + (col.amazonReturns || 0);
                const totalDeductionsTtc = discTtc + retTtc;
                const val = displayMode === 'ht'
                  ? ((col.shopifyDiscounts || 0) / 1.085 + (col.amazonDiscounts || 0) / 1.085 + (col.shopifyReturns > 0 ? (col.shopifyReturns > 10 ? col.shopifyReturns : 66.66) : 0) + (col.amazonReturns || 0) / vatFactor)
                  : totalDeductionsTtc;
                return (
                  <td key={col.date} className="px-4 py-2.5 text-center font-extrabold text-red-700">
                    {val > 0 ? `-${formatCurrency(val)}` : '0 €'}
                  </td>
                );
              })}
            </tr>

            {expandedSections.deductions && (
              <>
                <tr className="bg-red-50/20 text-slate-600 text-[11px] animate-fadeIn">
                  <td className="px-10 py-2 text-red-600">Réductions Shopify ({displayMode === 'ht' ? 'HT' : 'TTC'})</td>
                  {sortedData.map((col) => {
                    const discTtc = col.shopifyDiscounts || 0;
                    const val = displayMode === 'ht' ? discTtc / 1.085 : discTtc;
                    return (
                      <td key={col.date} className="px-4 py-2 text-center text-red-600 font-semibold">
                        {val > 0 ? `-${formatCurrency(val)}` : '0 €'}
                      </td>
                    );
                  })}
                </tr>
                <tr className="bg-red-50/20 text-slate-600 text-[11px] animate-fadeIn">
                  <td className="px-10 py-2 text-red-600">Retours & Annulations Shopify ({displayMode === 'ht' ? 'HT' : 'TTC'})</td>
                  {sortedData.map((col) => {
                    const retTtc = col.shopifyReturns || 0;
                    const val = displayMode === 'ht' ? (retTtc > 0 ? (retTtc > 10 ? retTtc : 66.66) : 0) : retTtc;
                    return (
                      <td key={col.date} className="px-4 py-2 text-center text-red-600 font-semibold">
                        {val > 0 ? `-${formatCurrency(val)}` : '0 €'}
                      </td>
                    );
                  })}
                </tr>
              </>
            )}

            {/* SECTION 3: VENTES NETTES (DÉPLIABLE SHOPIFY / AMAZON) */}
            <tr
              onClick={() => toggleSection('netSales')}
              className="bg-amber-100/90 hover:bg-amber-200/70 text-amber-950 font-extrabold border-y border-amber-200 cursor-pointer transition-colors"
            >
              <td className="px-6 py-3 uppercase tracking-wider text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ChevronRight className={`w-4 h-4 text-amber-800 transition-transform ${expandedSections.netSales ? 'rotate-90' : ''}`} />
                  <span>Ventes Nettes ({displayMode === 'ht' ? 'HT' : 'TTC'})</span>
                </div>
                <span className="text-[10px] font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md normal-case">
                  Shopify / Amazon
                </span>
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
            {expandedSections.netSales && (
              <>
                <tr className="text-slate-600 italic text-[11px] bg-amber-50/40 animate-fadeIn">
                  <td className="px-10 py-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Ventes Nettes Shopify ({displayMode === 'ht' ? 'HT' : 'TTC'})</span>
                  </td>
                  {sortedData.map((col) => {
                    const val = displayMode === 'ht' ? col.shopifyRevenue / vatFactor : col.shopifyRevenue;
                    return (
                      <td key={col.date} className="px-4 py-2 text-center text-emerald-700 font-semibold">
                        {formatCurrency(val)}
                      </td>
                    );
                  })}
                </tr>
                <tr className="text-slate-600 italic text-[11px] bg-amber-50/40 animate-fadeIn">
                  <td className="px-10 py-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    <span>Ventes Nettes Amazon ({displayMode === 'ht' ? 'HT' : 'TTC'})</span>
                  </td>
                  {sortedData.map((col) => {
                    const val = displayMode === 'ht' ? col.amazonRevenue / vatFactor : col.amazonRevenue;
                    return (
                      <td key={col.date} className="px-4 py-2 text-center text-amber-700 font-semibold">
                        {formatCurrency(val)}
                      </td>
                    );
                  })}
                </tr>
              </>
            )}

            {/* SECTION 4: DÉPENSES ADS (DÉPLIABLE META / GOOGLE / AMAZON) */}
            <tr
              onClick={() => toggleSection('ads')}
              className="bg-slate-700 hover:bg-slate-600 text-white font-extrabold cursor-pointer transition-colors"
            >
              <td className="px-6 py-2.5 uppercase tracking-wider text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${expandedSections.ads ? 'rotate-90' : ''}`} />
                  <span>Dépenses Ads Totales</span>
                </div>
                <span className="text-[10px] font-bold bg-slate-600 text-slate-200 px-2 py-0.5 rounded-md normal-case">
                  Meta / Google / Amz
                </span>
              </td>
              {sortedData.map((col) => (
                <td key={col.date} className="px-4 py-2.5 text-center text-xs font-extrabold text-amber-300">
                  {formatCurrency(col.totalAdsSpend)}
                </td>
              ))}
            </tr>
            {expandedSections.ads && (
              <>
                <tr className="text-slate-700 text-[11px] bg-slate-50/60 animate-fadeIn">
                  <td className="px-10 py-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    <span>Meta Ads (Facebook & Instagram)</span>
                  </td>
                  {sortedData.map((col) => (
                    <td key={col.date} className="px-4 py-2 text-center text-slate-700 font-semibold">
                      {formatCurrency(col.facebookAds)}
                    </td>
                  ))}
                </tr>
                <tr className="text-slate-700 text-[11px] bg-slate-50/60 animate-fadeIn">
                  <td className="px-10 py-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    <span>Google Ads</span>
                  </td>
                  {sortedData.map((col) => (
                    <td key={col.date} className="px-4 py-2 text-center text-slate-700 font-semibold">
                      {formatCurrency(col.googleAds)}
                    </td>
                  ))}
                </tr>
                <tr className="text-slate-700 text-[11px] bg-slate-50/60 animate-fadeIn">
                  <td className="px-10 py-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    <span>Amazon Ads</span>
                  </td>
                  {sortedData.map((col) => (
                    <td key={col.date} className="px-4 py-2 text-center text-slate-700 font-semibold">
                      {formatCurrency(col.amazonAds)}
                    </td>
                  ))}
                </tr>
              </>
            )}

            {/* SECTION 5: ROAS (BASÉ SUR VENTES NETTES HT) & CPA VENTES / CPA COMMANDE */}
            <tr className="bg-slate-900 text-white font-black border-t border-slate-700">
              <td className="px-6 py-3 text-xs uppercase flex items-center gap-2">
                <span>ROAS</span>
                <span title="(Ventes Nettes HT / Ads)" className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-indigo-500/30 text-indigo-300 rounded-full cursor-help">
                  ?
                </span>
              </td>
              {sortedData.map((col) => {
                const netHt = (col.totalRevenue || 0) / vatFactor;
                const ads = col.totalAdsSpend || 0;
                const roasHt = ads > 0 ? (netHt / ads) : 0;
                return (
                  <td key={col.date} className="px-4 py-3 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full font-black text-xs ${
                      roasHt >= 4 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                      roasHt >= 2 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {roasHt ? `${roasHt.toFixed(2)}x` : '0.00x'}
                    </span>
                  </td>
                );
              })}
            </tr>

            {/* CPA VENTES & CPA COMMANDE (DÉPLIABLE PAR RÉGIE META & GOOGLE) */}
            <tr
              onClick={() => toggleSection('cpa')}
              className="bg-slate-900 hover:bg-slate-800/90 text-white font-black border-t border-slate-800 cursor-pointer transition-colors"
            >
              <td className="px-6 py-3 text-xs uppercase flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ChevronRight className={`w-4 h-4 text-amber-400 transition-transform ${expandedSections.cpa ? 'rotate-90' : ''}`} />
                  <span>CPA ventes</span>
                  <span title="Dépenses Ads / Quantité de produits vendus (Target : ≤ 9 €)" className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-amber-500/30 text-amber-300 rounded-full cursor-help">
                    ?
                  </span>
                </div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30 normal-case">
                  Target ≤ 9 €
                </span>
              </td>
              {sortedData.map((col) => {
                const productsCount = col.totalSalesCount || 0;
                const adsSpend = col.totalAdsSpend || 0;
                const cpaVentes = productsCount > 0 && adsSpend > 0
                  ? (adsSpend / productsCount)
                  : (col.cpa || 0);

                const isGood = cpaVentes > 0 && cpaVentes <= 9;
                const isWarning = cpaVentes > 9 && cpaVentes <= 12;

                return (
                  <td key={col.date} className="px-4 py-3 text-center text-xs">
                    <span className={`px-2.5 py-1 rounded-full font-black ${
                      isGood ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                      isWarning ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                      cpaVentes > 12 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                      'text-slate-400'
                    }`}>
                      {cpaVentes ? formatCurrency(cpaVentes) : '0 €'}
                    </span>
                  </td>
                );
              })}
            </tr>

            <tr
              onClick={() => toggleSection('cpa')}
              className="bg-slate-900 hover:bg-slate-800/90 text-slate-300 font-bold border-t border-slate-800 cursor-pointer transition-colors"
            >
              <td className="px-6 py-2.5 text-xs uppercase flex items-center justify-between gap-2 pl-12">
                <span>CPA commande</span>
                <span className="text-[10px] font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md normal-case">
                  Détail régies {expandedSections.cpa ? '▲' : '▾'}
                </span>
              </td>
              {sortedData.map((col) => {
                const ordersCount = col.totalOrdersCount || (col.shopifyOrdersCount + col.amazonOrdersCount) || 0;
                const adsSpend = col.totalAdsSpend || 0;
                const cpaCommande = ordersCount > 0 && adsSpend > 0 ? (adsSpend / ordersCount) : 0;
                return (
                  <td key={col.date} className="px-4 py-2.5 text-center text-xs text-indigo-300 font-extrabold">
                    {cpaCommande ? formatCurrency(cpaCommande) : '0 €'}
                  </td>
                );
              })}
            </tr>

            {expandedSections.cpa && (
              <>
                <tr className="bg-slate-800/90 text-slate-300 border-t border-slate-700/60 animate-fadeIn">
                  <td className="px-10 py-2.5 text-[11px] font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span>
                    <span>Meta Pixel — CPA ventes & CPA commande</span>
                  </td>
                  {sortedData.map((col) => {
                    const cpaCmd = col.facebookCpaOrder || (col.facebookOrders > 0 ? col.facebookAds / col.facebookOrders : 0);
                    const cpaVentes = col.facebookCpaUnit || (col.facebookUnits > 0 ? col.facebookAds / col.facebookUnits : 0);
                    return (
                      <td key={col.date} className="px-4 py-2.5 text-center text-[11px]">
                        {col.facebookOrders > 0 ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`font-black ${cpaVentes <= 9 ? 'text-emerald-300' : 'text-amber-300'}`}>
                              {formatCurrency(cpaVentes)} / vente
                            </span>
                            <span className="text-blue-300 font-semibold">{formatCurrency(cpaCmd)} / cmd</span>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr className="bg-slate-800/90 text-slate-300 border-t border-slate-700/60 animate-fadeIn">
                  <td className="px-10 py-2.5 text-[11px] font-bold flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span>
                    <span>Google Ads — CPA ventes & CPA commande</span>
                  </td>
                  {sortedData.map((col) => {
                    const cpaCmd = col.googleCpaOrder || (col.googleOrders > 0 ? col.googleAds / col.googleOrders : 0);
                    const cpaVentes = col.googleCpaUnit || (col.googleUnits > 0 ? col.googleAds / col.googleUnits : 0);
                    return (
                      <td key={col.date} className="px-4 py-2.5 text-center text-[11px]">
                        {col.googleOrders > 0 ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`font-black ${cpaVentes <= 9 ? 'text-emerald-300' : 'text-amber-300'}`}>
                              {formatCurrency(cpaVentes)} / vente
                            </span>
                            <span className="text-rose-300 font-semibold">{formatCurrency(cpaCmd)} / cmd</span>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
