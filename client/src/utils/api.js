/**
 * Helper centralisé pour les requêtes API avec authentification Bearer token automatique.
 */
export function getApiBase() {
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;
  if (typeof window !== 'undefined') {
    if (window.location.hostname.includes('trycloudflare.com') || 
        window.location.hostname.includes('192.168.') || 
        window.location.hostname.includes('loca.lt')) {
      return '/api';
    }
  }
  return 'http://localhost:3001/api';
}

export async function authFetch(url, options = {}) {
  const token = localStorage.getItem('lumios_admin_token');
  const headers = {
    ...(options.headers || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers
  });

  if (res.status === 401) {
    // Si le token est invalide ou expiré, déconnecter et réafficher le formulaire de login
    localStorage.removeItem('lumios_admin_token');
    localStorage.removeItem('lumios_admin_user');
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  return res;
}
