import type { FeedItem } from './types';
import { communityEpoch, communityRevision, feedKey, getLog, mergeFeed, orderFeed, subscribeCommunity } from './communityStore';

export interface FeedPage { items: FeedItem[]; hasMore: boolean; nextCursor: string | null; followingCount: number }
export interface FeedState { items: FeedItem[]; loading: boolean; loadingMore: boolean; loaded: boolean; error: unknown; moreError: unknown; nextCursor: string | null; followingCount: number }
const initial = (): FeedState => ({ items: [], loading: false, loadingMore: false, loaded: false, error: null, moreError: null, nextCursor: null, followingCount: 0 });
export class FeedController {
  state = initial();
  private generation = 0;
  private listeners = new Set<() => void>();
  private unsubscribe?: () => void;
  constructor(private request: (path: string) => Promise<FeedPage>) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  private set(patch: Partial<FeedState>) { this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener(); }
  connect() {
    this.unsubscribe = subscribeCommunity(event => {
      if (event.kind === 'reset' || event.kind === 'access') {
        this.generation++; this.set(initial()); if (event.kind === 'access') void this.refresh();
      } else if (event.kind === 'change') {
        if (event.deleted) this.set({ items: this.state.items.filter(item => feedKey(item) !== `log:${event.id}`) });
        else if (event.item) {
          const items = this.state.items.map(item => item.type === 'log' && item._id === event.id ? event.item! : item);
          this.set({ items: event.created && ['public', 'followers'].includes(event.item.visibility || '') ? orderFeed(mergeFeed(items, [event.item])) : items });
        }
      }
    });
    return () => { this.generation++; this.unsubscribe?.(); this.state = { ...this.state, loading: false, loadingMore: false }; };
  }
  private normalize(items: FeedItem[]) { return items.flatMap(item => { const cached = item.type === 'log' ? getLog(item._id) : undefined; return cached === null ? [] : [cached || item]; }); }
  refresh = async (): Promise<void> => {
    if (this.state.loading) return;
    const generation = ++this.generation, epoch = communityEpoch(), revision = communityRevision();
    this.set({ loading: true, loadingMore: false, error: null });
    try {
      const page = await this.request('/feed?scope=mixed');
      if (generation !== this.generation || epoch !== communityEpoch()) return;
      if (revision !== communityRevision()) { this.set({ loading: false }); return this.refresh(); }
      this.set({ items: mergeFeed([], this.normalize(page.items)), nextCursor: page.hasMore ? page.nextCursor : null, followingCount: page.followingCount, loaded: true, moreError: null });
    } catch (error) { if (generation === this.generation) this.set({ error }); }
    finally { if (generation === this.generation) this.set({ loading: false }); }
  };
  more = async () => {
    if (this.state.loading || this.state.loadingMore || !this.state.nextCursor) return;
    const generation = this.generation, epoch = communityEpoch(), cursor = this.state.nextCursor;
    this.set({ loadingMore: true, moreError: null });
    try {
      const page = await this.request(`/feed?scope=mixed&cursor=${encodeURIComponent(cursor)}`);
      if (generation !== this.generation || epoch !== communityEpoch()) return;
      this.set({ items: mergeFeed(this.state.items, this.normalize(page.items)), nextCursor: page.hasMore ? page.nextCursor : null });
    } catch (error) { if (generation === this.generation) this.set({ moreError: error }); }
    finally { if (generation === this.generation) this.set({ loadingMore: false }); }
  };
  unavailable(id: string) { this.set({ items: this.state.items.filter(item => feedKey(item) !== `chapter:${id}`) }); void this.refresh(); }
}
