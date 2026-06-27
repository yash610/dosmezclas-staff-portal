import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('dm_token');
    if (!token) { setLoading(false); return; }
    api.get('/api/auth/me')
      .then(setUser)
      .catch(() => { localStorage.removeItem('dm_token'); })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { token, user } = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('dm_token', token);
    setUser(user);
    return user;
  }

  async function register({ full_name, email, password, role, admin_code }) {
    const { token, user } = await api.post('/api/auth/register', {
      full_name, email, password, role, admin_code,
    });
    localStorage.setItem('dm_token', token);
    setUser(user);
    return user;
  }

  function logout() {
    localStorage.removeItem('dm_token');
    setUser(null);
  }

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
