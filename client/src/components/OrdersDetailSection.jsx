import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Package,
  Layers,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Tag,
  CreditCard,
  Truck,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { authFetch, getApiBase } from '../utils/api';

const API_BASE = getApiBase();

export default function OrdersDetailSection({ startDate, endDate, refreshTrigger }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('all'); // 'all', 'shopify', 'amazon'
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyMultiItems, setOnlyMultiItems] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  useEffect(() => {
    if (!startDate || !endDate) return;

    let isMounted = true;
    setLoading(true);

    authFetch(`${API_BASE}/orders?startDate=${startDate}&endDate=${endDate}`)
      .then(res => res.json())
      .then(data => {
        if (isMounted) {
          setOrders(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error("Erreur chargement détail des commandes :", err);
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [startDate, endDate, refreshTrigger]);

  const filteredOrders = orders.filter(order => {
    if (sourceFilter !== 'all' && order.source !== sourceFilter) return false;
    if (onlyMultiItems && order.items_count <= 1) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchNumber = (order.order_number || '').toLowerCase().includes(q);
      const matchSummary = (order.items_summary || '').toLowerCase().includes(q);
      if (!matchNumber && !matchSummary) return false;
    }
    return true;
  });

  // Métriques récapitulatives
  const totalOrdersCount = filteredOrders.length;
  const totalItemsCount = filteredOrders.reduce((sum, o) => sum + (o.items_count || 1), 0);
  const multiItemsOrdersCount = filteredOrders.filter(o => (o.items_count || 1) > 1).length;
  const avgItemsPerOrder = totalOrdersCount > 0 ? (totalItemsCount / totalOrdersCount).toFixed(2) : '1.00';
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.total_price || 0), 0);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(val || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
      {/* HEADER */}
      <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600/10 text-indigo-600 rounded-xl border border-indigo-100">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-slate-900">
              Détail par Commandes & Produits vendus
            </h4>
            <p className="text-xs text-slate-500 font-medium">
              Décomposition de chaque commande et de ses différents articles / exemplaires
            </p>
          </div>
        </div>

        {/* BADGES RÉCAPITULATIFS */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-900 rounded-xl text-xs font-bold">
            <ShoppingCart className="w-3.5 h-3.5 text-indigo-600" />
            <span><b>{totalOrdersCount}</b> commandes</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 text-emerald-900 rounded-xl text-xs font-bold">
            <Package className="w-3.5 h-3.5 text-emerald-600" />
            <span><b>{totalItemsCount}</b> produits vendus</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-100 text-amber-900 rounded-xl text-xs font-bold">
            <span>Ratio : <b>{avgItemsPerOrder}</b> art./cmd</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-100 text-purple-900 rounded-xl text-xs font-bold">
            <span><b>{multiItemsOrdersCount}</b> paniers multi-produits</span>
          </div>
        </div>
      </div>

      {/* FILTRES & BARRE DE RECHERCHE */}
      <div className="p-4 bg-slate-50/30 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* SOURCING TABS */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setSourceFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                sourceFilter === 'all'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tous ({orders.length})
            </button>
            <button
              onClick={() => setSourceFilter('shopify')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                sourceFilter === 'shopify'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Shopify ({orders.filter(o => o.source === 'shopify').length})
            </button>
            <button
              onClick={() => setSourceFilter('amazon')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                sourceFilter === 'amazon'
                  ? 'bg-white text-amber-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Amazon ({orders.filter(o => o.source === 'amazon').length})
            </button>
          </div>

          {/* TOGGLE COMMANDES MULTI-PRODUITS */}
          <button
            onClick={() => setOnlyMultiItems(!onlyMultiItems)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              onlyMultiItems
                ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Commandes à plusieurs produits ({orders.filter(o => (o.items_count || 1) > 1).length})
          </button>
        </div>

        {/* INPUT DE RECHERCHE */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher n° commande..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>
      </div>

      {/* TABLE DES COMMANDES */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="py-12 text-center text-xs font-medium text-slate-400 animate-pulse">
            Chargement des commandes détaillées...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-12 text-center text-xs font-medium text-slate-400">
            Aucune commande trouvée pour les critères sélectionnés.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/70 text-slate-600 text-[11px] font-extrabold uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-3">Commande</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3">Nb Articles</th>
                <th className="px-6 py-3">Détail des Produits vendus</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3">Livraison / Paiement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.map((order) => {
                const isMulti = (order.items_count || 1) > 1;
                const itemsList = order.items && order.items.length > 0
                  ? order.items
                  : [{ title: order.items_summary || 'Produit', quantity: order.items_count || 1, price: order.total_price }];

                return (
                  <tr key={order.order_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-3.5 font-black text-slate-900 whitespace-nowrap">
                      {order.order_number}
                    </td>

                    <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                      {formatDate(order.created_at)}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {order.source === 'shopify' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Shopify
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                          Amazon
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                        isMulti
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        <Package className="w-3.5 h-3.5" />
                        {order.items_count || 1} {order.items_count > 1 ? 'articles' : 'article'}
                      </span>
                    </td>

                    <td className="px-6 py-3.5">
                      <div className="flex flex-col gap-1 max-w-md">
                        {itemsList.map((it, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-3 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">
                            <span className="font-semibold text-slate-800 text-[11px] truncate" title={it.title}>
                              {it.title}
                            </span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100">
                                x{it.quantity}
                              </span>
                              {it.price > 0 && (
                                <span className="text-[10px] font-medium text-slate-500">
                                  {formatCurrency(it.price)}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-right font-black text-slate-900 whitespace-nowrap text-xs">
                      {formatCurrency(order.total_price)}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5 text-[10px] text-slate-500">
                        {order.shipping_method && (
                          <div className="flex items-center gap-1 text-slate-600">
                            <Truck className="w-3 h-3 text-slate-400" />
                            <span className="truncate max-w-[140px]" title={order.shipping_method}>
                              {order.shipping_method}
                            </span>
                          </div>
                        )}
                        {order.payment_method && (
                          <div className="flex items-center gap-1 text-slate-500">
                            <CreditCard className="w-3 h-3 text-slate-400" />
                            <span>{order.payment_method}</span>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
