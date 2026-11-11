import React from 'react';
import { Target, ShoppingCart, Package, TrendingUp, Facebook, Globe, ShoppingBag, Info } from 'lucide-react';

export default function ChannelAttributionCard({ salesData = [] }) {
  if (!salesData || salesData.length === 0) return null;

  const totals = salesData.reduce((acc, row) => {
    acc.facebookAds += row.facebookAds || 0;
    acc.facebookOrders += row.facebookOrders || 0;
    acc.facebookUnits += row.facebookUnits || 0;
    acc.facebookConvValue += row.facebookConvValue || 0;

    acc.googleAds += row.googleAds || 0;
    acc.googleOrders += row.googleOrders || 0;
    acc.googleUnits += row.googleUnits || 0;
    acc.googleConvValue += row.googleConvValue || 0;

    acc.amazonAds += row.amazonAds || 0;
    acc.amazonOrders += row.amazonOrdersCount || 0;
    acc.amazonUnits += row.amazonSalesCount || 0;
    acc.amazonRev += row.amazonRevenue || 0;

    acc.shopifyOrders += row.shopifyOrdersCount || 0;
    acc.shopifyUnits += row.shopifySalesCount || 0;
    acc.shopifyRev += row.shopifyRevenue || 0;
    return acc;
  }, {
    facebookAds: 0, facebookOrders: 0, facebookUnits: 0, facebookConvValue: 0,
    googleAds: 0, googleOrders: 0, googleUnits: 0, googleConvValue: 0,
    amazonAds: 0, amazonOrders: 0, amazonUnits: 0, amazonRev: 0,
    shopifyOrders: 0, shopifyUnits: 0, shopifyRev: 0
  });

  const formatCurrency = (val) => {
    if (isNaN(val) || val === undefined || val === null) return '0,00 €';
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(val);
  };

  const formatNum = (val, decimals = 0) => {
    if (!val || isNaN(val)) return '0';
    return Number(val.toFixed(decimals)).toLocaleString('fr-FR');
  };

  const metaCpaOrder = totals.facebookOrders > 0 ? totals.facebookAds / totals.facebookOrders : 0;
  const metaCpaUnit = totals.facebookUnits > 0 ? totals.facebookAds / totals.facebookUnits : 0;
  const metaRoas = totals.facebookAds > 0 ? totals.facebookConvValue / totals.facebookAds : 0;
  const metaItemsPerOrder = totals.facebookOrders > 0 ? totals.facebookUnits / totals.facebookOrders : 0;

  const googleCpaOrder = totals.googleOrders > 0 ? totals.googleAds / totals.googleOrders : 0;
  const googleCpaUnit = totals.googleUnits > 0 ? totals.googleAds / totals.googleUnits : 0;
  const googleRoas = totals.googleAds > 0 ? totals.googleConvValue / totals.googleAds : 0;
  const googleItemsPerOrder = totals.googleOrders > 0 ? totals.googleUnits / totals.googleOrders : 0;

  const amazonCpaOrder = totals.amazonOrders > 0 && totals.amazonAds > 0 ? totals.amazonAds / totals.amazonOrders : 0;
  const amazonCpaUnit = totals.amazonUnits > 0 && totals.amazonAds > 0 ? totals.amazonAds / totals.amazonUnits : 0;
  const amazonRoas = totals.amazonAds > 0 ? totals.amazonRev / totals.amazonAds : 0;
  const amazonItemsPerOrder = totals.amazonOrders > 0 ? totals.amazonUnits / totals.amazonOrders : 0;

  const getCpaBadgeStyle = (cpaVal) => {
    if (!cpaVal || cpaVal <= 0) return 'bg-slate-100 text-slate-500 border-slate-200';
    if (cpaVal <= 9) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (cpaVal <= 12) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-6 mb-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-slate-900">
              Attribution Déclarative Régies : Meta Pixel & Google Ads
            </h4>
            <p className="text-xs text-slate-500 font-medium">
              Commandes, quantité de produits vendus par commande, CPA par Commande et CPA par Produit Vendu (Target ≤ 9 €)
            </p>
          </div>
        </div>

        {/* COMPARATIF DÉCLARÉ VS SHOPIFY RÉEL */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <span className="text-slate-500 font-semibold">Déclaré Meta + Google :</span>
            <span className="font-black text-slate-900">
              {formatNum(totals.facebookOrders + totals.googleOrders, 1)} cmd
            </span>
            <span className="text-slate-400">•</span>
            <span className="font-bold text-indigo-600">
              {formatNum(totals.facebookUnits + totals.googleUnits, 1)} prod
            </span>
          </div>
          <div className="bg-emerald-50/70 border border-emerald-200/80 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <span className="text-emerald-700 font-semibold">Réel Shopify :</span>
            <span className="font-black text-emerald-900">{totals.shopifyOrders} cmd</span>
            <span className="text-emerald-400">•</span>
            <span className="font-bold text-emerald-700">{totals.shopifyUnits} prod</span>
          </div>
        </div>
      </div>

      {/* 3 CARDS: META ADS / GOOGLE ADS / AMAZON ADS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* META ADS */}
        <div className="border border-blue-200/70 bg-gradient-to-br from-blue-50/40 to-white rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-600 text-white rounded-xl shadow-xs">
                <Facebook className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-sm font-black text-slate-900">Meta Ads (Pixel)</h5>
                <span className="text-[11px] font-semibold text-blue-600">Facebook & Instagram</span>
              </div>
            </div>
            <span className="text-xs font-extrabold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
              Budget : {formatCurrency(totals.facebookAds)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-slate-200/70 rounded-xl p-3">
              <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <ShoppingCart className="w-3 h-3 text-blue-500" />
                Commandes Pixel
              </div>
              <div className="text-xl font-black text-slate-900 mt-0.5">
                {formatNum(totals.facebookOrders, 0)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                CA déclaré : {formatCurrency(totals.facebookConvValue)}
              </div>
            </div>

            <div className="bg-white border border-slate-200/70 rounded-xl p-3">
              <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <Package className="w-3 h-3 text-indigo-500" />
                Produits Vendus
                <span
                  title="Calculé à partir des commandes Pixel Meta multipliées par le ratio réel articles/commande Shopify Meta"
                  className="cursor-help text-slate-400"
                >
                  <Info className="w-3 h-3" />
                </span>
              </div>
              <div className="text-xl font-black text-indigo-700 mt-0.5">
                {formatNum(totals.facebookUnits, 1)}
              </div>
              <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                {metaItemsPerOrder ? `${metaItemsPerOrder.toFixed(2)} art./cmd` : '—'}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-blue-100/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600">CPA par Commande :</span>
              <span className="font-extrabold text-slate-900">{formatCurrency(metaCpaOrder)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">CPA par Produit Vendu :</span>
              <span className={`px-2.5 py-0.5 rounded-full font-black border ${getCpaBadgeStyle(metaCpaUnit)}`}>
                {formatCurrency(metaCpaUnit)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
              <span>ROAS Déclaré Meta :</span>
              <span className="font-bold text-blue-700">{metaRoas ? `${metaRoas.toFixed(2)}x` : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* GOOGLE ADS */}
        <div className="border border-rose-200/70 bg-gradient-to-br from-rose-50/40 to-white rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-600 text-white rounded-xl shadow-xs">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-sm font-black text-slate-900">Google Ads</h5>
                <span className="text-[11px] font-semibold text-rose-600">Search, Shopping & PMax</span>
              </div>
            </div>
            <span className="text-xs font-extrabold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
              Budget : {formatCurrency(totals.googleAds)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-slate-200/70 rounded-xl p-3">
              <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <ShoppingCart className="w-3 h-3 text-rose-500" />
                Commandes Google
              </div>
              <div className="text-xl font-black text-slate-900 mt-0.5">
                {formatNum(totals.googleOrders, 1)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                CA déclaré : {formatCurrency(totals.googleConvValue)}
              </div>
            </div>

            <div className="bg-white border border-slate-200/70 rounded-xl p-3">
              <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <Package className="w-3 h-3 text-emerald-600" />
                Produits (Cart Data)
              </div>
              <div className="text-xl font-black text-emerald-700 mt-0.5">
                {formatNum(totals.googleUnits, 1)}
              </div>
              <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                {googleItemsPerOrder ? `${googleItemsPerOrder.toFixed(2)} art./cmd` : '—'}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-rose-100/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600">CPA par Commande :</span>
              <span className="font-extrabold text-slate-900">{formatCurrency(googleCpaOrder)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">CPA par Produit Vendu :</span>
              <span className={`px-2.5 py-0.5 rounded-full font-black border ${getCpaBadgeStyle(googleCpaUnit)}`}>
                {formatCurrency(googleCpaUnit)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
              <span>ROAS Déclaré Google :</span>
              <span className="font-bold text-rose-700">{googleRoas ? `${googleRoas.toFixed(2)}x` : 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* AMAZON ADS */}
        <div className="border border-amber-200/70 bg-gradient-to-br from-amber-50/40 to-white rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-sm font-black text-slate-900">Amazon Ads</h5>
                <span className="text-[11px] font-semibold text-amber-600">Sponsored Products</span>
              </div>
            </div>
            <span className="text-xs font-extrabold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
              Budget : {formatCurrency(totals.amazonAds)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-slate-200/70 rounded-xl p-3">
              <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <ShoppingCart className="w-3 h-3 text-amber-500" />
                Cmd Amazon
              </div>
              <div className="text-xl font-black text-slate-900 mt-0.5">
                {totals.amazonOrders}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                CA total : {formatCurrency(totals.amazonRev)}
              </div>
            </div>

            <div className="bg-white border border-slate-200/70 rounded-xl p-3">
              <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <Package className="w-3 h-3 text-amber-600" />
                Produits Vendus
              </div>
              <div className="text-xl font-black text-amber-700 mt-0.5">
                {totals.amazonUnits}
              </div>
              <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                {amazonItemsPerOrder ? `${amazonItemsPerOrder.toFixed(2)} art./cmd` : '—'}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-amber-100/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600">CPA par Commande :</span>
              <span className="font-extrabold text-slate-900">
                {totals.amazonAds > 0 ? formatCurrency(amazonCpaOrder) : 'En attente API'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">CPA par Produit Vendu :</span>
              <span className={`px-2.5 py-0.5 rounded-full font-black border ${getCpaBadgeStyle(amazonCpaUnit)}`}>
                {totals.amazonAds > 0 ? formatCurrency(amazonCpaUnit) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500">
              <span>ROAS Global Amazon :</span>
              <span className="font-bold text-amber-700">{amazonRoas ? `${amazonRoas.toFixed(2)}x` : 'En attente API'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
