import React, { useState, useEffect } from 'react';
import { Search, Save, Trash2, Plus, Edit2, X, AlertCircle, RefreshCw, CreditCard, Truck, Package, DollarSign } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

export default function ConfigPanel({ onConfigUpdated }) {
  const [activeTab, setActiveTab] = useState('cogs'); // 'cogs', 'payment', 'shipping', 'ads'

  // États pour les COGS Produits
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState('all');

  const [newProduct, setNewProduct] = useState({ sku: '', name: '', source: 'shopify', cogs: '' });
  const [editingSku, setEditingSku] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  // États pour Frais de Règlement & Expédition
  const defaultPaymentFees = [
    { code: 'cb', name: 'Carte Bancaire / Stripe', percent_fee: 1.4, fixed_fee: 0.25 },
    { code: 'paypal', name: 'PayPal', percent_fee: 2.9, fixed_fee: 0.35 }
  ];
  const defaultShippingCosts = [
    { code: 'domicile', name: 'Livraison Domicile (Colissimo/DPD)', cost_per_order: 5.50 },
    { code: 'relais', name: 'Livraison Point Relais (Mondial Relay)', cost_per_order: 3.50 },
    { code: 'express', name: 'Livraison Express 24h', cost_per_order: 12.99 }
  ];

  const [paymentFees, setPaymentFees] = useState(defaultPaymentFees);
  const [shippingCosts, setShippingCosts] = useState(defaultShippingCosts);

  // États pour Dépenses Ads
  const [adSpendsInput, setAdSpendsInput] = useState({
    monthYear: '2026-07',
    facebook: '614.00',
    google: '2103.00',
    amazon: '718.39'
  });
  const [savingAds, setSavingAds] = useState(false);



  // Charger la configuration COGS
  const fetchConfig = async () => {
    setLoadingProducts(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/config`);
      if (!res.ok) throw new Error('Impossible de charger la configuration.');
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Charger Frais de Règlement
  const fetchPaymentFees = async () => {
    try {
      const res = await fetch(`${API_BASE}/config/payment-fees`);
      if (res.ok) {
        const data = await res.json();
        setPaymentFees(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Charger Frais d'Expédition
  const fetchShippingCosts = async () => {
    try {
      const res = await fetch(`${API_BASE}/config/shipping-costs`);
      if (res.ok) {
        const data = await res.json();
        setShippingCosts(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchPaymentFees();
    fetchShippingCosts();
  }, []);

  // Sauvegarder COGS
  const handleSaveCogs = async (sku, source, name, cogs) => {
    try {
      const res = await fetch(`${API_BASE}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, name, source, cogs })
      });
      if (!res.ok) throw new Error('Erreur de sauvegarde.');
      await fetchConfig();
      setEditingSku(null);
      if (onConfigUpdated) onConfigUpdated();
    } catch (err) {
      alert(err.message);
    }
  };

  // Créer un produit
  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (!newProduct.sku || !newProduct.cogs) return;
    await handleSaveCogs(newProduct.sku.trim(), newProduct.source, newProduct.name.trim() || newProduct.sku.trim(), parseFloat(newProduct.cogs));
    setNewProduct({ sku: '', name: '', source: 'shopify', cogs: '' });
  };

  // Supprimer COGS
  const handleDeleteProduct = async (sku, source) => {
    if (!confirm(`Supprimer le SKU ${sku} ?`)) return;
    try {
      await fetch(`${API_BASE}/config/${sku}?source=${source}`, { method: 'DELETE' });
      await fetchConfig();
      if (onConfigUpdated) onConfigUpdated();
    } catch (err) {
      alert(err.message);
    }
  };

  // Sauvegarder frais de paiement
  const handleSavePaymentFee = async (code, name, percent_fee, fixed_fee) => {
    try {
      await fetch(`${API_BASE}/config/payment-fees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, percent_fee, fixed_fee })
      });
      await fetchPaymentFees();
      if (onConfigUpdated) onConfigUpdated();
    } catch (err) {
      alert('Erreur lors de la mise à jour des frais.');
    }
  };

  // Sauvegarder frais de livraison
  const handleSaveShippingCost = async (code, name, cost_per_order) => {
    try {
      await fetch(`${API_BASE}/config/shipping-costs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, cost_per_order })
      });
      await fetchShippingCosts();
      if (onConfigUpdated) onConfigUpdated();
    } catch (err) {
      alert('Erreur lors de la mise à jour de la livraison.');
    }
  };

  // Sauvegarder dépenses Ads
  const handleSaveAdSpends = async (e) => {
    e.preventDefault();
    setSavingAds(true);
    try {
      const date = `${adSpendsInput.monthYear}-01`;
      await fetch(`${API_BASE}/config/ad-spends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch: [
            { date, source: 'facebook', spend: parseFloat(adSpendsInput.facebook) || 0.0 },
            { date, source: 'google', spend: parseFloat(adSpendsInput.google) || 0.0 },
            { date, source: 'amazon', spend: parseFloat(adSpendsInput.amazon) || 0.0 }
          ]
        })
      });
      alert('Dépenses Ads enregistrées avec succès pour la période sélectionnée !');
      if (onConfigUpdated) onConfigUpdated();
    } catch (err) {
      alert('Erreur lors de la sauvegarde des dépenses Ads.');
    } finally {
      setSavingAds(false);
    }
  };

  const productList = (Array.isArray(products) ? products : []).filter(p => {
    const pSku = String(p.sku || '').toUpperCase();
    const pName = String(p.name || '').toUpperCase();
    // Ne garder que les vrais produits vendus sur la boutique (Lumios)
    return pName.includes('LUMIOS') || pSku.includes('LUMIOS') || pSku.includes('AMAZON-DEFAULT') || p.source === 'shopify' || p.source === 'amazon';
  });

  const filteredProducts = productList.filter(p => {
    const pSku = String(p.sku || '');
    const pName = String(p.name || '');
    const matchesSearch = pSku.toLowerCase().includes(search.toLowerCase()) || pName.toLowerCase().includes(search.toLowerCase());
    const matchesSource = filterSource === 'all' || p.source === filterSource;
    return matchesSearch && matchesSource;
  });

  return (
    <div className="space-y-6">
      {/* HEADER PANNEAU */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">Paramètres de Marge & Rentabilité</h3>
          <p className="text-xs text-slate-500 font-medium">Gérez le coût de vos produits, les commissions bancaires, la livraison et vos dépenses Ads</p>
        </div>

        {/* NAVIGATION DES ONGLETS DE CONFIGURATION */}
        <div className="flex flex-wrap bg-slate-100/80 border border-slate-200 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('cogs')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'cogs' ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/50' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Produits (COGS)
          </button>
          <button
            onClick={() => setActiveTab('payment')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'payment' ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/50' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Paiement (CB/PayPal)
          </button>
          <button
            onClick={() => setActiveTab('shipping')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'shipping' ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/50' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            Expédition
          </button>
          <button
            onClick={() => setActiveTab('ads')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'ads' ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/50' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Dépenses Ads
          </button>
        </div>
      </div>

      {/* ONGLET 1 : PRODUITS & COGS */}
      {activeTab === 'cogs' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* FORMULAIRE D'AJOUT */}
          <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs h-fit">
            <h4 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-600" />
              Nouveau Produit / SKU
            </h4>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Source</label>
                <select
                  value={newProduct.source}
                  onChange={e => setNewProduct({ ...newProduct, source: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-2.5 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="shopify">Shopify</option>
                  <option value="amazon">Amazon</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">SKU</label>
                <input
                  type="text"
                  required
                  placeholder="ex: LUMIOS01"
                  value={newProduct.sku}
                  onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Nom du produit</label>
                <input
                  type="text"
                  placeholder="ex: LUMIOS LE JEU"
                  value={newProduct.name}
                  onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Coût d'Achat (COGS en €)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={newProduct.cogs}
                  onChange={e => setNewProduct({ ...newProduct, cogs: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl p-2.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 rounded-xl transition shadow-xs"
              >
                Ajouter à la liste
              </button>
            </form>
          </div>

          {/* LISTE DES PRODUITS */}
          <div className="lg:col-span-2 bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher SKU ou nom..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl pl-9 pr-3 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex bg-slate-100/80 p-1 rounded-xl w-full sm:w-auto border border-slate-200/60">
                <button
                  onClick={() => setFilterSource('all')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    filterSource === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Tous
                </button>
                <button
                  onClick={() => setFilterSource('shopify')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    filterSource === 'shopify' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Shopify
                </button>
                <button
                  onClick={() => setFilterSource('amazon')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    filterSource === 'amazon' ? 'bg-white text-amber-600 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Amazon
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 font-extrabold uppercase tracking-wider border-b border-slate-200/80">
                    <th className="px-4 py-3">Canal</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Nom</th>
                    <th className="px-4 py-3 text-right">Coût d'Achat</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400 font-medium">
                        Aucun SKU configuré.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map(p => (
                      <tr key={`${p.sku}_${p.source}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 font-semibold">
                          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
                            p.source === 'shopify' 
                              ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' 
                              : 'text-amber-700 bg-amber-50 border border-amber-200'
                          }`}>
                            {p.source.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{p.sku}</td>
                        <td className="px-4 py-3 max-w-[160px] truncate font-medium text-slate-800">{p.name}</td>
                        <td className="px-4 py-3 text-right font-extrabold text-slate-900">
                          {editingSku === `${p.sku}_${p.source}` ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <input
                                type="number"
                                step="0.01"
                                className="w-16 bg-white border border-indigo-500 rounded-lg text-right px-1.5 py-0.5 text-xs font-bold text-slate-900 focus:outline-none"
                                value={editingValue}
                                onChange={e => setEditingValue(e.target.value)}
                              />
                              <span className="text-slate-500">€</span>
                            </div>
                          ) : (
                            `${p.cogs.toFixed(2)} €`
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-1.5">
                            {editingSku === `${p.sku}_${p.source}` ? (
                              <>
                                <button
                                  onClick={() => handleSaveCogs(p.sku, p.source, p.name, parseFloat(editingValue))}
                                  className="p-1 hover:bg-emerald-50 text-emerald-600 rounded-lg transition"
                                  title="Enregistrer"
                                >
                                  <Save className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingSku(null)}
                                  className="p-1 hover:bg-slate-100 text-slate-400 rounded-lg transition"
                                  title="Annuler"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingSku(`${p.sku}_${p.source}`);
                                    setEditingValue(p.cogs.toString());
                                  }}
                                  className="p-1 hover:bg-indigo-50 text-indigo-600 rounded-lg transition"
                                  title="Modifier"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(p.sku, p.source)}
                                  className="p-1 hover:bg-red-50 text-red-600 rounded-lg transition"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ONGLET 2 : FRAIS DE RÈGLEMENT (CB vs PAYPAL) */}
      {activeTab === 'payment' && (
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-6">
          <div>
            <h4 className="text-base font-extrabold text-slate-900">Commissions & Frais de Paiement</h4>
            <p className="text-xs text-slate-500 font-medium">Définissez le pourcentage et les frais fixes prélevés par votre processeur de paiement (ex: Stripe, Shopify Payments, PayPal)</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {paymentFees.map((fee) => (
              <div key={fee.code} className="border border-slate-200/80 rounded-xl p-5 space-y-4 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-indigo-600" />
                    <h5 className="font-extrabold text-slate-900 text-sm">{fee.name}</h5>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    {fee.code}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Commission (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      defaultValue={fee.percent_fee}
                      onBlur={(e) => handleSavePaymentFee(fee.code, fee.name, parseFloat(e.target.value), fee.fixed_fee)}
                      className="w-full bg-white border border-slate-300 text-slate-900 font-bold text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Frais Fixe (€ par commande)</label>
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={fee.fixed_fee}
                      onBlur={(e) => handleSavePaymentFee(fee.code, fee.name, fee.percent_fee, parseFloat(e.target.value))}
                      className="w-full bg-white border border-slate-300 text-slate-900 font-bold text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ONGLET 3 : COÛTS D'EXPÉDITION (SHOPIFY & AMAZON FBA) */}
      {activeTab === 'shipping' && (
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-6">
          <div>
            <h4 className="text-base font-extrabold text-slate-900">Coûts de Livraison & Expédition</h4>
            <p className="text-xs text-slate-500 font-medium">Définissez le coût réel moyen de livraison supporté par votre boutique Shopify et les frais d'expédition Amazon FBA</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {shippingCosts.map((ship) => (
              <div key={ship.code} className="border border-slate-200/80 rounded-xl p-5 space-y-4 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-indigo-600" />
                    <h5 className="font-extrabold text-slate-900 text-sm">{ship.name}</h5>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    {ship.code}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Coût par Expédition (€ HT)</label>
                  <input
                    type="number"
                    step="0.10"
                    defaultValue={ship.cost_per_order}
                    onBlur={(e) => handleSaveShippingCost(ship.code, ship.name, parseFloat(e.target.value))}
                    className="w-full bg-white border border-slate-300 text-slate-900 font-bold text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            ))}

            {/* EXPÉDITION AMAZON FBA / TRANSPORT */}
            <div className="border border-amber-200/80 rounded-xl p-5 space-y-4 bg-amber-50/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-amber-600" />
                  <h5 className="font-extrabold text-slate-900 text-sm">Frais d'Expédition Amazon (FBA / Transport)</h5>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                  AMAZON-FBA
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Frais FBA par Produit Vendu (€ HT)</label>
                <input
                  type="number"
                  step="0.10"
                  defaultValue="4.25"
                  className="w-full bg-white border border-slate-300 text-slate-900 font-bold text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[11px] text-slate-500 mt-1 font-medium">Frais fixes prélevés par Amazon par article expédié via FBA.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ONGLET 4 : DÉPENSES PUBLICITAIRES (ADS) */}
      {activeTab === 'ads' && (
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-6">
          <div>
            <h4 className="text-base font-extrabold text-slate-900">Dépenses Publicitaires (Facebook, Google, Amazon Ads)</h4>
            <p className="text-xs text-slate-500 font-medium">Saisissez les budgets marketing investis sur chaque régie pour calculer le ROAS et le CPA réels</p>
          </div>

          <form onSubmit={handleSaveAdSpends} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-slate-50/50 border border-slate-200/80 rounded-xl">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mois & Année (AAAA-MM)</label>
              <input
                type="month"
                value={adSpendsInput.monthYear}
                onChange={(e) => setAdSpendsInput({ ...adSpendsInput, monthYear: e.target.value })}
                className="w-full bg-white border border-slate-300 text-slate-900 font-bold text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Facebook Ads (€)</label>
              <input
                type="number"
                step="0.01"
                placeholder="ex: 1072.00"
                value={adSpendsInput.facebook}
                onChange={(e) => setAdSpendsInput({ ...adSpendsInput, facebook: e.target.value })}
                className="w-full bg-white border border-slate-300 text-slate-900 font-bold text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Google Ads (€)</label>
              <input
                type="number"
                step="0.01"
                placeholder="ex: 2540.00"
                value={adSpendsInput.google}
                onChange={(e) => setAdSpendsInput({ ...adSpendsInput, google: e.target.value })}
                className="w-full bg-white border border-slate-300 text-slate-900 font-bold text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amazon Ads (€)</label>
              <input
                type="number"
                step="0.01"
                placeholder="ex: 718.39"
                value={adSpendsInput.amazon}
                onChange={(e) => setAdSpendsInput({ ...adSpendsInput, amazon: e.target.value })}
                className="w-full bg-white border border-slate-300 text-slate-900 font-bold text-xs rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="md:col-span-4 flex justify-end mt-2">
              <button
                type="submit"
                disabled={savingAds}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {savingAds ? 'Enregistrement...' : 'Enregistrer les Dépenses Ads'}
              </button>
            </div>
          </form>

          {/* CONNECTEURS API INFORMATIONS */}
          <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl text-xs text-indigo-900 space-y-2">
            <h5 className="font-extrabold flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-indigo-600" />
              Connexions API Automatiques (Meta Ads / Google Ads / Amazon Ads)
            </h5>
            <p className="text-indigo-800/90 leading-relaxed">
              Vos dépenses sont actuellement enregistrées par mois. Si vous souhaitez connecter directement l'API Meta Marketing ou l'API Google Ads REST via vos identifiants développeur, les connecteurs sont prêts à synchroniser automatiquement les dépenses au jour le jour.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
