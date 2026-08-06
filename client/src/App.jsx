import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import ConfigPanel from './components/ConfigPanel';
import Login from './components/Login';
import { LayoutDashboard, Settings, BarChart3, LogOut, UserCheck } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('lumios_admin_user');
    const token = localStorage.getItem('lumios_admin_token');
    return (savedUser && token) ? JSON.parse(savedUser) : null;
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Appelé quand les COGS sont modifiés pour forcer le dashboard à se mettre à jour
  const handleConfigUpdated = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleLogout = () => {
    localStorage.removeItem('lumios_admin_token');
    localStorage.removeItem('lumios_admin_user');
    setUser(null);
  };

  if (!user) {
    return <Login onLoginSuccess={(userData) => setUser(userData)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* HEADER BANNER / NAVBAR */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-600/20">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 leading-tight">Lumios Analytics</h1>
              <p className="text-[11px] font-medium text-slate-500">Shopify & Amazon Seller Dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Tab Navigation */}
            <nav className="flex bg-slate-100/80 border border-slate-200 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                  activeTab === 'dashboard'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Tableau de bord
              </button>
              <button
                onClick={() => setActiveTab('config')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                  activeTab === 'config'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Settings className="w-4 h-4" />
                Configuration
              </button>
            </nav>

            {/* Admin User Info & Logout Button */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200 text-[11px] font-extrabold text-slate-700">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>{user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                title="Se déconnecter"
                className="flex items-center gap-1.5 p-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-xl border border-slate-200 hover:border-red-200 transition-all cursor-pointer text-xs font-extrabold"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' ? (
          <Dashboard refreshTrigger={refreshTrigger} />
        ) : (
          <ConfigPanel onConfigUpdated={handleConfigUpdated} />
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4">
          <p>© {new Date().getFullYear()} Lumios Analytics. Suivi simplifié des marges, expéditions et rentabilité nettes.</p>
        </div>
      </footer>
    </div>
  );
}
