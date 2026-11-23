// Test-only navigation/session adapters. All application requests use the real api.ts.
import React, { useEffect, useState } from 'react';
import { setAccountId } from '../../src/api';
let account = new URLSearchParams(location.search).has('guest') ? null : { _id: 'viewer', kullaniciAdi: 'deniz_yazar', profileComplete: true };
setAccountId(account?._id || null);
window.changeFeedAccount = value => { account = value; setAccountId(value?._id || null); window.dispatchEvent(new Event('qa-account')); };
export function useSession() {
  const [user, setUser] = useState(account);
  useEffect(() => { const update = () => setUser(account); window.addEventListener('qa-account', update); return () => window.removeEventListener('qa-account', update); }, []);
  return { user, loading: false };
}
export const useFocusEffect = callback => useEffect(callback, [callback]);
let guard;
export function usePreventRemove(enabled, callback) { useEffect(() => { guard = enabled ? callback : null; return () => { guard = null; }; }, [enabled, callback]); }
const href = target => typeof target === 'string' ? target : target.pathname.replace(/\[([^\]]+)\]/g, (_, key) => target.params[key]) + '?' + new URLSearchParams(target.params);
export const router = { push: target => { location.hash = href(target); }, replace: target => location.replace('#' + href(target)), back: () => guard ? guard() : history.back(), canGoBack: () => true };
export function useLocalSearchParams() { return Object.fromEntries(new URLSearchParams(location.hash.split('?')[1])); }
