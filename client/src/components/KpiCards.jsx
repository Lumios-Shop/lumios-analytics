import React from 'react';
import { ShoppingBag, DollarSign, TrendingUp, ShoppingCart } from 'lucide-react';

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
      acc.totalFees += cur.totalFees || 0;
      acc.totalShipping += cur.totalShipping || 0;
      acc.totalCogs += cur.totalCogs || 0;
      acc.totalMargin += cur.margin || 0;
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
      totalFees: 0,
      totalShipping: 0,
      totalCogs: 0,
      totalMargin: 0
    }
  );

  const marginPercent = totals.totalRevenue > 0 
    ? (totals.totalMargin / totals.totalRevenue) * 100 
    : 0;

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val);
  };

  const formatNumber = (val) => {
    return new Intl.NumberFormat('fr-FR').format(val);
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
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">Commandes :</span>
          <div className="flex gap-2 font-semibold">
            <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Shopify: {formatNumber(totals.shopifyOrders)} cmd ({formatNumber(totals.shopifySales)} art.)
            </span>
            <span className="text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
              Amazon: {formatNumber(totals.amazonOrders)} cmd ({formatNumber(totals.amazonSales)} art.)
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
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">Répartition :</span>
          <div className="flex gap-2 font-semibold">
            <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {formatCurrency(totals.shopifyRevenue)}
            </span>
            <span className="text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
              {formatCurrency(totals.amazonRevenue)}
            </span>
          </div>
        </div>
      </div>

      {/* CARD 3: NET MARGIN */}
      <div className="relative overflow-hidden bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs transition-all duration-200 hover:shadow-md">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-slate-500 text-xs font-extrabold uppercase tracking-wider">Marge Nette Globale</p>
            <div className="flex items-baseline gap-2 mt-2">
              <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {formatCurrency(totals.totalMargin)}
              </h3>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                totals.totalMargin >= 0 
                  ? 'text-emerald-700 bg-emerald-100/80 border border-emerald-200' 
                  : 'text-red-700 bg-red-100/80 border border-red-200'
              }`}>
                {marginPercent.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="p-3 bg-violet-50 rounded-xl text-violet-600 border border-violet-100">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Détails frais :</span>
          <div className="flex gap-1.5 text-[11px] font-semibold">
            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
              Coûts: {formatCurrency(totals.totalCogs)}
            </span>
            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
              Com: {formatCurrency(totals.totalFees)}
            </span>
            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
              Exp: {formatCurrency(totals.totalShipping)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
