import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api } from './api';
import { subscribeCommunity } from './communityStore';

export interface ExplorePage<T> { items: T[]; pagination?: { page: number; total: number; totalPages: number } }
type State<T> = { key: string | null; items: T[]; pages: number; hasMore: boolean; loading: boolean; error: unknown };

// Each resource owns its generation, error and pages. Invalidate immediately on
// input changes (before the debounce), including transitions to an empty query.
export function useExploreData<T>(path: string | null, delay = 0, account = '') {
  const key = path ? `${account}:${path}` : null;
  const [state, setState] = useState<State<T>>({ key: null, items: [], pages: 0, hasMore: false, loading: false, error: null });
  const current = useRef(state); current.current = state;
  const generation = useRef(0);
  const busy = useRef(false);
  const run = useCallback(async (append = false) => {
    if (!path || (append && busy.current)) return;
    const token = ++generation.current;
    busy.current = true;
    const previous = current.current.key === key ? current.current : null;
    const page = append ? (previous?.pages || 0) + 1 : 1;
    const count = append ? 1 : Math.max(1, previous?.pages || 1);
    setState(s => ({ key, items: s.key === key ? s.items : [], pages: previous?.pages || 0, hasMore: previous?.hasMore || false, loading: true, error: null }));
    try {
      // Revalidate all loaded pages on focus without shortening the list and
      // losing its scroll position. Removed publications disappear on return.
      const responses = await Promise.all(Array.from({ length: count }, (_, i) => api<ExplorePage<T>>(`${path}${path.includes('?') ? '&' : '?'}page=${page + i}`)));
      if (generation.current !== token) return;
      const lastPage = page + count - 1;
      const last = responses[responses.length - 1];
      const items = [...(append ? previous?.items || [] : []), ...responses.flatMap(r => r.items)];
      const unique = [...new Map(items.map(item => [(item as { _id: string })._id, item])).values()];
      setState({ key, items: unique, pages: lastPage, hasMore: lastPage < (last?.pagination?.totalPages || 1), loading: false, error: null });
    } catch (error) {
      if (generation.current === token) setState(s => ({ ...s, loading: false, error }));
    } finally { if (generation.current === token) busy.current = false; }
  }, [key, path]);
  useEffect(() => subscribeCommunity(event => {
    if (event.kind === 'reset' || event.kind === 'access') {
      generation.current++; busy.current = false;
      // Account changes dispose data. Following changes only revalidate these
      // public lists, preserving loaded pages and the detail-return offset.
      if (event.kind === 'reset') setState({ key: null, items: [], pages: 0, hasMore: false, loading: !!path, error: null });
      else void run();
    } else if (path === '/feed/top-logs' && event.kind === 'change' && event.id) {
      setState(s => ({ ...s, items: s.items.flatMap(item => {
        if ((item as { _id: string })._id !== event.id) return [item];
        return event.deleted || event.item?.visibility !== 'public' ? [] : [event.item as T];
      }) }));
    }
  }), [path, run]);
  useFocusEffect(useCallback(() => {
    generation.current++; busy.current = false;
    const timer = path ? setTimeout(() => { void run(); }, delay) : undefined;
    return () => { clearTimeout(timer); generation.current++; busy.current = false; };
  }, [path, delay, run]));
  const visible = state.key === key ? state : { items: [], pages: 0, hasMore: false, loading: !!path, error: null };
  return { ...visible, reload: () => run(), more: () => visible.hasMore && !visible.error && run(true) };
}
