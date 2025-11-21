import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api, { getToken, setToken } from '../api/client';

const AuthContext = createContext({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {}
});

const LOCAL_USER_KEY = 'auth_user';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    const storedUser = localStorage.getItem(LOCAL_USER_KEY);
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const persistUser = (userData, token) => {
    setToken(token);
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(userData));
    setUser(userData);
  };

  const login = async (credentials) => {
    const { user: userData, token } = await api.post('/auth/login', credentials);
    persistUser(userData, token);
    return userData;
  };

  const register = async (payload) => {
    const { user: userData, token } = await api.post('/auth/register', payload);
    persistUser(userData, token);
    return userData;
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem(LOCAL_USER_KEY);
    setUser(null);
  };

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
