import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  adminLogin as adminLoginRequest,
  adminRegister as adminRegisterRequest,
  customerLogin as customerLoginRequest,
  customerRegister as customerRegisterRequest,
  fetchCurrentUser,
  logout as logoutRequest,
} from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrapAuth() {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = await fetchCurrentUser();
        setUser(currentUser);
      } catch {
        localStorage.removeItem('auth_token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    bootstrapAuth();
  }, []);

  async function register(payload) {
    const data = await customerRegisterRequest(payload);
    localStorage.setItem('auth_token', data.token);
    setUser(data.user);
    return data;
  }

  async function login(payload) {
    const data = await customerLoginRequest(payload);
    localStorage.setItem('auth_token', data.token);
    setUser(data.user);
    return data;
  }

  async function registerAdmin(payload) {
    return adminRegisterRequest(payload);
  }

  async function loginAdmin(payload) {
    const data = await adminLoginRequest(payload);
    localStorage.setItem('auth_token', data.token);
    setUser(data.user);
    return data;
  }

  async function logout() {
    try {
      await logoutRequest();
    } finally {
      localStorage.removeItem('auth_token');
      setUser(null);
    }
  }

  function updateUser(nextUser) {
    setUser(nextUser);
  }

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isAdmin: ['admin', 'super_admin'].includes(user?.role) && user?.admin_status === 'approved',
      isSuperAdmin: user?.role === 'super_admin' && user?.admin_status === 'approved',
      loading,
      register,
      login,
      registerAdmin,
      loginAdmin,
      logout,
      updateUser
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}
