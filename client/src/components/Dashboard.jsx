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
import { BarChart3, CreditCard, Truck, Calculator } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

import UnitEconomicsCard from './UnitEconomicsCard';

export default function Dashboard({ refreshTrigger }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'payments', 'shipping', 'margin'
  const get24MonthsDefaultDates = () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const twentyFourMonthsAgo = new Date();
    twentyFourMonthsAgo.setMonth(today.getMonth() - 24);
    return {
      startDate: twentyFourMonthsAgo.toISOString().split('T')[0],
      endDate: todayStr,
      granularity: 'monthly'
    };
  };

  const [filter, setFilter] = useState(get24MonthsDefaultDates());
  const [salesData, setSalesData] = useState([]);
  const [monthlySalesData, setMonthlySalesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [force, setForce] = useState(false);

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
          onClick={() => setActiveTab('payments')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            activeTab === 'payments'
              ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Paiements (PayPal, CB, Apple Pay)
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
          Livraisons (Domicile, Relais, Express)
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

              {/* ANLYSE UNITAIRE : COMBIEN COÛTE 1 VENTE (SHOPIFY VS AMAZON & CPA/ROAS) */}
              <UnitEconomicsCard salesData={monthlySalesData.length > 0 ? monthlySalesData : salesData} />

              {/* TABLEAU DE PERFORMANCE FINANCIÈRE P&L (STRICTEMENT MENSUEL) */}
              <PerformancePnlTable data={monthlySalesData} granularity="monthly" />

              {/* DETAILS TABLE */}
              <SalesTable data={salesData} granularity={filter.granularity} />
            </>
          )}

          {/* ONGLET 2: REPARTITION DES PAIEMENTS */}
          {activeTab === 'payments' && (
            <PaymentsAnalyticsTab data={salesData} />
          )}

          {/* ONGLET 3: REPARTITION DES LIVRAISONS */}
          {activeTab === 'shipping' && (
            <ShippingAnalyticsTab data={salesData} />
          )}

          {/* ONGLET 4: MARGE NETTE ET TVA */}
          {activeTab === 'margin' && (
            <MarginCalculatorTab data={salesData} />
          )}
        </div>
      )}
    </div>
  );
}
