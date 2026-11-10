import React, { useState, useEffect } from 'react';
import { Search, Save, Trash2, Plus, Edit2, X, AlertCircle, RefreshCw, CreditCard, Truck, Package, DollarSign, FileSpreadsheet, Copy, Check, Upload } from 'lucide-react';
import { authFetch, getApiBase } from '../utils/api';

const API_BASE = getApiBase();

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

  // État pour Google Sheet Ads Sync
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [savingSheet, setSavingSheet] = useState(false);
  const [sheetFeedback, setSheetFeedback] = useState(null);
  const [copiedScript, setCopiedScript] = useState(false);

  // État pour Import CSV Amazon Ads
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [csvFeedback, setCsvFeedback] = useState(null);

  const handleCsvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCsv(true);
    setCsvFeedback(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result;
        const res = await authFetch(`${API_BASE}/config/import-amazon-ads-csv`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csvText: text })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur lors du traitement du fichier CSV.');
        setCsvFeedback({
          type: 'success',
          text: `Succès : ${data.importedDays} jours de dépenses Amazon Ads importés et enregistrés !`
        });
        if (onConfigUpdated) onConfigUpdated();
      } catch (err) {
        setCsvFeedback({ type: 'error', text: err.message });
      } finally {
        setUploadingCsv(false);
      }
    };
    reader.onerror = () => {
      setCsvFeedback({ type: 'error', text: 'Impossible de lire le fichier sélectionné.' });
      setUploadingCsv(false);
    };
    reader.readAsText(file);
  };



  // Charger la configuration COGS
  const fetchConfig = async () => {
    setLoadingProducts(true);
    setError(null);
    try {
      const res = await authFetch(`${API_BASE}/config`);
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
      const res = await authFetch(`${API_BASE}/config/payment-fees`);
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
      const res = await authFetch(`${API_BASE}/config/shipping-costs`);
      if (res.ok) {
        const data = await res.json();
        setShippingCosts(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Charger URL Google Sheet
  const fetchGoogleSheetConfig = async () => {
    try {
      const res = await authFetch(`${API_BASE}/config/google-ads-sheet`);
      if (res.ok) {
        const data = await res.json();
        setGoogleSheetUrl(data.sheetUrl || '');
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchPaymentFees();
    fetchShippingCosts();
    fetchGoogleSheetConfig();
  }, []);

  // Sauvegarder Google Sheet URL
  const handleSaveGoogleSheet = async (e) => {
    e.preventDefault();
    setSavingSheet(true);
    setSheetFeedback(null);
    try {
      const res = await authFetch(`${API_BASE}/config/google-ads-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrl: googleSheetUrl })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la sauvegarde.');
      setSheetFeedback({
        type: 'success',
        text: data.rowsImported > 0 
          ? `Lien Google Sheet validé ! ${data.rowsImported} jours de dépenses Google Ads ont été immédiatement synchronisés.`
          : 'Lien Google Sheet enregistré avec succès.'
      });
      if (onConfigUpdated) onConfigUpdated();
    } catch (err) {
      setSheetFeedback({ type: 'error', text: err.message });
    } finally {
      setSavingSheet(false);
    }
  };

  // Sauvegarder COGS
  const handleSaveCogs = async (sku, source, name, cogs) => {
    try {
      const res = await authFetch(`${API_BASE}/config`, {
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
      await authFetch(`${API_BASE}/config/${sku}?source=${source}`, { method: 'DELETE' });
      await fetchConfig();
      if (onConfigUpdated) onConfigUpdated();
    } catch (err) {
      alert(err.message);
    }
  };

  // Sauvegarder frais de paiement
  const handleSavePaymentFee = async (code, name, percent_fee, fixed_fee) => {
    try {
      await authFetch(`${API_BASE}/config/payment-fees`, {
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
      await authFetch(`${API_BASE}/config/shipping-costs`, {
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
      await authFetch(`${API_BASE}/config/ad-spends`, {
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

          {/* SYNCHRONISATION GOOGLE ADS VIA GOOGLE SHEET */}
          <div className="border border-emerald-200/90 rounded-2xl p-6 bg-emerald-50/30 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="font-extrabold text-slate-900 text-sm">
                    Synchronisation Google Ads par Google Sheet (Recommandé & Automatique)
                  </h5>
                  <p className="text-xs text-slate-500 font-medium">
                    Google Ads exporte automatiquement les dépenses quotidiennes sur un Google Sheet, et le dashboard les synchronise en direct.
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                100% Automatique
              </span>
            </div>

            {sheetFeedback && (
              <div className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                sheetFeedback.type === 'success'
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                  : 'bg-red-100 text-red-900 border border-red-200'
              }`}>
                <span>{sheetFeedback.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveGoogleSheet} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Lien de partage de votre Google Sheet (Partage : « Tout utilisateur disposant du lien peut consulter »)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={googleSheetUrl}
                    onChange={(e) => setGoogleSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/edit..."
                    className="flex-1 bg-white border border-slate-300 text-slate-900 font-medium text-xs rounded-xl p-3 focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  <button
                    type="submit"
                    disabled={savingSheet}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-3 rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer flex-shrink-0"
                  >
                    <Save className="w-4 h-4" />
                    {savingSheet ? 'Vérification...' : 'Connecter & Synchroniser'}
                  </button>
                </div>
              </div>
            </form>

            {/* SCRIPT GOOGLE ADS PRÊT À L'EMPLOI */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900">
                  Script à coller dans votre compte Google Ads (Outils & Paramètres &gt; Scripts)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const scriptCode = `function main() {
  // 1. Collez ici l'URL de votre Google Sheet
  var SPREADSHEET_URL = "${googleSheetUrl || 'VOTRE_LIEN_GOOGLE_SHEET_ICI'}";
  
  var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  var sheet = ss.getActiveSheet();
  sheet.clear();
  sheet.appendRow(["Date", "Cost"]);
  
  // 2. Récupération des dépenses des 90 derniers jours
  var query = "SELECT segments.date, metrics.cost_micros " +
              "FROM customer " +
              "WHERE segments.date DURING LAST_90_DAYS " +
              "ORDER BY segments.date DESC";
              
  var report = AdsApp.search(query);
  var rows = [];
  
  while (report.hasNext()) {
    var row = report.next();
    var date = row.segments.date;
    var cost = (row.metrics.costMicros / 1000000).toFixed(2);
    rows.push([date, cost]);
  }
  
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 2).setValues(rows);
  }
  Logger.log(rows.length + " jours de dépenses Google Ads exportés.");
}`;
                    navigator.clipboard.writeText(scriptCode);
                    setCopiedScript(true);
                    setTimeout(() => setCopiedScript(false), 2500);
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-all cursor-pointer"
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedScript ? 'Copié dans le presse-papier !' : 'Copier le script Google Ads'}
                </button>
              </div>

              <div className="bg-slate-900 text-slate-100 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48 leading-relaxed">
                <pre>{`function main() {
  var SPREADSHEET_URL = "${googleSheetUrl || 'VOTRE_LIEN_GOOGLE_SHEET_ICI'}";
  var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  var sheet = ss.getActiveSheet();
  sheet.clear();
  sheet.appendRow(["Date", "Cost"]);
  
  var query = "SELECT segments.date, metrics.cost_micros FROM customer WHERE segments.date DURING LAST_90_DAYS ORDER BY segments.date DESC";
  var report = AdsApp.search(query);
  var rows = [];
  while (report.hasNext()) {
    var row = report.next();
    rows.push([row.segments.date, (row.metrics.costMicros / 1000000).toFixed(2)]);
  }
  if (rows.length > 0) sheet.getRange(2, 1, rows.length, 2).setValues(rows);
}`}</pre>
              </div>

              <p className="text-[11px] text-slate-500 font-medium">
                💡 <b>Astuce :</b> Dans Google Ads, définissez la fréquence d'exécution du script sur <b>Tous les jours à 06h00</b>. Votre Google Sheet sera toujours à jour automatiquement sans aucune intervention manuelle.
              </p>
            </div>
          </div>

          {/* IMPORT RAPPORT CSV AMAZON ADS */}
          <div className="border border-amber-200/90 rounded-2xl p-6 bg-amber-50/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-600 text-white rounded-xl shadow-xs">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="font-extrabold text-slate-900 text-sm">
                    Importer un Rapport CSV Amazon Ads (Campagnes Sponsored Products)
                  </h5>
                  <p className="text-xs text-slate-500 font-medium">
                    Téléchargez votre rapport quotidien depuis le gestionnaire de campagnes Amazon Ads et déposez-le ici pour synchroniser vos coûts.
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-3 py-1 bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                Import Direct
              </span>
            </div>

            {csvFeedback && (
              <div className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                csvFeedback.type === 'success'
                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                  : 'bg-red-100 text-red-900 border border-red-200'
              }`}>
                <span>{csvFeedback.text}</span>
              </div>
            )}

            <div className="bg-white border-2 border-dashed border-amber-300 hover:border-amber-500 rounded-2xl p-6 text-center transition-all">
              <input
                type="file"
                id="amazon-csv-input"
                accept=".csv"
                onChange={handleCsvUpload}
                disabled={uploadingCsv}
                className="hidden"
              />
              <label
                htmlFor="amazon-csv-input"
                className="flex flex-col items-center justify-center gap-2 cursor-pointer"
              >
                <div className="p-3 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
                  <Upload className={`w-6 h-6 ${uploadingCsv ? 'animate-bounce' : ''}`} />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-extrabold text-slate-800">
                    {uploadingCsv ? 'Traitement du fichier CSV en cours...' : 'Cliquez ici pour choisir ou glisser votre fichier CSV Amazon Ads'}
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Compatible avec les rapports de campagnes Amazon Ads (.csv)
                  </p>
                </div>
              </label>
            </div>
          </div>

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
