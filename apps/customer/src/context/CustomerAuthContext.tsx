import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface CustomerUser {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  preferredUpiApp?: string | null;
}

interface CustomerAuthCtx {
  user: CustomerUser | null;
  token: string | null;
  login: (user: CustomerUser, token: string) => void;
  logout: () => void;
  isLoggedIn: boolean;
}

const CustomerAuthContext = createContext<CustomerAuthCtx>({
  user: null, token: null, isLoggedIn: false,
  login: () => {}, logout: () => {},
});

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CustomerUser | null>(() => {
    try {
      const s = localStorage.getItem('customer_user');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('customer_token'));

  const login = useCallback((u: CustomerUser, t: string) => {
    localStorage.setItem('customer_user', JSON.stringify(u));
    localStorage.setItem('customer_token', t);
    setUser(u);
    setToken(t);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('customer_user');
    localStorage.removeItem('customer_token');
    setUser(null);
    setToken(null);
  }, []);

  return (
    <CustomerAuthContext.Provider value={{ user, token, login, logout, isLoggedIn: !!user }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export const useCustomerAuth = () => useContext(CustomerAuthContext);
