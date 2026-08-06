import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function SalesTable({ data = [], granularity = 'daily' }) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Trier par date décroissante (plus récent en premier)
  const sortedData = [...data].sort((a, b) => b.date.localeCompare(a.date));

  const totalPages = Math.ceil(sortedData.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, startIndex + itemsPerPage);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      if (granularity === 'weekly') return `Semaine ${dateStr}`;
      if (granularity === 'monthly') {
        const [year, month] = dateStr.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      }
      if (granularity === 'yearly') return `Année ${dateStr}`;
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h4 className="text-base font-extrabold text-slate-900">Journal d'activité & Rentabilité</h4>
          <p className="text-xs text-slate-500 font-medium">Détail consolidé des ventes et charges par période</p>
        </div>
        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
          {sortedData.length} enregistrement{sortedData.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 text-slate-500 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-200/80">
              <th className="px-6 py-3.5">Période</th>
              <th className="px-4 py-3.5 text-center">Ventes Shopify</th>
              <th className="px-4 py-3.5 text-center">Ventes Amazon</th>
              <th className="px-4 py-3.5 text-right">CA Total</th>
              <th className="px-4 py-3.5 text-right">Expédition</th>
              <th className="px-6 py-3.5 text-right">Marge Nette</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-slate-400 font-medium">
                  Aucune donnée disponible pour cette période.
                </td>
              </tr>
            ) : (
              paginatedData.map((row) => {
                const marginPercent = row.totalRevenue > 0 ? (row.margin / row.totalRevenue) * 100 : 0;
                
                return (
                  <tr key={row.date} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-extrabold text-slate-900">
                          {row.shopifyOrdersCount || row.shopifySalesCount} <span className="text-[11px] font-medium text-slate-500">cmd</span>
                          {row.shopifySalesCount > (row.shopifyOrdersCount || 0) && (
                            <span className="text-[10px] text-slate-400 font-normal"> ({row.shopifySalesCount} art.)</span>
                          )}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-semibold">{formatCurrency(row.shopifyRevenue)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className="font-extrabold text-slate-900">
                          {row.amazonOrdersCount || row.amazonSalesCount} <span className="text-[11px] font-medium text-slate-500">cmd</span>
                          {row.amazonSalesCount > (row.amazonOrdersCount || 0) && (
                            <span className="text-[10px] text-slate-400 font-normal"> ({row.amazonSalesCount} art.)</span>
                          )}
                        </span>
                        <span className="text-[10px] text-amber-600 font-semibold">{formatCurrency(row.amazonRevenue)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-extrabold text-slate-900 text-sm">
                      {formatCurrency(row.totalRevenue)}
                    </td>
                    <td className="px-4 py-4 text-right text-slate-600 font-medium">
                      {formatCurrency(row.totalShipping)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className={`font-extrabold text-sm ${row.margin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatCurrency(row.margin)}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold mt-0.5 ${
                          row.margin >= 0 
                            ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' 
                            : 'text-red-700 bg-red-50 border border-red-200'
                        }`}>
                          {marginPercent.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* CONTROLES DE PAGINATION (20 lignes max) */}
      {totalPages > 1 && (
        <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <div>
            Affichage de <span className="font-bold text-slate-900">{startIndex + 1}</span> à{' '}
            <span className="font-bold text-slate-900">{Math.min(startIndex + itemsPerPage, sortedData.length)}</span> sur{' '}
            <span className="font-bold text-slate-900">{sortedData.length}</span> lignes
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-lg font-bold text-slate-700 transition-all shadow-xs"
            >
              <ChevronLeft className="w-4 h-4" />
              Précédent
            </button>
            <span className="font-bold text-slate-800 px-2">
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-lg font-bold text-slate-700 transition-all shadow-xs"
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
