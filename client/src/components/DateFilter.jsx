import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

const PRESETS = [
  { id: 'today', label: "Aujourd'hui" },
  { id: 'yesterday', label: 'Hier' },
  { id: '7days', label: '7 derniers jours' },
  { id: '30days', label: '30 derniers jours' },
  { id: 'month', label: 'Mois en cours' },
  { id: 'last_month', label: 'Mois dernier' },
  { id: '12months', label: '12 derniers mois' },
  { id: '24months', label: '24 derniers mois' },
  { id: 'custom', label: 'Personnalisé' }
];

const GRANULARITIES = [
  { id: 'daily', label: 'Jour' },
  { id: 'weekly', label: 'Semaine' },
  { id: 'monthly', label: 'Mois' },
  { id: 'yearly', label: 'Année' }
];

export default function DateFilter({ onFilterChange }) {
  const [selectedPreset, setSelectedPreset] = useState('30days');
  const [granularity, setGranularity] = useState('daily');
  const [dates, setDates] = useState({
    startDate: '',
    endDate: ''
  });

  const getPresetDates = (presetId) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    switch (presetId) {
      case 'today':
        return { startDate: todayStr, endDate: todayStr };
      case 'yesterday': {
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const yestStr = yesterday.toISOString().split('T')[0];
        return { startDate: yestStr, endDate: yestStr };
      }
      case '7days': {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 6);
        return {
          startDate: sevenDaysAgo.toISOString().split('T')[0],
          endDate: todayStr
        };
      }
      case '30days': {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 29);
        return {
          startDate: thirtyDaysAgo.toISOString().split('T')[0],
          endDate: todayStr
        };
      }
      case 'month': {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const offset = firstDay.getTimezoneOffset();
        const localFirstDay = new Date(firstDay.getTime() - (offset * 60 * 1000));
        return {
          startDate: localFirstDay.toISOString().split('T')[0],
          endDate: todayStr
        };
      }
      case 'last_month': {
        const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
        return {
          startDate: firstDayLastMonth.toISOString().split('T')[0],
          endDate: lastDayLastMonth.toISOString().split('T')[0]
        };
      }
      case '12months': {
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(today.getMonth() - 12);
        return {
          startDate: twelveMonthsAgo.toISOString().split('T')[0],
          endDate: todayStr
        };
      }
      case '24months': {
        const twentyFourMonthsAgo = new Date();
        twentyFourMonthsAgo.setMonth(today.getMonth() - 24);
        return {
          startDate: twentyFourMonthsAgo.toISOString().split('T')[0],
          endDate: todayStr
        };
      }
      default:
        return null;
    }
  };

  useEffect(() => {
    if (selectedPreset !== 'custom') {
      const presetDates = getPresetDates(selectedPreset);
      if (presetDates) {
        setDates(presetDates);
        onFilterChange({ ...presetDates, granularity });
      }
    } else if (dates.startDate && dates.endDate) {
      onFilterChange({ ...dates, granularity });
    }
  }, [selectedPreset, granularity]);

  const handleCustomDateChange = (e) => {
    const { name, value } = e.target;
    const newDates = { ...dates, [name]: value };
    setDates(newDates);
    if (newDates.startDate && newDates.endDate) {
      onFilterChange({ ...newDates, granularity });
    }
  };

  const handlePresetSelect = (presetId) => {
    setSelectedPreset(presetId);
    // Auto-adapter la granularité recommandée pour une meilleure lisibilité
    if (presetId === '12months' || presetId === '24months') {
      setGranularity('monthly');
    } else if (presetId === '30days') {
      setGranularity('daily');
    } else if (presetId === 'today' || presetId === 'yesterday' || presetId === '7days') {
      setGranularity('daily');
    }
  };

  return (
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs">
      {/* PRESETS TEMPORELS */}
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handlePresetSelect(preset.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 ${
              selectedPreset === preset.id
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100/70 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/60'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t xl:border-t-0 pt-3 xl:pt-0 border-slate-100">
        {/* SÉLECTEUR DE GRANULARITÉ */}
        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
          <span className="text-[11px] font-bold text-slate-500 uppercase px-2">Vue :</span>
          {GRANULARITIES.map((g) => (
            <button
              key={g.id}
              onClick={() => setGranularity(g.id)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                granularity === g.id
                  ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* INPUTS DATES PERSONNALISÉES */}
        {selectedPreset === 'custom' && (
          <div className="flex items-center gap-2 text-slate-600 animate-fadeIn">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <input
              type="date"
              name="startDate"
              value={dates.startDate}
              onChange={handleCustomDateChange}
              className="bg-slate-50 border border-slate-300 text-slate-900 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-xs text-slate-400 font-medium">au</span>
            <input
              type="date"
              name="endDate"
              value={dates.endDate}
              onChange={handleCustomDateChange}
              className="bg-slate-50 border border-slate-300 text-slate-900 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}
      </div>
    </div>
  );
}
