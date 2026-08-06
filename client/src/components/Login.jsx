import React, { useState } from 'react';
import { Lock, Mail, ShieldCheck, ArrowRight, AlertCircle, BarChart3 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('davhuin@gmail.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Identifiants incorrects.');
      }

      localStorage.setItem('lumios_admin_token', data.token);
      localStorage.setItem('lumios_admin_user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Dynamic Background Elements */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md space-y-8 bg-slate-900/90 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl shadow-indigo-950/40 relative z-10 animate-fadeIn">
        {/* Header Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-3 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-2xl mb-1 shadow-inner">
            <BarChart3 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">Lumios Analytics</h2>
          <p className="text-xs text-slate-400 font-medium">Espace Administration & Dashboard Financier P&L</p>
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-950/60 border border-red-800/80 text-red-300 text-xs rounded-2xl animate-shake">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Adresse E-mail Admin
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="davhuin@gmail.com"
                className="w-full pl-10 pr-4 py-3 bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 text-xs font-bold rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Mot de Passe Administrateur
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-3 bg-slate-800/90 border border-slate-700 text-white placeholder-slate-500 text-xs font-bold rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs py-3.5 px-4 rounded-2xl shadow-lg shadow-indigo-600/30 transition-all transform active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              <span>{loading ? 'Connexion en cours...' : 'Se connecter au Dashboard'}</span>
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        </form>

        <div className="pt-4 border-t border-slate-800/80 text-center flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Accès privé réservé à davhuin@gmail.com</span>
        </div>
      </div>
    </div>
  );
}
