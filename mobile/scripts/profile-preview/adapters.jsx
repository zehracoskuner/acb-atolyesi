import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { api, setAccountId } from '../../src/api';
const initial = { _id: 'owner', kullaniciAdi: 'deniz_yazar', email: 'owner@example.test', profileComplete: true };
setAccountId(initial._id);
const Session = createContext(null);
export function SessionProvider({ children }) {
  const [user, setUser] = useState(initial);
  useEffect(() => { setAccountId(user?._id || null); }, [user]);
  useEffect(() => { window.profileAccount = value => { setAccountId(value?._id || null); setUser(value); }; return () => delete window.profileAccount; }, []);
  return <Session.Provider value={{ user, loading: false, refresh: async () => setUser((await api('/auth/me')).user) }}>{children}</Session.Provider>;
}
export const useSession = () => useContext(Session);
export const useFocusEffect = callback => useEffect(callback, [callback]);
export const useLocalSearchParams = () => ({ id: location.hash.split('?')[0].split('/')[2], ...Object.fromEntries(new URLSearchParams(location.hash.split('?')[1])) });
const href = target => typeof target === 'string' ? target : target.pathname.replace(/\[([^\]]+)\]/g, (_, key) => target.params?.[key] || key) + '?' + new URLSearchParams(target.params);
export const router = {
  push: target => { location.hash = href(target); }, replace: target => { location.replace('#' + href(target)); },
  canGoBack: () => true, back: () => window.profileGuard ? window.profileGuard({ data: { action: () => history.back() } }) : history.back(),
  setParams: values => { const params = new URLSearchParams(location.hash.split('?')[1]); for (const [key, value] of Object.entries(values)) params.set(key, value); history.replaceState(null, '', location.hash.split('?')[0] + '?' + params); dispatchEvent(new HashChangeEvent('hashchange')); },
};
export const useNavigation = () => ({ dispatch: action => action() });
export const usePreventRemove = (enabled, callback) => useEffect(() => { window.profileGuard = enabled ? callback : null; return () => { window.profileGuard = null; }; }, [enabled, callback]);
Alert.alert = (title, message, buttons = []) => { if (window.confirm(title + '\n' + (message || ''))) buttons.find(b => b.style !== 'cancel')?.onPress?.(); };
// The native image-picker and multipart validation are tested separately in profileImages.test.ts.
export const pickAndUpload = (endpoint, field) => api(endpoint, 'POST', { qaFixture: field });
