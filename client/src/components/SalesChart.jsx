import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { ShoppingCart, Package, TrendingUp } from 'lucide-react';

export default function SalesChart({ data = [], granularity = 'daily' }) {
  // 'orders' (Commandes), 'products' (Produits vendus), or 'revenue' (CA en €)
  const [metric, setMetric] = useState('orders');

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      if (granularity === 'weekly') return dateStr;
      if (granularity === 'monthly') {
        const [year, month] = dateStr.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      }
      if (granularity === 'yearly') return dateStr;
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val || 0);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const row = payload[0]?.payload || {};
      const shopifyOrders = row.shopifyOrdersCount ?? 0;
      const amazonOrders = row.amazonOrdersCount ?? 0;
      const totalOrders = row.totalOrdersCount ?? (shopifyOrders + amazonOrders);

      const shopifyProducts = row.shopifySalesCount ?? 0;
      const amazonProducts = row.amazonSalesCount ?? 0;
      const totalProducts = row.totalSalesCount ?? (shopifyProducts + amazonProducts);

      const shopifyRev = row.shopifyRevenue ?? 0;
      const amazonRev = row.amazonRevenue ?? 0;
      const totalRev = row.totalRevenue ?? (shopifyRev + amazonRev);

      const avgItemsPerOrder = totalOrders > 0 ? (totalProducts / totalOrders).toFixed(2) : '1.00';

      return (
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xl text-xs space-y-3 min-w-[280px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="font-extrabold text-slate-900 text-sm">{label ? formatDate(label) : ''}</span>
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
              {avgItemsPerOrder} art./cmd
            </span>
          </div>

          {/* DÉTAIL COMMANDES */}
          <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between font-extrabold text-slate-800">
              <span className="flex items-center gap-1.5 text-indigo-700">
                <ShoppingCart className="w-3.5 h-3.5" />
                Commandes passées :
              </span>
              <span className="text-indigo-900">{totalOrders} cmd</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-600 pl-5">
              <span>Shopify : <b>{shopifyOrders}</b> cmd</span>
              <span>Amazon : <b>{amazonOrders}</b> cmd</span>
            </div>
          </div>

          {/* DÉTAIL PRODUITS VENDUS */}
          <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between font-extrabold text-slate-800">
              <span className="flex items-center gap-1.5 text-emerald-700">
                <Package className="w-3.5 h-3.5" />
                Produits / Unités vendues :
              </span>
              <span className="text-emerald-900">{totalProducts} prod</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-600 pl-5">
              <span>Shopify : <b>{shopifyProducts}</b> prod</span>
              <span>Amazon : <b>{amazonProducts}</b> prod</span>
            </div>
          </div>

          {/* DÉTAIL CHIFFRE D'AFFAIRES */}
          <div className="pt-1 flex items-center justify-between font-black text-slate-900 text-xs border-t border-slate-100">
            <span>Chiffre d'Affaires Net :</span>
            <span className="text-slate-900">{formatCurrency(totalRev)}</span>
          </div>
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Shopify : {formatCurrency(shopifyRev)}</span>
            <span>Amazon : {formatCurrency(amazonRev)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h4 className="text-base font-extrabold text-slate-900">Évolution de l'activité</h4>
          <p className="text-xs text-slate-500 font-medium">
            {metric === 'orders' && "Nombre de commandes passées par canal"}
            {metric === 'products' && "Nombre total de produits & exemplaires vendus par canal"}
            {metric === 'revenue' && "Chiffre d'affaires net encaissé par canal"}
          </p>
        </div>

        {/* SELECTEUR 3 OPTIONS : COMMANDES / PRODUITS VENDUS / CA */}
        <div className="flex bg-slate-100/90 border border-slate-200 p-1 rounded-xl">
          <button
            onClick={() => setMetric('orders')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              metric === 'orders'
                ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Commandes
          </button>
          <button
            onClick={() => setMetric('products')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              metric === 'products'
                ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Produits vendus
          </button>
          <button
            onClick={() => setMetric('revenue')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              metric === 'revenue'
                ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            CA (€)
          </button>
        </div>
      </div>

      <div className="h-80 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          {metric === 'orders' ? (
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#64748b"
                fontSize={11}
                fontWeight={600}
                tickLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                fontWeight={600}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }} />
              <Legend
                verticalAlign="top"
                height={36}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}
              />
              <Bar
                name="Shopify (Commandes)"
                dataKey="shopifyOrdersCount"
                stackId="a"
                fill="#10b981"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                name="Amazon (Commandes)"
                dataKey="amazonOrdersCount"
                stackId="a"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          ) : metric === 'products' ? (
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#64748b"
                fontSize={11}
                fontWeight={600}
                tickLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                fontWeight={600}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }} />
              <Legend
                verticalAlign="top"
                height={36}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}
              />
              <Bar
                name="Shopify (Produits vendus)"
                dataKey="shopifySalesCount"
                stackId="a"
                fill="#10b981"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                name="Amazon (Produits vendus)"
                dataKey="amazonSalesCount"
                stackId="a"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          ) : (
            <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#64748b"
                fontSize={11}
                fontWeight={600}
                tickLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                fontWeight={600}
                tickLine={false}
                tickFormatter={(val) => `${val} €`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }} />
              <Legend
                verticalAlign="top"
                height={36}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}
              />
              <Bar
                name="Shopify CA (€)"
                dataKey="shopifyRevenue"
                stackId="a"
                fill="#10b981"
              />
              <Bar
                name="Amazon CA (€)"
                dataKey="amazonRevenue"
                stackId="a"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
