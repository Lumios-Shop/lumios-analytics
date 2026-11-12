import React, { useState, useEffect } from 'react';
import {
  Truck,
  Package,
  Zap,
  MapPin,
  ShoppingBag,
  ArrowRightLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Minus
} from 'lucide-react';
import { authFetch, getApiBase } from '../utils/api';

const API_BASE = getApiBase();

const MONTH_NAMES = {
  '01': 'Janvier',
  '02': 'Février',
  '03': 'Mars',
  '04': 'Avril',
  '05': 'Mai',
  '06': 'Juin',
  '07': 'Juillet',
  '08': 'Août',
  '09': 'Septembre',
  '10': 'Octobre',
  '11': 'Novembre',
  '12': 'Décembre'
};

function formatPeriodLabel(periodKey) {
  if (!periodKey || !periodKey.includes('-')) return periodKey;
  const [y, m] = periodKey.split('-');
  return `${MONTH_NAMES[m] || m} ${y}`;
}

export default function ShippingAnalyticsTab({ data = [] }) {
  const [amazonReports, setAmazonReports] = useState([]);
  const [monthlyShipping, setMonthlyShipping] = useState([]);
  const [defaultRates, setDefaultRates] = useState({ domicile: 5.50, relais: 3.50 });
  const [selectedMonth, setSelectedMonth] = useState('');
  const [compareMonth, setCompareMonth] = useState('');
  const [showFullHistory, setShowFullHistory] = useState(false);

  useEffect(() => {
    const fetchExtras = async () => {
      try {
        const [repRes, monthlyShipRes, shipRes] = await Promise.all([
          authFetch(`${API_BASE}/amazon/reports`),
          authFetch(`${API_BASE}/config/monthly-shipping-costs`),
          authFetch(`${API_BASE}/config/shipping-costs`)
        ]);

        let repList = [];
        let shipList = [];

        if (repRes.ok) {
          repList = await repRes.json();
          setAmazonReports(repList);
        }
        if (monthlyShipRes.ok) {
          shipList = await monthlyShipRes.json();
          setMonthlyShipping(shipList);
        }
        if (shipRes.ok) {
          const shipData = await shipRes.json();
          const dom = shipData.find(s => s.code === 'domicile')?.cost_per_order ?? 5.50;
          const rel = shipData.find(s => s.code === 'relais')?.cost_per_order ?? 3.50;
          setDefaultRates({ domicile: dom, relais: rel });
        }

        // Fusionner les mois disponibles (du plus récent au plus ancien)
        const keysSet = new Set([
          ...repList.map(r => r.period_key),
          ...shipList.map(s => s.period_key)
        ]);
        const sortedKeys = Array.from(keysSet).sort((a, b) => b.localeCompare(a));

        if (sortedKeys.length > 0) {
          setSelectedMonth(sortedKeys[0]);
          setCompareMonth(sortedKeys.length > 1 ? sortedKeys[1] : 'none');
        }
      } catch (err) {
        console.error('Erreur chargement données transport:', err);
      }
    };
    fetchExtras();
  }, []);

  // Construire la timeline mensuelle unifiée (Colis Privé, Mondial Relay, Express, Amazon FBA)
  const allMonthKeys = Array.from(new Set([
    ...amazonReports.map(r => r.period_key),
    ...monthlyShipping.map(s => s.period_key)
  ])).sort((a, b) => b.localeCompare(a)); // DESC : le plus récent en premier

  const getMonthData = (periodKey) => {
    if (!periodKey || periodKey === 'none') return null;
    const amz = amazonReports.find(r => r.period_key === periodKey);
    const shp = monthlyShipping.find(s => s.period_key === periodKey);

    const units = amz?.csv_units || 0;
    const orders = amz?.csv_orders || 0;
    const fbaTot = amz ? Math.abs(amz.csv_fba_fees || amz.fba_transaction_fees || 0) : 0;
    const amazonPerUnit = amz?.csv_avg_fba_per_unit || (units > 0 ? fbaTot / units : 0);
    const amazonPerOrder = amz?.csv_avg_fba_per_order || (orders > 0 ? fbaTot / orders : 0);

    return {
      periodKey,
      label: amz?.period_label || formatPeriodLabel(periodKey),
      domicile: shp?.domicile_cost ?? defaultRates.domicile,
      relais: shp?.relais_cost ?? defaultRates.relais,
      express: shp?.express_cost ?? 9.90,
      amazonPerUnit,
      amazonPerOrder,
      amazonUnits: units,
      amazonOrders: orders,
      amazonFbaTotal: fbaTot
    };
  };

  const currentMonthData = getMonthData(selectedMonth) || {
    periodKey: '',
    label: 'Dernier mois',
    domicile: defaultRates.domicile,
    relais: defaultRates.relais,
    express: 9.90,
    amazonPerUnit: 7.29,
    amazonPerOrder: 7.48,
    amazonUnits: 0,
    amazonOrders: 0,
    amazonFbaTotal: 0
  };
  const prevMonthData = getMonthData(compareMonth);

  const computeEvolution = (currentVal, prevVal) => {
    if (!prevMonthData || !prevVal || prevVal <= 0 || !currentVal) return null;
    const diff = currentVal - prevVal;
    const pct = (diff / prevVal) * 100;
    return { diff, pct };
  };

  const renderEvolutionBadge = (evo) => {
    if (!evo) return null;
    const isDown = evo.pct < -0.05;
    const isUp = evo.pct > 0.05;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
        isDown
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : isUp
          ? 'bg-rose-50 text-rose-700 border-rose-200'
          : 'bg-slate-100 text-slate-600 border-slate-200'
      }`}>
        {isDown ? <TrendingDown className="w-3 h-3" /> : isUp ? <TrendingUp className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
        {evo.pct > 0 ? `+${evo.pct.toFixed(1)}%` : `${evo.pct.toFixed(1)}%`}
        <span className="opacity-75">
          ({evo.diff > 0 ? '+' : ''}{evo.diff.toFixed(2)} €)
        </span>
      </span>
    );
  };

  // Calcul des proportions sur la période du filtre global
  const totals = data.reduce(
    (acc, cur) => {
      acc.domicileOrders += cur.domicileOrders || 0;
      acc.relaisOrders += cur.relaisOrders || 0;
      acc.expressOrders += cur.expressOrders || 0;
      acc.domicileCost += (cur.domicileOrders || 0) * currentMonthData.domicile;
      acc.relaisCost += (cur.relaisOrders || 0) * currentMonthData.relais;
      acc.expressCost += (cur.expressOrders || 0) * currentMonthData.express;
      acc.amazonFbaCost += cur.amazonShipping || 0;
      return acc;
    },
    {
      domicileOrders: 0,
      relaisOrders: 0,
      expressOrders: 0,
      domicileCost: 0,
      relaisCost: 0,
      expressCost: 0,
      amazonFbaCost: 0
    }
  );

  const totalShopifyOrders = totals.domicileOrders + totals.relaisOrders + totals.expressOrders || 1;
  const totalShopifyCost = totals.domicileCost + totals.relaisCost + totals.expressCost;

  const domicilePercent = Math.round((totals.domicileOrders / totalShopifyOrders) * 100);
  const relaisPercent = Math.round((totals.relaisOrders / totalShopifyOrders) * 100);
  const expressPercent = Math.max(0, 100 - domicilePercent - relaisPercent);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(val || 0);
  };

  const formatNumber = (val) => {
    return new Intl.NumberFormat('fr-FR').format(val || 0);
  };

  const relaisEvo = computeEvolution(currentMonthData.relais, prevMonthData?.relais);
  const domicileEvo = computeEvolution(currentMonthData.domicile, prevMonthData?.domicile);
  const amazonEvo = computeEvolution(currentMonthData.amazonPerUnit, prevMonthData?.amazonPerUnit);

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">Livraisons & Transport — Coûts Réels & Évolution</h3>
            <p className="text-xs text-slate-500 font-medium">Répartition Shopify (Colis Privé, Mondial Relay, Express) et suivi mensuel comparé avec Amazon FBA</p>
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

      {/* SECTION UX PHARE : COÛT D'EXPÉDITION RÉEL (DERNIER MOIS PAR DÉFAUT + COMPARATEUR MENSUEL %) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-slate-900">
                Coût d'Expédition Réel — {currentMonthData.label}
              </h4>
              <p className="text-xs text-slate-500 font-medium">
                Tarifs réels Mondial Relay, Colis Privé (Domicile) et Amazon FBA avec comparatif d'évolution en %
              </p>
            </div>
          </div>

          {/* SÉLECTEUR DE MOIS + COMPARATEUR */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <span className="text-[11px] font-bold text-slate-500">Mois :</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-extrabold text-slate-900 focus:outline-none cursor-pointer"
              >
                {allMonthKeys.map(pk => (
                  <option key={pk} value={pk}>{formatPeriodLabel(pk)}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl px-3 py-1.5">
              <span className="text-[11px] font-bold text-indigo-700">Comparer à :</span>
              <select
                value={compareMonth}
                onChange={(e) => setCompareMonth(e.target.value)}
                className="bg-transparent text-xs font-extrabold text-indigo-900 focus:outline-none cursor-pointer"
              >
                <option value="none">Aucune comparaison</option>
                {allMonthKeys.filter(pk => pk !== selectedMonth).map(pk => (
                  <option key={pk} value={pk}>{formatPeriodLabel(pk)}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowFullHistory(!showFullHistory)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/70 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showFullHistory ? 'rotate-90' : ''}`} />
              {showFullHistory ? 'Masquer historique' : 'Historique complet'}
            </button>
          </div>
        </div>

        {/* 3 CARTES TRANSPORTEURS DU MOIS SÉLECTIONNÉ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* MONDIAL RELAY */}
          <div className="border border-teal-200/80 bg-gradient-to-br from-teal-50/40 to-white rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-teal-800">
                <Package className="w-5 h-5" />
                <span className="text-sm font-black">Mondial Relay</span>
              </div>
              <span className="text-[10px] font-bold uppercase bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full">
                Point Relais
              </span>
            </div>

            <div className="flex items-baseline justify-between pt-1">
              <div>
                <span className="text-3xl font-black text-slate-900">{formatCurrency(currentMonthData.relais)}</span>
                <span className="text-xs font-semibold text-slate-500 ml-1">HT / colis</span>
              </div>
            </div>

            <div className="pt-2 border-t border-teal-100 flex items-center justify-between min-h-[26px]">
              {prevMonthData ? (
                <>
                  <span className="text-[11px] text-slate-500 font-medium">vs {prevMonthData.label} ({formatCurrency(prevMonthData.relais)})</span>
                  {renderEvolutionBadge(relaisEvo)}
                </>
              ) : (
                <span className="text-[11px] text-slate-400">Tarif mensuel renseigné dans Configuration</span>
              )}
            </div>
          </div>

          {/* COLIS PRIVÉ (DOMICILE) */}
          <div className="border border-emerald-200/80 bg-gradient-to-br from-emerald-50/40 to-white rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800">
                <MapPin className="w-5 h-5" />
                <span className="text-sm font-black">Colis Privé</span>
              </div>
              <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                Domicile
              </span>
            </div>

            <div className="flex items-baseline justify-between pt-1">
              <div>
                <span className="text-3xl font-black text-slate-900">{formatCurrency(currentMonthData.domicile)}</span>
                <span className="text-xs font-semibold text-slate-500 ml-1">HT / colis</span>
              </div>
            </div>

            <div className="pt-2 border-t border-emerald-100 flex items-center justify-between min-h-[26px]">
              {prevMonthData ? (
                <>
                  <span className="text-[11px] text-slate-500 font-medium">vs {prevMonthData.label} ({formatCurrency(prevMonthData.domicile)})</span>
                  {renderEvolutionBadge(domicileEvo)}
                </>
              ) : (
                <span className="text-[11px] text-slate-400">Tarif mensuel renseigné dans Configuration</span>
              )}
            </div>
          </div>

          {/* AMAZON FBA */}
          <div className="border border-amber-200/80 bg-gradient-to-br from-amber-50/50 to-white rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-800">
                <ShoppingBag className="w-5 h-5" />
                <span className="text-sm font-black">Amazon FBA</span>
              </div>
              <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                {currentMonthData.amazonUnits > 0 ? `${currentMonthData.amazonUnits} prod.` : 'CSV Seller'}
              </span>
            </div>

            <div className="flex items-baseline justify-between pt-1">
              <div>
                <span className="text-3xl font-black text-slate-900">
                  {currentMonthData.amazonPerUnit > 0 ? formatCurrency(currentMonthData.amazonPerUnit) : 'N/A'}
                </span>
                <span className="text-xs font-semibold text-slate-500 ml-1">/ produit</span>
                {currentMonthData.amazonPerOrder > 0 && (
                  <span className="block text-[11px] text-amber-700 font-bold mt-0.5">
                    {formatCurrency(currentMonthData.amazonPerOrder)} / commande
                  </span>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-amber-100 flex items-center justify-between min-h-[26px]">
              {prevMonthData && prevMonthData.amazonPerUnit > 0 ? (
                <>
                  <span className="text-[11px] text-slate-500 font-medium">vs {prevMonthData.label} ({formatCurrency(prevMonthData.amazonPerUnit)})</span>
                  {renderEvolutionBadge(amazonEvo)}
                </>
              ) : (
                <span className="text-[11px] text-slate-400">Calculé automatiquement via CSV Amazon</span>
              )}
            </div>
          </div>
        </div>

        {/* HISTORIQUE COMPLET DÉPLIABLE */}
        {showFullHistory && allMonthKeys.length > 0 && (
          <div className="overflow-x-auto border border-slate-200 rounded-xl animate-fadeIn">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Mois</th>
                  <th className="px-4 py-3 text-center text-teal-700">Mondial Relay</th>
                  <th className="px-4 py-3 text-center text-emerald-700">Colis Privé (Domicile)</th>
                  <th className="px-4 py-3 text-center text-amber-800">Amazon FBA (/ prod)</th>
                  <th className="px-4 py-3 text-center text-amber-700">Amazon FBA (/ cmd)</th>
                  <th className="px-4 py-3 text-right">Volume FBA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allMonthKeys.map(pk => {
                  const m = getMonthData(pk);
                  return (
                    <tr
                      key={pk}
                      onClick={() => setSelectedMonth(pk)}
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                        pk === selectedMonth ? 'bg-indigo-50/60 font-bold' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 font-extrabold text-slate-900">{m.label}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-teal-700">{formatCurrency(m.relais)}</td>
                      <td className="px-4 py-2.5 text-center font-bold text-emerald-700">{formatCurrency(m.domicile)}</td>
                      <td className="px-4 py-2.5 text-center font-black text-amber-800">
                        {m.amazonPerUnit > 0 ? formatCurrency(m.amazonPerUnit) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center font-semibold text-amber-700">
                        {m.amazonPerOrder > 0 ? formatCurrency(m.amazonPerOrder) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-600 font-semibold">
                        {m.amazonUnits > 0 ? `${m.amazonUnits} prod. (${formatCurrency(m.amazonFbaTotal)})` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VISUAL DONUT CHART & SHOPIFY VOLUME CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
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
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span> Mondial Relay</span>
              <span>{relaisPercent}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Colis Privé</span>
              <span>{domicilePercent}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Express</span>
              <span>{expressPercent}%</span>
            </div>
          </div>
        </div>

        {/* CARTE 1: COLIS PRIVÉ / DOMICILE */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-700">
              <MapPin className="w-5 h-5" />
              <h4 className="font-extrabold text-sm text-slate-900">Colis Privé (Domicile)</h4>
            </div>
            <span className="text-xs font-black bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {domicilePercent}%
            </span>
          </div>

          <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-center">
            <span className="block text-[10px] uppercase font-bold text-emerald-700">Tarif ({currentMonthData.label})</span>
            <span className="text-xl font-black text-emerald-900">{formatCurrency(currentMonthData.domicile)} HT</span>
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

        {/* CARTE 2: MONDIAL RELAY */}
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
            <span className="block text-[10px] uppercase font-bold text-teal-700">Tarif ({currentMonthData.label})</span>
            <span className="text-xl font-black text-teal-900">{formatCurrency(currentMonthData.relais)} HT</span>
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
            <span className="block text-[10px] uppercase font-bold text-amber-700">Tarif ({currentMonthData.label})</span>
            <span className="text-xl font-black text-amber-900">{formatCurrency(currentMonthData.express)} HT</span>
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
