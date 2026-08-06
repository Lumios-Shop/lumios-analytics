import React from 'react';
import { CreditCard, Truck } from 'lucide-react';

export default function ProportionCharts({ data = [] }) {
  // Agrégation des proportions sur la période filtrée
  const totals = data.reduce(
    (acc, cur) => {
      acc.cbOrders += cur.cbOrders || 0;
      acc.paypalOrders += cur.paypalOrders || 0;
      acc.domicileOrders += cur.domicileOrders || 0;
      acc.relaisOrders += cur.relaisOrders || 0;
      acc.cbRevenue += cur.cbRevenue || 0;
      acc.paypalRevenue += cur.paypalRevenue || 0;
      acc.domicileRevenue += cur.domicileRevenue || 0;
      acc.relaisRevenue += cur.relaisRevenue || 0;
      return acc;
    },
    {
      cbOrders: 0,
      paypalOrders: 0,
      domicileOrders: 0,
      relaisOrders: 0,
      cbRevenue: 0,
      paypalRevenue: 0,
      domicileRevenue: 0,
      relaisRevenue: 0
    }
  );

  const totalPaymentOrders = totals.cbOrders + totals.paypalOrders || 1;
  const totalPaymentRevenue = totals.cbRevenue + totals.paypalRevenue || 1;
  
  const cbPercent = Math.min(100, Math.round((totals.cbOrders / totalPaymentOrders) * 100));
  const paypalPercent = Math.min(100, 100 - cbPercent);

  const totalShippingOrders = totals.domicileOrders + totals.relaisOrders || 1;
  const totalShippingRevenue = totals.domicileRevenue + totals.relaisRevenue || 1;

  const domicilePercent = Math.min(100, Math.round((totals.domicileOrders / totalShippingOrders) * 100));
  const relaisPercent = Math.min(100, 100 - domicilePercent);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(val || 0);
  };

  const formatNumber = (val) => {
    return new Intl.NumberFormat('fr-FR').format(val || 0);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      {/* CHART 1: CB VS PAYPAL */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-slate-900">Moyens de Paiement Shopify</h4>
              <p className="text-xs text-slate-500 font-medium">Répartition Carte Bancaire vs PayPal</p>
            </div>
          </div>
          <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
            {formatNumber(totals.cbOrders + totals.paypalOrders)} cmd
          </span>
        </div>

        {/* PROGRESS BAR */}
        <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex my-4 p-0.5 border border-slate-200/60">
          <div 
            style={{ width: `${cbPercent}%` }} 
            className="bg-indigo-600 h-full rounded-l-full transition-all duration-500" 
            title={`CB: ${cbPercent}%`}
          />
          <div 
            style={{ width: `${paypalPercent}%` }} 
            className="bg-sky-400 h-full rounded-r-full transition-all duration-500" 
            title={`PayPal: ${paypalPercent}%`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
          {/* CB / STRIPE */}
          <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-extrabold text-indigo-900">Carte Bancaire / Stripe</span>
              <span className="font-black text-indigo-700">{cbPercent}%</span>
            </div>
            <p className="text-lg font-black text-slate-900">{formatNumber(totals.cbOrders)} <span className="text-xs text-slate-500 font-medium">cmd</span></p>
            <p className="text-xs text-indigo-600 font-bold mt-0.5">{formatCurrency(totals.cbRevenue)}</p>
          </div>

          {/* PAYPAL */}
          <div className="p-3.5 bg-sky-50/50 border border-sky-100 rounded-xl">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-extrabold text-sky-900">PayPal</span>
              <span className="font-black text-sky-700">{paypalPercent}%</span>
            </div>
            <p className="text-lg font-black text-slate-900">{formatNumber(totals.paypalOrders)} <span className="text-xs text-slate-500 font-medium">cmd</span></p>
            <p className="text-xs text-sky-600 font-bold mt-0.5">{formatCurrency(totals.paypalRevenue)}</p>
          </div>
        </div>
      </div>

      {/* CHART 2: DOMICILE VS MONDIAL RELAY */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-slate-900">Modes de Livraison Shopify</h4>
              <p className="text-xs text-slate-500 font-medium">Répartition Domicile vs Point Relais</p>
            </div>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
            {formatNumber(totals.domicileOrders + totals.relaisOrders)} cmd
          </span>
        </div>

        {/* PROGRESS BAR */}
        <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex my-4 p-0.5 border border-slate-200/60">
          <div 
            style={{ width: `${domicilePercent}%` }} 
            className="bg-emerald-600 h-full rounded-l-full transition-all duration-500" 
            title={`Domicile: ${domicilePercent}%`}
          />
          <div 
            style={{ width: `${relaisPercent}%` }} 
            className="bg-teal-400 h-full rounded-r-full transition-all duration-500" 
            title={`Point Relais: ${relaisPercent}%`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
          {/* DOMICILE */}
          <div className="p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-xl">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-extrabold text-emerald-900">Livraison Domicile</span>
              <span className="font-black text-emerald-700">{domicilePercent}%</span>
            </div>
            <p className="text-lg font-black text-slate-900">{formatNumber(totals.domicileOrders)} <span className="text-xs text-slate-500 font-medium">cmd</span></p>
            <p className="text-xs text-emerald-600 font-bold mt-0.5">{formatCurrency(totals.domicileRevenue)}</p>
          </div>

          {/* POINT RELAIS */}
          <div className="p-3.5 bg-teal-50/50 border border-teal-100 rounded-xl">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-extrabold text-teal-900">Point Relais (Mondial Relay)</span>
              <span className="font-black text-teal-700">{relaisPercent}%</span>
            </div>
            <p className="text-lg font-black text-slate-900">{formatNumber(totals.relaisOrders)} <span className="text-xs text-slate-500 font-medium">cmd</span></p>
            <p className="text-xs text-teal-600 font-bold mt-0.5">{formatCurrency(totals.relaisRevenue)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
