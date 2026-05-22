// src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { getUser, clearUser, authFetch } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getUser();
    if (!stored.token) { setLoading(false); return; }

    authFetch('/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setUser({ ...stored, isAdmin: data.is_admin, isSuper: data.is_super, role: data.role });
        else      { clearUser(); }
      })
      .catch(() => clearUser())
      .finally(() => setLoading(false));
  }, []);

  function logout() {
    clearUser();
    setUser(null);
    window.location.href = '/chat';  // hard reload — wipes all React state instantly
  }

  return (
    <AuthContext.Provider value={{ user, setUser, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
