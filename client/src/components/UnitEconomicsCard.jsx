import React from 'react';
import { ShoppingBag, Truck, CreditCard, DollarSign, TrendingUp, ArrowRight, Store, ShieldCheck, Zap } from 'lucide-react';

export default function UnitEconomicsCard({ salesData = [] }) {
  if (!salesData || salesData.length === 0) return null;

  // Calculer les totaux sur la période sélectionnée
  const totals = salesData.reduce((acc, row) => {
    acc.shopifySales += row.shopifySalesCount || 0;
    acc.shopifyOrders += row.shopifyOrdersCount || 0;
    acc.shopifyRev += row.shopifyRevenue || 0;
    acc.shopifyFees += row.shopifyFees || 0;
    acc.shopifyShipping += row.shopifyShipping || 0;

    acc.amazonSales += row.amazonSalesCount || 0;
    acc.amazonOrders += row.amazonOrdersCount || 0;
    acc.amazonRev += row.amazonRevenue || 0;
    acc.amazonFees += row.amazonFees || 0;
    acc.amazonShipping += row.amazonShipping || 0;

    acc.facebookAds += row.facebookAds || 0;
    acc.googleAds += row.googleAds || 0;
    acc.amazonAds += row.amazonAds || 0;

    acc.totalSales += row.totalSalesCount || 0;
    acc.totalOrders += row.totalOrdersCount || 0;
    acc.totalRev += row.totalRevenue || 0;
    acc.totalAds += row.totalAdsSpend || 0;
    acc.totalFees += row.totalFees || 0;
    acc.totalShipping += row.totalShipping || 0;
    acc.totalCogs += row.totalCogs || 0;
    return acc;
  }, {
    shopifySales: 0, shopifyOrders: 0, shopifyRev: 0, shopifyFees: 0, shopifyShipping: 0,
    amazonSales: 0, amazonOrders: 0, amazonRev: 0, amazonFees: 0, amazonShipping: 0,
    facebookAds: 0, googleAds: 0, amazonAds: 0,
    totalSales: 0, totalOrders: 0, totalRev: 0, totalAds: 0, totalFees: 0, totalShipping: 0, totalCogs: 0
  });

  const formatCurrency = (val) => {
    if (isNaN(val) || val === undefined || val === null) return '0,00 €';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(val);
  };

  // Calculs unitaires Shopify
  const shopifySalesCount = totals.shopifySales || totals.shopifyOrders || 1;
  const shopifyAvgPrice = totals.shopifyRev / shopifySalesCount;
  const shopifyFeePerSale = totals.shopifyFees / shopifySalesCount;
  const shopifyShippingPerSale = totals.shopifyShipping / shopifySalesCount;
  const shopifyAdsPerSale = (totals.facebookAds + totals.googleAds) / shopifySalesCount;
  const shopifyMarginPerSale = shopifyAvgPrice - shopifyFeePerSale - shopifyShippingPerSale - shopifyAdsPerSale;
  const shopifyRoas = (totals.facebookAds + totals.googleAds) > 0 ? (totals.shopifyRev / (totals.facebookAds + totals.googleAds)) : 0;

  // Calculs unitaires Amazon
  const amazonSalesCount = totals.amazonSales || totals.amazonOrders || 1;
  const amazonAvgPrice = totals.amazonRev / amazonSalesCount;
  const amazonFeePerSale = totals.amazonFees / amazonSalesCount;
  const amazonShippingPerSale = totals.amazonShipping / amazonSalesCount;
  const amazonAdsPerSale = totals.amazonAds / amazonSalesCount;
  const amazonMarginPerSale = amazonAvgPrice - amazonFeePerSale - amazonShippingPerSale - amazonAdsPerSale;
  const amazonRoas = totals.amazonAds > 0 ? (totals.amazonRev / totals.amazonAds) : 0;

  // Calculs unitaires Globaux
  const globalSalesCount = totals.totalSales || totals.totalOrders || 1;
  const globalAvgPrice = totals.totalRev / globalSalesCount;
  const globalFeePerSale = totals.totalFees / globalSalesCount;
  const globalShippingPerSale = totals.totalShipping / globalSalesCount;
  const globalCpa = totals.totalAds / globalSalesCount;
  const globalTotalCostPerSale = globalFeePerSale + globalShippingPerSale + globalCpa;
  const globalMarginPerSale = globalAvgPrice - globalTotalCostPerSale;
  const globalRoas = totals.totalAds > 0 ? (totals.totalRev / totals.totalAds) : 0;

  return (
    <div className="bg-slate-900 text-white border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 mb-8 relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded-2xl">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tight">Analyse Unitaire : Combien coûte 1 Vente ?</h3>
            <p className="text-xs text-slate-400 font-medium">Décomposition détaillée des coûts par commande et rentabilité (Shopify vs Amazon)</p>
          </div>
        </div>

        {/* Global ROAS Badge */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-800/90 border border-slate-700 px-4 py-2 rounded-2xl text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400">ROAS Global</div>
            <div className="text-base font-black text-emerald-400">{globalRoas ? `${globalRoas.toFixed(2)}x` : 'N/A'}</div>
          </div>
          <div className="bg-slate-800/90 border border-slate-700 px-4 py-2 rounded-2xl text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400">CPA Moyen</div>
            <div className="text-base font-black text-amber-400">{formatCurrency(globalCpa)}</div>
          </div>
        </div>
      </div>

      {/* 3 Main Columns: GLOBAL / SHOPIFY / AMAZON */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* COLUMN 1: SYNTHÈSE GLOBALE */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-indigo-400 tracking-wider">Combien nous coûte 1 Vente Global</span>
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded-lg border border-indigo-500/30">
              {totals.totalSales} ventes
            </span>
          </div>

          <div className="text-2xl font-black text-white">
            {formatCurrency(globalTotalCostPerSale)} <span className="text-xs font-normal text-slate-400">/ vente</span>
          </div>

          <div className="space-y-2 text-xs divide-y divide-slate-700/50">
            <div className="flex justify-between pt-1">
              <span className="text-slate-400">Prix Moyen Encaissé</span>
              <span className="font-bold text-white">{formatCurrency(globalAvgPrice)}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-400">Commissions & Transactions</span>
              <span className="font-bold text-red-400">-{formatCurrency(globalFeePerSale)}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-400">Frais de Transport Moyens</span>
              <span className="font-bold text-red-400">-{formatCurrency(globalShippingPerSale)}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-400">Coût Publicitaire (CPA)</span>
              <span className="font-bold text-amber-400">-{formatCurrency(globalCpa)}</span>
            </div>
            <div className="flex justify-between pt-2 text-sm font-black">
              <span className="text-emerald-400">Marge Nette par Vente</span>
              <span className="text-emerald-400">{formatCurrency(globalMarginPerSale)}</span>
            </div>
          </div>
        </div>

        {/* COLUMN 2: VENTE DÉTAILLÉE SHOPIFY */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">Vente Shopify</span>
            </div>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-lg border border-emerald-500/30">
              {totals.shopifySales} ventes
            </span>
          </div>

          <div className="text-2xl font-black text-white">
            {formatCurrency(shopifyMarginPerSale)} <span className="text-xs font-normal text-emerald-400">marge nette / vente</span>
          </div>

          <div className="space-y-2 text-xs divide-y divide-slate-700/50">
            <div className="flex justify-between pt-1">
              <span className="text-slate-400">Prix Moyen Article</span>
              <span className="font-bold text-white">{formatCurrency(shopifyAvgPrice)}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-400">Frais Paiement (CB/PayPal)</span>
              <span className="font-bold text-red-400">-{formatCurrency(shopifyFeePerSale)}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-400">Frais Livraison (Relais/Domicile)</span>
              <span className="font-bold text-red-400">-{formatCurrency(shopifyShippingPerSale)}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-400">CPA Meta / Google Ads</span>
              <span className="font-bold text-amber-400">-{formatCurrency(shopifyAdsPerSale)}</span>
            </div>
            <div className="flex justify-between pt-2 text-xs font-bold">
              <span className="text-slate-400">ROAS Spécifique Shopify</span>
              <span className="text-emerald-400">{shopifyRoas ? `${shopifyRoas.toFixed(2)}x` : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* COLUMN 3: VENTE DÉTAILLÉE AMAZON */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-black uppercase text-amber-400 tracking-wider">Vente Amazon</span>
            </div>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-lg border border-amber-500/30">
              {totals.amazonSales} ventes
            </span>
          </div>

          <div className="text-2xl font-black text-white">
            {formatCurrency(amazonMarginPerSale)} <span className="text-xs font-normal text-amber-400">marge nette / vente</span>
          </div>

          <div className="space-y-2 text-xs divide-y divide-slate-700/50">
            <div className="flex justify-between pt-1">
              <span className="text-slate-400">Prix Moyen Article</span>
              <span className="font-bold text-white">{formatCurrency(amazonAvgPrice)}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-400">Commission Marketplace Amazon</span>
              <span className="font-bold text-red-400">-{formatCurrency(amazonFeePerSale)}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-400">Frais d'Expédition Amazon (FBA)</span>
              <span className="font-bold text-red-400">-{formatCurrency(amazonShippingPerSale)}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-400">CPA Amazon Ads</span>
              <span className="font-bold text-amber-400">-{formatCurrency(amazonAdsPerSale)}</span>
            </div>
            <div className="flex justify-between pt-2 text-xs font-bold">
              <span className="text-slate-400">ROAS Amazon Ads</span>
              <span className="text-amber-400">{amazonRoas ? `${amazonRoas.toFixed(2)}x` : 'Manuel'}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
