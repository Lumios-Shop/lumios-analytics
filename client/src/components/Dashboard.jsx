import React, { useState, useEffect } from 'react';
import DateFilter from './DateFilter';
import KpiCards from './KpiCards';
import SalesChart from './SalesChart';
import SalesTable from './SalesTable';
import { RefreshCw, AlertCircle } from 'lucide-react';

import PerformancePnlTable from './PerformancePnlTable';
import PaymentsAnalyticsTab from './PaymentsAnalyticsTab';
import ShippingAnalyticsTab from './ShippingAnalyticsTab';
import MarginCalculatorTab from './MarginCalculatorTab';
import OrdersDetailSection from './OrdersDetailSection';
import { BarChart3, CreditCard, Truck, Calculator, Layers } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || (
  typeof window !== 'undefined' && (window.location.hostname.includes('trycloudflare.com') || window.location.hostname.includes('192.168.') || window.location.hostname.includes('loca.lt'))
    ? '/api'
    : 'http://localhost:3001/api'
);

import UnitEconomicsCard from './UnitEconomicsCard';

export default function Dashboard({ refreshTrigger }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'payments', 'shipping', 'margin'
  const get30DaysDefaultDates = () => {
    const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 29);
    const startStr = thirtyDaysAgo.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
    return {
      startDate: startStr,
      endDate: todayStr,
      granularity: 'daily'
    };
  };

  const [filter, setFilter] = useState(get30DaysDefaultDates());
  const [salesData, setSalesData] = useState([]);
  const [monthlySalesData, setMonthlySalesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [force, setForce] = useState(false);

  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
  const todayRow = salesData.find(d => d.date === todayStr);

  const fetchSalesData = async (startDate, endDate, granularity = 'monthly', forceRefresh = false) => {
    if (!startDate || !endDate) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/sales?startDate=${startDate}&endDate=${endDate}&granularity=${granularity}${forceRefresh ? '&force=true' : ''}`);
      if (!res.ok) throw new Error('Impossible de charger les données de ventes.');
      const data = await res.json();

      let monthlyData = data;
      if (granularity !== 'monthly') {
        const resMonthly = await fetch(`${API_BASE}/sales?startDate=${startDate}&endDate=${endDate}&granularity=monthly${forceRefresh ? '&force=true' : ''}`);
        if (resMonthly.ok) monthlyData = await resMonthly.json();
      }

      setSalesData(data);
      setMonthlySalesData(monthlyData);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Erreur lors du chargement des données.');
    } finally {
      setLoading(false);
    }
  };

  // Rafraîchir lors de changements de filtres ou de signal externe (ex: modification COGS)
  useEffect(() => {
    fetchSalesData(filter.startDate, filter.endDate, filter.granularity || 'daily', force);
    if (force) setForce(false);
  }, [filter, refreshTrigger, force]);

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
  };

  const handleForceSync = () => {
    setForce(true);
    fetchSalesData(filter.startDate, filter.endDate, filter.granularity || 'daily', true);
  };

  return (
    <div className="space-y-6">
      {/* FILTRES & SYNC */}
      <div className="flex flex-col xl:flex-row gap-4 xl:items-center xl:justify-between">
        <div className="flex-1">
          <DateFilter onFilterChange={handleFilterChange} />
        </div>
        
        <button
          onClick={handleForceSync}
          disabled={loading}
          className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 hover:text-indigo-600 px-4 py-3 rounded-2xl shadow-xs transition-all text-xs font-bold cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 text-indigo-600 ${loading ? 'animate-spin' : ''}`} />
          Synchroniser les flux
        </button>
      </div>

      {/* BANDEAU EN DIRECT : COMMANDES DU JOUR EN COURS */}
      {todayRow && (
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-850 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-md border border-indigo-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3.5">
            <div className="relative flex-shrink-0">
              <span className="flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-black tracking-wide text-white">
                  Commandes du jour en cours (Aujourd'hui)
                </h4>
                <span className="text-[10px] uppercase font-black bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  En direct
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5 font-medium">
                <b className="text-white">{todayRow.totalOrdersCount} commandes</b> ({todayRow.totalSalesCount} produits vendus) pour un CA net de <b className="text-emerald-300">{new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(todayRow.totalRevenue)}</b>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-xs">
              <span className="text-emerald-400 font-bold">Shopify :</span>
              <span className="font-extrabold">{todayRow.shopifyOrdersCount} cmd ({todayRow.shopifySalesCount} art.) • {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(todayRow.shopifyRevenue)}</span>
            </div>

            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-xs">
              <span className="text-amber-400 font-bold">Amazon :</span>
              <span className="font-extrabold">{todayRow.amazonOrdersCount} cmd ({todayRow.amazonSalesCount} art.) • {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(todayRow.amazonRevenue)}</span>
            </div>

            <button
              onClick={() => {
                setActiveTab('orders');
              }}
              className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-xs ml-auto md:ml-0"
            >
              <Layers className="w-3.5 h-3.5" />
              Voir le détail des commandes
            </button>
          </div>
        </div>
      )}

      {/* BARRE D'ONGLETS DE NAVIGATION PRINCIPALE */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100/90 border border-slate-200 p-1.5 rounded-2xl shadow-xs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Vue Globale & Performance (P&L)
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Layers className="w-4 h-4" />
          Détail Commandes & Produits vendus
        </button>

        <button
          onClick={() => setActiveTab('shipping')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'shipping'
              ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Truck className="w-4 h-4" />
          Livraisons & Transport (Domicile, Relais, Express)
        </button>

        <button
          onClick={() => setActiveTab('margin')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'margin'
              ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Calculator className="w-4 h-4" />
          Marge Nette & TVA
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl animate-fadeIn">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {loading && salesData.length === 0 ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-slate-200 h-32 rounded-2xl shadow-xs"></div>
            ))}
          </div>
          <div className="bg-white border border-slate-200 h-96 rounded-2xl shadow-xs"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ONGLET 1: VUE GLOBALE & PERFORMANCE */}
          {activeTab === 'overview' && (
            <>
              {/* KPI CARDS */}
              <KpiCards data={salesData} />

              {/* GRAPHIQUE VISUEL DYNAMIQUE DE CA & MARGE */}
              <div className="grid grid-cols-1 gap-6">
                <SalesChart data={salesData} granularity={filter.granularity} />
              </div>

              {/* TABLEAU DE PERFORMANCE FINANCIÈRE P&L (STRICTEMENT MENSUEL) */}
              <PerformancePnlTable data={monthlySalesData} granularity="monthly" />

              {/* SECTION DÉTAIL DES COMMANDES DIRECTEMENT ACCESSIBLE */}
              <OrdersDetailSection
                startDate={filter.startDate}
                endDate={filter.endDate}
                refreshTrigger={refreshTrigger}
              />
            </>
          )}

          {/* ONGLET DÉDIÉ : DÉTAIL DES COMMANDES ET PRODUITS VENDUS */}
          {activeTab === 'orders' && (
            <OrdersDetailSection
              startDate={filter.startDate}
              endDate={filter.endDate}
              refreshTrigger={refreshTrigger}
            />
          )}

          {/* ONGLET 2: REPARTITION ET COÛTS DE LIVRAISON */}
          {activeTab === 'shipping' && (
            <ShippingAnalyticsTab data={salesData} />
          )}

          {/* ONGLET 3: CALCULATEUR DE MARGE NETTE & TVA */}
          {activeTab === 'margin' && (
            <MarginCalculatorTab data={salesData} />
          )}
        </div>
      )}
    </div>
  );
}
