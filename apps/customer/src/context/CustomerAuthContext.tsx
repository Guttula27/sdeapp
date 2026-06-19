import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { setupPushNotifications, teardownPushNotifications } from '../utils/pushSetup';

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
    // Drop the FCM / Web Push subscription on the way out so the next
    // user signing in on the same device doesn't receive alerts
    // intended for this account.
    void teardownPushNotifications();
    localStorage.removeItem('customer_user');
    localStorage.removeItem('customer_token');
    setUser(null);
    setToken(null);
  }, []);

  // Register the device's push subscription on sign-in. Fire-and-
  // forget — failure here is non-fatal (the in-app socket alerts +
  // 45 s polling fallback from CustomerAlertsContext still cover
  // foreground / quickly-backgrounded cases). Only runs once per
  // (userId, deviceToken) — the helper de-dupes internally.
  useEffect(() => {
    if (!user?.id || !token) return;
    void setupPushNotifications();
  }, [user?.id, token]);

  return (
    <CustomerAuthContext.Provider value={{ user, token, login, logout, isLoggedIn: !!user }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export const useCustomerAuth = () => useContext(CustomerAuthContext);
