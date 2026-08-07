import React from 'react';
import { Truck, Package, Zap, MapPin } from 'lucide-react';

export default function ShippingAnalyticsTab({ data = [] }) {
  const totals = data.reduce(
    (acc, cur) => {
      acc.domicileOrders += cur.domicileOrders || 0;
      acc.relaisOrders += cur.relaisOrders || 0;
      acc.expressOrders += cur.expressOrders || 0;
      acc.domicileRevenue += cur.domicileRevenue || 0;
      acc.relaisRevenue += cur.relaisRevenue || 0;
      acc.expressRevenue += cur.expressRevenue || 0;
      acc.domicileCost += (cur.domicileOrders || 0) * 5.50;
      acc.relaisCost += (cur.relaisOrders || 0) * 3.50;
      acc.expressCost += (cur.expressOrders || 0) * 9.90;
      return acc;
    },
    {
      domicileOrders: 0,
      relaisOrders: 0,
      expressOrders: 0,
      domicileRevenue: 0,
      relaisRevenue: 0,
      expressRevenue: 0,
      domicileCost: 0,
      relaisCost: 0,
      expressCost: 0
    }
  );

  const totalOrders = totals.domicileOrders + totals.relaisOrders + totals.expressOrders || 1;
  const totalCost = totals.domicileCost + totals.relaisCost + totals.expressCost;

  const domicilePercent = Math.round((totals.domicileOrders / totalOrders) * 100);
  const relaisPercent = Math.round((totals.relaisOrders / totalOrders) * 100);
  const expressPercent = Math.max(0, 100 - domicilePercent - relaisPercent);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(val || 0);
  };

  const formatNumber = (val) => {
    return new Intl.NumberFormat('fr-FR').format(val || 0);
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">Analyse Détaillée des Modes de Livraison</h3>
            <p className="text-xs text-slate-500 font-medium">Proportions % et Coûts par expédition par type de transporteur</p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Expéditions Totales</p>
            <p className="text-base font-black text-slate-900">{formatNumber(totalOrders)}</p>
          </div>
          <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Coût Logistique Global</p>
            <p className="text-base font-black text-amber-600">{formatCurrency(totalCost)}</p>
          </div>
        </div>
      </div>

      {/* VISUAL DONUT CHART & CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* DONUT PROPORTION CHART */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs flex flex-col items-center justify-center space-y-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Proportion par Mode (%)</h4>
          
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              {/* Background circle */}
              <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f1f5f9" strokeWidth="3.8" />
              {/* Point Relais segment (teal) */}
              <circle
                cx="18" cy="18" r="15.915" fill="transparent" stroke="#0d9488" strokeWidth="4.2"
                strokeDasharray={`${relaisPercent} ${100 - relaisPercent}`} strokeDashoffset="0"
              />
              {/* Domicile segment (emerald) */}
              <circle
                cx="18" cy="18" r="15.915" fill="transparent" stroke="#10b981" strokeWidth="4.2"
                strokeDasharray={`${domicilePercent} ${100 - domicilePercent}`} strokeDashoffset={`${-relaisPercent}`}
              />
              {/* Express segment (amber) */}
              <circle
                cx="18" cy="18" r="15.915" fill="transparent" stroke="#f59e0b" strokeWidth="4.2"
                strokeDasharray={`${expressPercent} ${100 - expressPercent}`} strokeDashoffset={`${-(relaisPercent + domicilePercent)}`}
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-lg font-black text-slate-900">{formatNumber(totalOrders)}</span>
              <span className="block text-[10px] text-slate-500 font-bold uppercase">Colis Total</span>
            </div>
          </div>

          <div className="space-y-1 text-[11px] font-bold w-full">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span> Point Relais</span>
              <span>{relaisPercent}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Domicile</span>
              <span>{domicilePercent}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Express</span>
              <span>{expressPercent}%</span>
            </div>
          </div>
        </div>

        {/* CARTE 1: DOMICILE */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-700">
              <MapPin className="w-5 h-5" />
              <h4 className="font-extrabold text-sm text-slate-900">Livraison Domicile</h4>
            </div>
            <span className="text-xs font-black bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {domicilePercent}%
            </span>
          </div>

          <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-center">
            <span className="block text-[10px] uppercase font-bold text-emerald-700">Coût par Expédition</span>
            <span className="text-xl font-black text-emerald-900">5,50 € HT</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div>
              <p className="text-slate-500 font-medium">Commandes</p>
              <p className="text-base font-black text-slate-900">{formatNumber(totals.domicileOrders)}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Coût Logistique</p>
              <p className="text-base font-black text-emerald-600">{formatCurrency(totals.domicileCost)}</p>
            </div>
          </div>
        </div>

        {/* CARTE 2: POINT RELAIS */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-teal-700">
              <Package className="w-5 h-5" />
              <h4 className="font-extrabold text-sm text-slate-900">Mondial Relay</h4>
            </div>
            <span className="text-xs font-black bg-teal-50 text-teal-700 px-2.5 py-0.5 rounded-full border border-teal-200">
              {relaisPercent}%
            </span>
          </div>

          <div className="p-3 bg-teal-50/70 border border-teal-100 rounded-xl text-center">
            <span className="block text-[10px] uppercase font-bold text-teal-700">Coût par Expédition</span>
            <span className="text-xl font-black text-teal-900">3,50 € HT</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div>
              <p className="text-slate-500 font-medium">Commandes</p>
              <p className="text-base font-black text-slate-900">{formatNumber(totals.relaisOrders)}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Coût Logistique</p>
              <p className="text-base font-black text-teal-600">{formatCurrency(totals.relaisCost)}</p>
            </div>
          </div>
        </div>

        {/* CARTE 3: EXPRESS */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-700">
              <Zap className="w-5 h-5" />
              <h4 className="font-extrabold text-sm text-slate-900">Livraison Express</h4>
            </div>
            <span className="text-xs font-black bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full border border-amber-200">
              {expressPercent}%
            </span>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl text-center">
            <span className="block text-[10px] uppercase font-bold text-amber-700">Coût par Expédition</span>
            <span className="text-xl font-black text-amber-900">9,90 € HT</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div>
              <p className="text-slate-500 font-medium">Commandes</p>
              <p className="text-base font-black text-slate-900">{formatNumber(totals.expressOrders)}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Coût Logistique</p>
              <p className="text-base font-black text-amber-600">{formatCurrency(totals.expressCost)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
