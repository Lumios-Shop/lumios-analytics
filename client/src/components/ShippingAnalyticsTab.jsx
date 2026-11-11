import React, { useState, useEffect } from 'react';
import { Truck, Package, Zap, MapPin, ShoppingBag } from 'lucide-react';
import { authFetch, getApiBase } from '../utils/api';

const API_BASE = getApiBase();

export default function ShippingAnalyticsTab({ data = [] }) {
  const [amazonReports, setAmazonReports] = useState([]);
  const [shippingRates, setShippingRates] = useState({ domicile: 5.50, relais: 3.50 });

  useEffect(() => {
    const fetchExtras = async () => {
      try {
        const [repRes, shipRes] = await Promise.all([
          authFetch(`${API_BASE}/amazon/reports`),
          authFetch(`${API_BASE}/config/shipping-costs`)
        ]);
        if (repRes.ok) {
          const reps = await repRes.json();
          setAmazonReports(reps.sort((a, b) => a.period_key.localeCompare(b.period_key)));
        }
        if (shipRes.ok) {
          const shipData = await shipRes.json();
          const dom = shipData.find(s => s.code === 'domicile')?.cost_per_order ?? 5.50;
          const rel = shipData.find(s => s.code === 'relais')?.cost_per_order ?? 3.50;
          setShippingRates({ domicile: dom, relais: rel });
        }
      } catch (err) {
        console.error('Erreur chargement données transport Amazon:', err);
      }
    };
    fetchExtras();
  }, []);

  const totals = data.reduce(
    (acc, cur) => {
      acc.domicileOrders += cur.domicileOrders || 0;
      acc.relaisOrders += cur.relaisOrders || 0;
      acc.expressOrders += cur.expressOrders || 0;
      acc.domicileRevenue += cur.domicileRevenue || 0;
      acc.relaisRevenue += cur.relaisRevenue || 0;
      acc.expressRevenue += cur.expressRevenue || 0;
      acc.domicileCost += (cur.domicileOrders || 0) * shippingRates.domicile;
      acc.relaisCost += (cur.relaisOrders || 0) * shippingRates.relais;
      acc.expressCost += (cur.expressOrders || 0) * 9.90;
      acc.amazonFbaCost += cur.amazonShipping || 0;
      acc.amazonOrders += cur.amazonOrdersCount || 0;
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
      expressCost: 0,
      amazonFbaCost: 0,
      amazonOrders: 0
    }
  );

  const totalShopifyOrders = totals.domicileOrders + totals.relaisOrders + totals.expressOrders || 1;
  const totalShopifyCost = totals.domicileCost + totals.relaisCost + totals.expressCost;

  const domicilePercent = Math.round((totals.domicileOrders / totalShopifyOrders) * 100);
  const relaisPercent = Math.round((totals.relaisOrders / totalShopifyOrders) * 100);
  const expressPercent = Math.max(0, 100 - domicilePercent - relaisPercent);

  const amazonTotals = amazonReports.reduce((acc, r) => {
    acc.orders += r.csv_orders || 0;
    acc.units += r.csv_units || 0;
    acc.fba += Math.abs(r.csv_fba_fees || r.fba_transaction_fees || 0);
    return acc;
  }, { orders: 0, units: 0, fba: 0 });

  const avgAmazonPerUnit = amazonTotals.units > 0 ? amazonTotals.fba / amazonTotals.units : 7.26;
  const avgAmazonPerOrder = amazonTotals.orders > 0 ? amazonTotals.fba / amazonTotals.orders : 7.37;

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
            <p className="text-xs text-slate-500 font-medium">Proportions %, coûts Shopify (Domicile, Relais, Express) et coût mensuel réel Amazon FBA</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Colis Shopify (Période)</p>
            <p className="text-base font-black text-slate-900">{formatNumber(totals.domicileOrders + totals.relaisOrders + totals.expressOrders)}</p>
          </div>
          <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Coût Shopify</p>
            <p className="text-base font-black text-emerald-600">{formatCurrency(totalShopifyCost)}</p>
          </div>
          <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-center">
            <p className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider">Coût FBA Amazon (Période)</p>
            <p className="text-base font-black text-amber-700">{formatCurrency(totals.amazonFbaCost)}</p>
          </div>
        </div>
      </div>

      {/* VISUAL DONUT CHART & CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* DONUT PROPORTION CHART */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs flex flex-col items-center justify-center space-y-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">Proportion Shopify (%)</h4>
          
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f1f5f9" strokeWidth="3.8" />
              <circle
                cx="18" cy="18" r="15.915" fill="transparent" stroke="#0d9488" strokeWidth="4.2"
                strokeDasharray={`${relaisPercent} ${100 - relaisPercent}`} strokeDashoffset="0"
              />
              <circle
                cx="18" cy="18" r="15.915" fill="transparent" stroke="#10b981" strokeWidth="4.2"
                strokeDasharray={`${domicilePercent} ${100 - domicilePercent}`} strokeDashoffset={`${-relaisPercent}`}
              />
              <circle
                cx="18" cy="18" r="15.915" fill="transparent" stroke="#f59e0b" strokeWidth="4.2"
                strokeDasharray={`${expressPercent} ${100 - expressPercent}`} strokeDashoffset={`${-(relaisPercent + domicilePercent)}`}
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-lg font-black text-slate-900">{formatNumber(totals.domicileOrders + totals.relaisOrders + totals.expressOrders)}</span>
              <span className="block text-[10px] text-slate-500 font-bold uppercase">Colis Shopify</span>
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
            <span className="text-xl font-black text-emerald-900">{formatCurrency(shippingRates.domicile)} HT</span>
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
            <span className="text-xl font-black text-teal-900">{formatCurrency(shippingRates.relais)} HT</span>
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

      {/* SECTION MENSUELLE : COÛT D'EXPÉDITION RÉEL AMAZON FBA VS SHOPIFY */}
      {amazonReports.length > 0 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900">
                  Coût d'Expédition Réel Amazon FBA — Suivi Mensuel (CSV Seller Central)
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  Mis à jour chaque mois avec vos relevés CSV pour comparer le coût logistique FBA face à Domicile et Mondial Relay
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-xl font-black">
                Moyenne FBA : {formatCurrency(avgAmazonPerUnit)} / produit ({formatCurrency(avgAmazonPerOrder)} / cmd)
              </span>
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold">
                Relais : -{formatCurrency(Math.max(0, avgAmazonPerUnit - shippingRates.relais))}/envoi
              </span>
              <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-3 py-1.5 rounded-xl font-bold">
                Domicile : -{formatCurrency(Math.max(0, avgAmazonPerUnit - shippingRates.domicile))}/envoi
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {amazonReports.map(r => {
              const units = r.csv_units || 0;
              const orders = r.csv_orders || 0;
              const fbaTot = Math.abs(r.csv_fba_fees || r.fba_transaction_fees || 0);
              const perUnit = r.csv_avg_fba_per_unit || (units > 0 ? fbaTot / units : 0);
              const perOrder = r.csv_avg_fba_per_order || (orders > 0 ? fbaTot / orders : 0);
              const diffRelais = Math.max(0, perUnit - shippingRates.relais);
              const diffDomicile = Math.max(0, perUnit - shippingRates.domicile);

              return (
                <div key={r.period_key} className="border border-amber-200/70 bg-gradient-to-br from-amber-50/30 to-white rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-slate-900">{r.period_label}</span>
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                      {formatNumber(units)} art. ({formatNumber(orders)} cmd)
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-amber-200/60 rounded-xl text-center">
                    <span className="block text-[10px] uppercase font-bold text-amber-700">Frais Expédié par Amazon</span>
                    <span className="text-xl font-black text-slate-900">{formatCurrency(perUnit)}</span>
                    <span className="text-[11px] font-semibold text-slate-500"> / prod</span>
                    <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                      ({formatCurrency(perOrder)} / cmd • Total : {formatCurrency(fbaTot)})
                    </div>
                  </div>

                  <div className="space-y-1 text-[11px] pt-1 border-t border-amber-100">
                    <div className="flex justify-between text-teal-700 font-semibold">
                      <span>Surcoût vs Mondial Relay :</span>
                      <b>+{formatCurrency(diffRelais)}</b>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Surcoût vs Domicile :</span>
                      <b>+{formatCurrency(diffDomicile)}</b>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
