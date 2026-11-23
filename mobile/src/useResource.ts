import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api, ApiError } from './api';
import { useSession } from './session';
import { communityEpoch, subscribeCommunity } from './communityStore';
export function useResource<T>(path: string | null) {
  const accountId = useSession().user?._id || 'guest';
  const key = `${accountId}:${path}`; const loadedKey = useRef('');
  const [data, setData] = useState<T | null>(null); const [error, setError] = useState<unknown>(null); const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const request = ++generation.current;
    const epoch = communityEpoch();
    if (!path) { setLoading(false); return; }
    setLoading(true); setError(null);
    try { const result = await api<T>(path); if (request === generation.current && epoch === communityEpoch()) { loadedKey.current = key; setData(result); } }
    catch (e) { if (request === generation.current) { setError(e); if (e instanceof ApiError && [401, 403, 404].includes(e.status)) setData(null); } }
    finally { if (request === generation.current) setLoading(false); }
  }, [path, key]);
  useEffect(() => { setData(null); }, [key]);
  useEffect(() => subscribeCommunity(event => {
    if (event.kind === 'reset' || event.kind === 'access') { generation.current++; loadedKey.current = ''; setData(null); if (event.kind === 'access') void reload(); }
    else if (path && /^\/logs\/[^/]+(?:\?|$)/.test(path)) {
      if (event.created) void reload();
      else if (event.kind === 'change' && event.id) setData(previous => {
        const value = previous as { items?: { _id: string }[] } | null;
        if (!value?.items) return previous;
        return { ...value, items: value.items.flatMap(item => item._id !== event.id ? [item] : event.deleted ? [] : [event.item || item]) } as T;
      });
    }
  }), [path, reload]);
  useFocusEffect(useCallback(() => { void reload(); return () => { generation.current++; }; }, [reload]));
  return { data: loadedKey.current === key ? data : null, error, loading, reload, setData };
}
