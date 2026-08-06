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
            <p className="text-xs text-slate-500 font-medium">Répartition Domicile, Mondial Relay (Point Relais) et Express 24h</p>
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

      {/* VISUAL CARDS & BARS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
            <div style={{ width: `${domicilePercent}%` }} className="bg-emerald-600 h-full rounded-full transition-all duration-500"></div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-2">
            <div>
              <p className="text-slate-500 font-medium">Commandes</p>
              <p className="text-lg font-black text-slate-900">{formatNumber(totals.domicileOrders)}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Coût Logistique</p>
              <p className="text-lg font-black text-emerald-600">{formatCurrency(totals.domicileCost)}</p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500 font-medium">
            <span>Tarif moyen unitaire :</span>
            <span className="font-bold text-slate-900">5,50 € / col.</span>
          </div>
        </div>

        {/* CARTE 2: POINT RELAIS */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-teal-700">
              <Package className="w-5 h-5" />
              <h4 className="font-extrabold text-sm text-slate-900">Mondial Relay (Point Relais)</h4>
            </div>
            <span className="text-xs font-black bg-teal-50 text-teal-700 px-2.5 py-0.5 rounded-full border border-teal-200">
              {relaisPercent}%
            </span>
          </div>

          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
            <div style={{ width: `${relaisPercent}%` }} className="bg-teal-500 h-full rounded-full transition-all duration-500"></div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-2">
            <div>
              <p className="text-slate-500 font-medium">Commandes</p>
              <p className="text-lg font-black text-slate-900">{formatNumber(totals.relaisOrders)}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Coût Logistique</p>
              <p className="text-lg font-black text-teal-600">{formatCurrency(totals.relaisCost)}</p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500 font-medium">
            <span>Tarif moyen unitaire :</span>
            <span className="font-bold text-slate-900">3,50 € / col.</span>
          </div>
        </div>

        {/* CARTE 3: EXPRESS 24H */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-700">
              <Zap className="w-5 h-5" />
              <h4 className="font-extrabold text-sm text-slate-900">Livraison Express 24h</h4>
            </div>
            <span className="text-xs font-black bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full border border-amber-200">
              {expressPercent}%
            </span>
          </div>

          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
            <div style={{ width: `${expressPercent}%` }} className="bg-amber-500 h-full rounded-full transition-all duration-500"></div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-2">
            <div>
              <p className="text-slate-500 font-medium">Commandes</p>
              <p className="text-lg font-black text-slate-900">{formatNumber(totals.expressOrders)}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Coût Logistique</p>
              <p className="text-lg font-black text-amber-600">{formatCurrency(totals.expressCost)}</p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500 font-medium">
            <span>Tarif moyen unitaire :</span>
            <span className="font-bold text-slate-900">9,90 € / col.</span>
          </div>
        </div>
      </div>

      {/* TABLEAU DE COÛTS LOGISTIQUES */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
        <h4 className="text-sm font-extrabold text-slate-900 mb-4">Tableau d'Impact Logistique sur les Marges</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase font-extrabold border-b border-slate-200">
                <th className="py-3 px-4">Mode d'Expédition</th>
                <th className="py-3 px-4 text-center">Part (%)</th>
                <th className="py-3 px-4 text-center">Nombre de Colis</th>
                <th className="py-3 px-4 text-right">CA Généré</th>
                <th className="py-3 px-4 text-right">Frais d'Expédition Totaux</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              <tr>
                <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
                  Livraison à Domicile (Colissimo / Standard)
                </td>
                <td className="py-3.5 px-4 text-center font-bold text-emerald-600">{domicilePercent}%</td>
                <td className="py-3.5 px-4 text-center text-slate-800">{formatNumber(totals.domicileOrders)}</td>
                <td className="py-3.5 px-4 text-right font-bold text-slate-900">{formatCurrency(totals.domicileRevenue)}</td>
                <td className="py-3.5 px-4 text-right text-amber-600 font-bold">-{formatCurrency(totals.domicileCost)}</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block"></span>
                  Mondial Relay (Point Relais)
                </td>
                <td className="py-3.5 px-4 text-center font-bold text-teal-600">{relaisPercent}%</td>
                <td className="py-3.5 px-4 text-center text-slate-800">{formatNumber(totals.relaisOrders)}</td>
                <td className="py-3.5 px-4 text-right font-bold text-slate-900">{formatCurrency(totals.relaisRevenue)}</td>
                <td className="py-3.5 px-4 text-right text-amber-600 font-bold">-{formatCurrency(totals.relaisCost)}</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                  Livraison Express 24h (Chronopost)
                </td>
                <td className="py-3.5 px-4 text-center font-bold text-amber-600">{expressPercent}%</td>
                <td className="py-3.5 px-4 text-center text-slate-800">{formatNumber(totals.expressOrders)}</td>
                <td className="py-3.5 px-4 text-right font-bold text-slate-900">{formatCurrency(totals.expressRevenue)}</td>
                <td className="py-3.5 px-4 text-right text-amber-600 font-bold">-{formatCurrency(totals.expressCost)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
