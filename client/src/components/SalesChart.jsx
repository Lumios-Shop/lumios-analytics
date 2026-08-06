import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { BarChart3, TrendingUp } from 'lucide-react';

export default function SalesChart({ data = [], granularity = 'daily' }) {
  const [metric, setMetric] = useState('sales'); // 'sales' or 'revenue'

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      if (granularity === 'weekly') return dateStr; // ex: 2026-W32
      if (granularity === 'monthly') {
        const [year, month] = dateStr.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      }
      if (granularity === 'yearly') return dateStr; // ex: 2026
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-lg text-xs">
          <p className="font-bold text-slate-800 mb-1.5">{label ? formatDate(label) : ''}</p>
          {payload.map((item, idx) => (
            <div key={idx} className="flex justify-between gap-4 py-0.5">
              <span style={{ color: item.color }} className="font-semibold">
                {item.name} :
              </span>
              <span className="text-slate-900 font-bold">
                {metric === 'sales'
                  ? `${item.value} ventes`
                  : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(item.value)}
              </span>
            </div>
          ))}
          {payload.length > 1 && (
            <div className="flex justify-between gap-4 mt-2 pt-1.5 border-t border-slate-100 font-extrabold text-slate-900">
              <span>Total :</span>
              <span>
                {metric === 'sales'
                  ? `${payload.reduce((acc, curr) => acc + curr.value, 0)} ventes`
                  : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(payload.reduce((acc, curr) => acc + curr.value, 0))}
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-base font-extrabold text-slate-900">Évolution de l'activité</h4>
          <p className="text-xs text-slate-500 font-medium">Analyse comparative par canal de vente</p>
        </div>
        <div className="flex bg-slate-100/80 border border-slate-200 p-1 rounded-xl">
          <button
            onClick={() => setMetric('sales')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              metric === 'sales'
                ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Ventes
          </button>
          <button
            onClick={() => setMetric('revenue')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
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
          {metric === 'sales' ? (
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
                name="Shopify"
                dataKey="shopifySalesCount"
                stackId="a"
                fill="#10b981"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                name="Amazon"
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
                name="Shopify CA"
                dataKey="shopifyRevenue"
                stackId="a"
                fill="#10b981"
              />
              <Bar
                name="Amazon CA"
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
