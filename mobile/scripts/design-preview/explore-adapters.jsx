import React, { createContext, useContext, useEffect } from 'react';
import { setAccountId } from '../../src/api';
const user = { _id: 'reader', kullaniciAdi: 'okur', email: 'reader@example.test', profileComplete: true };
export const useSession = () => ({ user: new URLSearchParams(location.search).has('guest') ? null : user, loading: false, refresh: async () => {} });
setAccountId(new URLSearchParams(location.search).has('guest') ? null : user._id);
const Focus = createContext(true);
export const FocusProvider = Focus.Provider;
export function useFocusEffect(callback) { const focused = useContext(Focus); useEffect(() => focused ? callback() : undefined, [focused, callback]); }
export const useIsFocused = () => useContext(Focus);
const href = target => typeof target === 'string' ? target : target.pathname.replace(/\[([^\]]+)\]/g, (_, key) => target.params?.[key] || key) + '?' + new URLSearchParams(target.params);
export const router = { push: target => { location.hash = href(target); }, back: () => history.back(), canGoBack: () => true, replace: target => location.replace('#' + href(target)) };
export function useLocalSearchParams() { return { id: location.hash.split('/')[2]?.split('?')[0], ...Object.fromEntries(new URLSearchParams(location.hash.split('?')[1])) }; }
export const useSync = () => ({ online: true, tick: 0, issues: [], sync: async () => {} });
export default { fetch: async () => ({ isConnected: true, isInternetReachable: true }) };
export const pickAndUpload = async () => null;
export const GoogleSignin = {};
export const Stack = Object.assign(({ children }) => <>{children}</>, { Screen: () => null });
