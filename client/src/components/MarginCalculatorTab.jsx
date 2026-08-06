import React, { useState } from 'react';
import { Calculator, ArrowRight, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';

export default function MarginCalculatorTab({ data = [] }) {
  const [vatRate, setVatRate] = useState(20); // Taux TVA par défaut (20%)

  // Somme totale des données filtrées
  const totals = data.reduce(
    (acc, cur) => {
      acc.revenue += cur.totalRevenue || 0;
      acc.cogs += cur.totalCogs || 0;
      acc.fees += cur.totalFees || 0;
      acc.shipping += cur.totalShipping || 0;
      acc.ads += cur.totalAdsSpend || 0;
      acc.orders += cur.totalOrdersCount || 0;
      return acc;
    },
    { revenue: 0, cogs: 0, fees: 0, shipping: 0, ads: 0, orders: 0 }
  );

  const revenueTtc = totals.revenue;
  const revenueHt = revenueTtc / (1 + vatRate / 100);
  const vatAmount = revenueTtc - revenueHt;

  const totalCosts = totals.cogs + totals.fees + totals.shipping + totals.ads;
  const netMarginTtc = revenueTtc - totalCosts;
  const netMarginHt = revenueHt - totalCosts;

  const netMarginPercentTtc = revenueTtc > 0 ? (netMarginTtc / revenueTtc) * 100 : 0;
  const netMarginPercentHt = revenueHt > 0 ? (netMarginHt / revenueHt) * 100 : 0;

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(val || 0);
  };

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">Calculateur & Décomposition de la Marge Nette</h3>
            <p className="text-xs text-slate-500 font-medium">Déduction étape par étape du CA TTC, de la TVA (20%), des achats, commissions, livraison et Ads</p>
          </div>
        </div>

        {/* REGLAGE TAUX TVA */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs">
          <span className="font-extrabold text-slate-700">Taux de TVA :</span>
          <select
            value={vatRate}
            onChange={(e) => setVatRate(parseFloat(e.target.value))}
            className="bg-white border border-slate-300 font-black text-indigo-600 px-3 py-1 rounded-lg focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value={20}>20 % (France métropolitaine)</option>
            <option value={10}>10 % (Restauration / Livres)</option>
            <option value={5.5}>5.5 % (Taux réduit)</option>
            <option value={0}>0 % (Exonération / Export)</option>
          </select>
        </div>
      </div>

      {/* SYNTHÈSE MARGE HT & TTC */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
          <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Ventes Nettes (TTC)</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(revenueTtc)}</p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Encaissements clients totaux</p>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
          <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">TVA à Reverser ({vatRate}%)</p>
          <p className="text-2xl font-black text-red-600 mt-1">-{formatCurrency(vatAmount)}</p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Montant collecté pour l'État</p>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs">
          <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Ventes Nettes (HT)</p>
          <p className="text-2xl font-black text-indigo-600 mt-1">{formatCurrency(revenueHt)}</p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Chiffre d'Affaires Net Hors Taxes</p>
        </div>

        <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xs border border-slate-800">
          <p className="text-xs font-extrabold text-amber-400 uppercase tracking-wider">Marge Nette Finale (HT)</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{formatCurrency(netMarginHt)}</p>
          <p className="text-xs font-bold text-amber-300 mt-1">Taux de Marge Nette : {netMarginPercentHt.toFixed(1)} %</p>
        </div>
      </div>

      {/* CASCADE FINANCIÈRE DE DÉCOMPOSITION (STEP BY STEP) */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-6">
        <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          Décomposition de la Cascade Financière (P&L HT)
        </h4>

        <div className="space-y-4">
          {/* ETAPE 1: CA TTC */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center">1</span>
              <div>
                <p className="font-extrabold text-slate-900 text-xs">Ventes Nettes TTC (Encaissements)</p>
                <p className="text-[11px] text-slate-500">Chiffre d'affaires brut encaissement après réductions</p>
              </div>
            </div>
            <span className="font-black text-sm text-slate-900">{formatCurrency(revenueTtc)}</span>
          </div>

          {/* ETAPE 2: DEDUCTION TVA */}
          <div className="flex items-center justify-between p-4 bg-red-50/50 rounded-xl border border-red-100">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-red-600 text-white font-black text-xs flex items-center justify-center">2</span>
              <div>
                <p className="font-extrabold text-red-900 text-xs">TVA Collectée à Reverser ({vatRate} %)</p>
                <p className="text-[11px] text-red-600/80">Déduction fiscale directe sur les encaissements</p>
              </div>
            </div>
            <span className="font-black text-sm text-red-600">-{formatCurrency(vatAmount)}</span>
          </div>

          {/* RESULTAT CA HT */}
          <div className="flex items-center justify-between p-4 bg-indigo-50/70 rounded-xl border border-indigo-200">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-indigo-600" />
              <div>
                <p className="font-black text-indigo-900 text-xs uppercase">Chiffre d'Affaires Net (HT)</p>
                <p className="text-[11px] text-indigo-700">Base réelle de calcul de rentabilité entreprise</p>
              </div>
            </div>
            <span className="font-black text-base text-indigo-900">{formatCurrency(revenueHt)}</span>
          </div>

          {/* ETAPE 3: COGS */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/80 ml-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-amber-500 text-white font-black text-xs flex items-center justify-center">3</span>
              <div>
                <p className="font-extrabold text-slate-900 text-xs">Coût des Marchandises Vendues (COGS Achat Jeux)</p>
                <p className="text-[11px] text-slate-500">Prix d'achat unitaire fabricant x Quantité vendue</p>
              </div>
            </div>
            <span className="font-black text-sm text-red-600">-{formatCurrency(totals.cogs)}</span>
          </div>

          {/* ETAPE 4: TRANSACTION FEES */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/80 ml-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-amber-500 text-white font-black text-xs flex items-center justify-center">4</span>
              <div>
                <p className="font-extrabold text-slate-900 text-xs">Commissions Bancaires & Frais de Transaction (CB, PayPal, Amazon)</p>
                <p className="text-[11px] text-slate-500">Frais de règlement bancaires + Commissions marketplace Amazon</p>
              </div>
            </div>
            <span className="font-black text-sm text-red-600">-{formatCurrency(totals.fees)}</span>
          </div>

          {/* ETAPE 5: SHIPPING */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/80 ml-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-amber-500 text-white font-black text-xs flex items-center justify-center">5</span>
              <div>
                <p className="font-extrabold text-slate-900 text-xs">Frais de Livraison & Expédition Réels (Domicile / Relais / Express)</p>
                <p className="text-[11px] text-slate-500">Coûts d'expédition pris en charge selon les transporteurs</p>
              </div>
            </div>
            <span className="font-black text-sm text-red-600">-{formatCurrency(totals.shipping)}</span>
          </div>

          {/* ETAPE 6: ADS */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/80 ml-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-amber-500 text-white font-black text-xs flex items-center justify-center">6</span>
              <div>
                <p className="font-extrabold text-slate-900 text-xs">Dépenses Publicitaires Marketing (Facebook, Google, Amazon Ads)</p>
                <p className="text-[11px] text-slate-500">Budgets de communication investis sur les régies</p>
              </div>
            </div>
            <span className="font-black text-sm text-red-600">-{formatCurrency(totals.ads)}</span>
          </div>

          {/* RESULTAT FINAL: MARGE NETTE */}
          <div className="flex items-center justify-between p-5 bg-emerald-500 text-white rounded-2xl shadow-md border border-emerald-600">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-7 h-7 text-white" />
              <div>
                <p className="font-black text-sm uppercase tracking-wider">MARGE NETTE FINALE (BÉNÉFICE NET HT)</p>
                <p className="text-xs text-emerald-100 font-medium">Bénéfice réel restant dans les caisses de l'entreprise</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-black text-xl text-white">{formatCurrency(netMarginHt)}</p>
              <span className="inline-block bg-white text-emerald-800 font-black text-xs px-2.5 py-0.5 rounded-full mt-0.5">
                {netMarginPercentHt.toFixed(1)} % de Marge Nette HT
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
