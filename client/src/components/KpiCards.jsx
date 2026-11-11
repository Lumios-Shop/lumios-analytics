import React from 'react';
import { DollarSign, Target, ShoppingCart } from 'lucide-react';

export default function KpiCards({ data = [] }) {
  // Calculer les totaux de la période
  const totals = data.reduce(
    (acc, cur) => {
      acc.shopifyOrders += cur.shopifyOrdersCount || cur.shopifySalesCount || 0;
      acc.amazonOrders += cur.amazonOrdersCount || cur.amazonSalesCount || 0;
      acc.shopifySales += cur.shopifySalesCount || 0;
      acc.amazonSales += cur.amazonSalesCount || 0;
      acc.shopifyRevenue += cur.shopifyRevenue || 0;
      acc.amazonRevenue += cur.amazonRevenue || 0;
      acc.totalOrders += cur.totalOrdersCount || cur.totalSalesCount || 0;
      acc.totalSales += cur.totalSalesCount || 0;
      acc.totalRevenue += cur.totalRevenue || 0;
      acc.totalAdsSpend += cur.totalAdsSpend || 0;
      return acc;
    },
    {
      shopifyOrders: 0,
      amazonOrders: 0,
      shopifySales: 0,
      amazonSales: 0,
      shopifyRevenue: 0,
      amazonRevenue: 0,
      totalOrders: 0,
      totalSales: 0,
      totalRevenue: 0,
      totalAdsSpend: 0
    }
  );

  // ROAS basé sur les Ventes Nettes HT (TVA 20%) / Dépenses Ads
  const netRevenueHt = totals.totalRevenue / 1.20;
  const roasHt = totals.totalAdsSpend > 0 ? netRevenueHt / totals.totalAdsSpend : 0;

  // CPA ventes (par quantité de produits vendus) & CPA commande
  const cpaVentes = totals.totalSales > 0 && totals.totalAdsSpend > 0
    ? totals.totalAdsSpend / totals.totalSales
    : 0;
  const cpaCommande = totals.totalOrders > 0 && totals.totalAdsSpend > 0
    ? totals.totalAdsSpend / totals.totalOrders
    : 0;

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val || 0);
  };

  const formatNumber = (val) => {
    return new Intl.NumberFormat('fr-FR').format(val || 0);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* CARD 1: TOTAL ORDERS & SALES */}
      <div className="relative overflow-hidden bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs transition-all duration-200 hover:shadow-md">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-slate-500 text-xs font-extrabold uppercase tracking-wider">Commandes & Articles</p>
            <div className="flex items-baseline gap-2 mt-2">
              <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {formatNumber(totals.totalOrders)}
              </h3>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                {formatNumber(totals.totalSales)} articles
              </span>
            </div>
          </div>
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100">
            <ShoppingCart className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-500 font-medium shrink-0">Canaux :</span>
          <div className="flex flex-wrap gap-1.5 font-semibold justify-end">
            <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Shopify : {formatNumber(totals.shopifyOrders)} cmd ({formatNumber(totals.shopifySales)} art.)
            </span>
            <span className="text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
              Amazon : {formatNumber(totals.amazonOrders)} cmd ({formatNumber(totals.amazonSales)} art.)
            </span>
          </div>
        </div>
      </div>

      {/* CARD 2: TOTAL REVENUE */}
      <div className="relative overflow-hidden bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs transition-all duration-200 hover:shadow-md">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-slate-500 text-xs font-extrabold uppercase tracking-wider">Chiffre d'Affaires</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-2 tracking-tight">
              {formatCurrency(totals.totalRevenue)}
            </h3>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-500 font-medium shrink-0">Répartition :</span>
          <div className="flex flex-wrap gap-1.5 font-semibold justify-end">
            <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Shopify : {formatCurrency(totals.shopifyRevenue)}
            </span>
            <span className="text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
              Amazon : {formatCurrency(totals.amazonRevenue)}
            </span>
          </div>
        </div>
      </div>

      {/* CARD 3: ROAS & CPA (CPA VENTES / CPA COMMANDE) */}
      <div className="relative overflow-hidden bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs transition-all duration-200 hover:shadow-md">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-slate-500 text-xs font-extrabold uppercase tracking-wider">ROAS & Performance CPA</p>
            <div className="flex items-baseline gap-2.5 mt-2">
              <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight" title="Ventes Nettes HT / Dépenses Ads Totales">
                {roasHt > 0 ? `${roasHt.toFixed(2)}x` : '0.00x'}
              </h3>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
                roasHt >= 4
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : roasHt >= 2.5
                  ? 'text-amber-700 bg-amber-50 border-amber-200'
                  : 'text-slate-600 bg-slate-100 border-slate-200'
              }`}>
                Ads : {formatCurrency(totals.totalAdsSpend)}
              </span>
            </div>
          </div>
          <div className="p-3 bg-violet-50 rounded-xl text-violet-600 border border-violet-100">
            <Target className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 w-full">
            <span
              title="CPA ventes : Dépenses Ads / Quantité totale de produits vendus (Target ≤ 9 €)"
              className={`px-2.5 py-0.5 rounded-full border font-extrabold ${
                cpaVentes > 0 && cpaVentes <= 9
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : cpaVentes > 9 && cpaVentes <= 12
                  ? 'text-amber-700 bg-amber-50 border-amber-200'
                  : cpaVentes > 12
                  ? 'text-rose-700 bg-rose-50 border-rose-200'
                  : 'text-slate-600 bg-slate-50 border-slate-200'
              }`}
            >
              CPA ventes : {formatCurrency(cpaVentes)}
            </span>
            <span
              title="CPA commande : Dépenses Ads / Nombre total de commandes"
              className="text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 font-extrabold"
            >
              CPA commande : {formatCurrency(cpaCommande)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
