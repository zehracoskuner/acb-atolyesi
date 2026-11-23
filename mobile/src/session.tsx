import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';
import { api, configureSession, ApiError, setAccountId } from './api';
import type { User } from './types';
type Session = { user: User | null; loading: boolean; expired: boolean; setLogin: (token: string, user: User) => Promise<void>; refresh: () => Promise<void>; logout: () => Promise<void> };
const Context = createContext<Session | null>(null);
export const useSession = () => useContext(Context)!;
export function SessionProvider({ children }: React.PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true); const [expired, setExpired] = useState(false);
  const expire = () => { configureSession(null); setAccountId(null); setUser(null); setExpired(true); void SecureStore.deleteItemAsync('acb.session'); void SecureStore.deleteItemAsync('acb.identity'); };
  const refresh = async () => { const result = await api<{ user: User }>('/auth/me'); setAccountId(result.user._id); setUser(result.user); await SecureStore.setItemAsync('acb.identity', JSON.stringify(result.user)); };
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync('acb.session');
        if (saved && active) {
          configureSession(saved, expire, () => { void refresh().catch(() => {}); });
          const network = await NetInfo.fetch();
          if (network.isConnected === false || network.isInternetReachable === false) {
            const cached = await SecureStore.getItemAsync('acb.identity');
            if (cached) { const account: User = JSON.parse(cached); setAccountId(account._id); setUser(account); }
            return;
          }
          try { await refresh(); } catch (error) {
            if (!(error instanceof ApiError) || error.status !== 0) throw error;
            const cached = await SecureStore.getItemAsync('acb.identity');
            if (cached && active) { const account: User = JSON.parse(cached); setAccountId(account._id); setUser(account); }
          }
        }
      } catch { if (active) expire(); } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  // Session bootstrap runs once. Subsequent changes use setLogin/refresh.
  }, []);
  const setLogin = async (value: string, account: User) => {
    await SecureStore.setItemAsync('acb.session', value);
    await SecureStore.setItemAsync('acb.identity', JSON.stringify(account));
    configureSession(value, expire, () => { void refresh().catch(() => {}); }); setAccountId(account._id); setExpired(false); setUser(account);
  };
  const logout = async () => {
    // Keep the session if revocation fails; show the error and let the user retry.
    const pushToken = await SecureStore.getItemAsync('acb.push');
    try {
      if (pushToken) await api('/mobile/push-device', 'DELETE', { token: pushToken });
      await api('/auth/logout', 'POST', {});
    } catch (error) {
      // A password change revokes the old session. Local cleanup must still finish.
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
    }
    await SecureStore.deleteItemAsync('acb.session'); await SecureStore.deleteItemAsync('acb.identity');
    await SecureStore.deleteItemAsync('acb.push'); configureSession(null); setAccountId(null); setUser(null);
  };
  return <Context.Provider value={{ user, loading, expired, setLogin, refresh, logout }}>{children}</Context.Provider>;
}
