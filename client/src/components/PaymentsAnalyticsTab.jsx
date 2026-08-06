import React from 'react';
import { CreditCard, DollarSign, PieChart, ShieldCheck, Smartphone } from 'lucide-react';

export default function PaymentsAnalyticsTab({ data = [] }) {
  const totals = data.reduce(
    (acc, cur) => {
      acc.cbOrders += cur.cbOrders || 0;
      acc.paypalOrders += cur.paypalOrders || 0;
      acc.applePayOrders += cur.applePayOrders || 0;
      acc.cbRevenue += cur.cbRevenue || 0;
      acc.paypalRevenue += cur.paypalRevenue || 0;
      acc.applePayRevenue += cur.applePayRevenue || 0;
      acc.cbFees += (cur.cbRevenue || 0) * 0.014 + (cur.cbOrders || 0) * 0.25;
      acc.paypalFees += (cur.paypalRevenue || 0) * 0.029 + (cur.paypalOrders || 0) * 0.35;
      acc.applePayFees += (cur.applePayRevenue || 0) * 0.014 + (cur.applePayOrders || 0) * 0.25;
      return acc;
    },
    {
      cbOrders: 0,
      paypalOrders: 0,
      applePayOrders: 0,
      cbRevenue: 0,
      paypalRevenue: 0,
      applePayRevenue: 0,
      cbFees: 0,
      paypalFees: 0,
      applePayFees: 0
    }
  );

  const totalOrders = totals.cbOrders + totals.paypalOrders + totals.applePayOrders || 1;
  const totalRevenue = totals.cbRevenue + totals.paypalRevenue + totals.applePayRevenue || 1;
  const totalFees = totals.cbFees + totals.paypalFees + totals.applePayFees;

  const cbPercent = Math.round((totals.cbOrders / totalOrders) * 100);
  const paypalPercent = Math.round((totals.paypalOrders / totalOrders) * 100);
  const applePayPercent = Math.max(0, 100 - cbPercent - paypalPercent);

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
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">Analyse Détaillée des Moyens de Paiement</h3>
            <p className="text-xs text-slate-500 font-medium">Répartition des transactions par Carte Bancaire, PayPal et Apple Pay</p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Commandes Totales</p>
            <p className="text-base font-black text-slate-900">{formatNumber(totalOrders)}</p>
          </div>
          <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center">
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Total Commissions</p>
            <p className="text-base font-black text-red-600">{formatCurrency(totalFees)}</p>
          </div>
        </div>
      </div>

      {/* VISUAL GRAPHS & BARS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CARTE 1: CB / STRIPE / VISA */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-700">
              <ShieldCheck className="w-5 h-5" />
              <h4 className="font-extrabold text-sm text-slate-900">Carte Bancaire / Visa / Stripe</h4>
            </div>
            <span className="text-xs font-black bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-200">
              {cbPercent}%
            </span>
          </div>

          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
            <div style={{ width: `${cbPercent}%` }} className="bg-indigo-600 h-full rounded-full transition-all duration-500"></div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-2">
            <div>
              <p className="text-slate-500 font-medium">Commandes</p>
              <p className="text-lg font-black text-slate-900">{formatNumber(totals.cbOrders)}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Chiffre d'Affaires</p>
              <p className="text-lg font-black text-indigo-600">{formatCurrency(totals.cbRevenue)}</p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500 font-medium">
            <span>Frais estimé (1,4% + 0,25€) :</span>
            <span className="font-bold text-red-600">{formatCurrency(totals.cbFees)}</span>
          </div>
        </div>

        {/* CARTE 2: PAYPAL */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sky-700">
              <DollarSign className="w-5 h-5" />
              <h4 className="font-extrabold text-sm text-slate-900">PayPal</h4>
            </div>
            <span className="text-xs font-black bg-sky-50 text-sky-700 px-2.5 py-0.5 rounded-full border border-sky-200">
              {paypalPercent}%
            </span>
          </div>

          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
            <div style={{ width: `${paypalPercent}%` }} className="bg-sky-500 h-full rounded-full transition-all duration-500"></div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-2">
            <div>
              <p className="text-slate-500 font-medium">Commandes</p>
              <p className="text-lg font-black text-slate-900">{formatNumber(totals.paypalOrders)}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Chiffre d'Affaires</p>
              <p className="text-lg font-black text-sky-600">{formatCurrency(totals.paypalRevenue)}</p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500 font-medium">
            <span>Frais estimé (2,9% + 0,35€) :</span>
            <span className="font-bold text-red-600">{formatCurrency(totals.paypalFees)}</span>
          </div>
        </div>

        {/* CARTE 3: APPLE PAY / MOBILES */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-800">
              <Smartphone className="w-5 h-5" />
              <h4 className="font-extrabold text-sm text-slate-900">Apple Pay & Autres</h4>
            </div>
            <span className="text-xs font-black bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full border border-slate-200">
              {applePayPercent}%
            </span>
          </div>

          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
            <div style={{ width: `${applePayPercent}%` }} className="bg-slate-700 h-full rounded-full transition-all duration-500"></div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-2">
            <div>
              <p className="text-slate-500 font-medium">Commandes</p>
              <p className="text-lg font-black text-slate-900">{formatNumber(totals.applePayOrders)}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Chiffre d'Affaires</p>
              <p className="text-lg font-black text-slate-700">{formatCurrency(totals.applePayRevenue)}</p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500 font-medium">
            <span>Frais estimé :</span>
            <span className="font-bold text-red-600">{formatCurrency(totals.applePayFees)}</span>
          </div>
        </div>
      </div>

      {/* TABLEAU RÉCAPITULATIF DES FRAIS */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
        <h4 className="text-sm font-extrabold text-slate-900 mb-4">Tableau Comparatif des Frais de Transaction</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase font-extrabold border-b border-slate-200">
                <th className="py-3 px-4">Méthode de Paiement</th>
                <th className="py-3 px-4 text-center">Part (%)</th>
                <th className="py-3 px-4 text-center">Commandes</th>
                <th className="py-3 px-4 text-right">CA Généré</th>
                <th className="py-3 px-4 text-right">Frais Bancaires</th>
                <th className="py-3 px-4 text-right">CA Net Encaissé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              <tr>
                <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block"></span>
                  Carte Bancaire / Stripe
                </td>
                <td className="py-3.5 px-4 text-center font-bold text-indigo-600">{cbPercent}%</td>
                <td className="py-3.5 px-4 text-center text-slate-800">{formatNumber(totals.cbOrders)}</td>
                <td className="py-3.5 px-4 text-right font-bold text-slate-900">{formatCurrency(totals.cbRevenue)}</td>
                <td className="py-3.5 px-4 text-right text-red-600 font-bold">-{formatCurrency(totals.cbFees)}</td>
                <td className="py-3.5 px-4 text-right text-emerald-600 font-black">{formatCurrency(totals.cbRevenue - totals.cbFees)}</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block"></span>
                  PayPal
                </td>
                <td className="py-3.5 px-4 text-center font-bold text-sky-600">{paypalPercent}%</td>
                <td className="py-3.5 px-4 text-center text-slate-800">{formatNumber(totals.paypalOrders)}</td>
                <td className="py-3.5 px-4 text-right font-bold text-slate-900">{formatCurrency(totals.paypalRevenue)}</td>
                <td className="py-3.5 px-4 text-right text-red-600 font-bold">-{formatCurrency(totals.paypalFees)}</td>
                <td className="py-3.5 px-4 text-right text-emerald-600 font-black">{formatCurrency(totals.paypalRevenue - totals.paypalFees)}</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block"></span>
                  Apple Pay & Autres
                </td>
                <td className="py-3.5 px-4 text-center font-bold text-slate-700">{applePayPercent}%</td>
                <td className="py-3.5 px-4 text-center text-slate-800">{formatNumber(totals.applePayOrders)}</td>
                <td className="py-3.5 px-4 text-right font-bold text-slate-900">{formatCurrency(totals.applePayRevenue)}</td>
                <td className="py-3.5 px-4 text-right text-red-600 font-bold">-{formatCurrency(totals.applePayFees)}</td>
                <td className="py-3.5 px-4 text-right text-emerald-600 font-black">{formatCurrency(totals.applePayRevenue - totals.applePayFees)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
