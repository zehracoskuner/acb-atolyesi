import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedController, type FeedPage } from '../src/feedController';
import { clearCommunity, feedKey, getLog, ingestLog, lockLog, receiveCommunity, unlockLog } from '../src/communityStore';
import { journalDraftKey, parseJournalDraft } from '../src/journalDraft';
import type { FeedItem } from '../src/types';
const log = (id: string, visibility: FeedItem['visibility'] = 'public'): FeedItem => ({ _id: id, type: 'log', content: id, createdAt: '2026-10-28T10:00:00Z', likeCount: 0, likedByMe: false, visibility });
const page = (items: FeedItem[], nextCursor: string | null = null): FeedPage => ({ items, nextCursor, hasMore: !!nextCursor, followingCount: 1 });
beforeEach(() => clearCommunity());
describe('feed requests and shared journal state', () => {
  it('retains loaded pages after failed refresh and serializes requests for the same cursor', async () => {
    let release!: (p: FeedPage) => void;
    const request = vi.fn().mockResolvedValueOnce(page([log('one')], 'cursor')).mockImplementationOnce(() => new Promise(r => { release = r; }));
    const feed = new FeedController(request); const close = feed.connect(); await feed.refresh();
    const more = feed.more(); await feed.more(); expect(request).toHaveBeenCalledTimes(2);
    release(page([log('one'), log('two'), { ...log('two'), type: 'chapter' }])); await more;
    expect(feed.state.items.map(feedKey)).toEqual(['log:one', 'log:two', 'chapter:two']);
    request.mockRejectedValueOnce(new Error('offline')); await feed.refresh();
    expect(feed.state.items).toHaveLength(3); expect(feed.state.error).toBeInstanceOf(Error); close();
  });
  it('discards a late pagination response after refresh', async () => {
    let release!: (p: FeedPage) => void;
    const request = vi.fn().mockResolvedValueOnce(page([log('old')], 'cursor')).mockImplementationOnce(() => new Promise(r => { release = r; })).mockResolvedValueOnce(page([log('fresh')]));
    const feed = new FeedController(request); const close = feed.connect(); await feed.refresh();
    const pending = feed.more(); await feed.refresh(); release(page([log('stale')])); await pending;
    expect(feed.state.items.map(i => i._id)).toEqual(['fresh']); close();
  });
  it('purges data on account changes and unfollow, even when old requests finish late', async () => {
    let release!: (p: FeedPage) => void;
    const request = vi.fn().mockImplementationOnce(() => new Promise(r => { release = r; })).mockResolvedValue(page([log('public')]));
    const feed = new FeedController(request); const close = feed.connect(); const old = feed.refresh();
    ingestLog(log('restricted', 'followers')); clearCommunity();
    release(page([log('restricted', 'followers')])); await old;
    expect(feed.state.items).toEqual([]); expect(getLog('restricted')).toBeUndefined();
    clearCommunity('access'); await vi.waitFor(() => expect(feed.state.items.map(i => i._id)).toEqual(['public'])); close();
  });
  it('shares confirmed journal changes and never changes a same-id chapter', async () => {
    const feed = new FeedController(async () => page([log('same'), { ...log('same'), type: 'chapter' }])); const close = feed.connect(); await feed.refresh();
    ingestLog(log('same')); receiveCommunity('/logs/same/like', 'POST', { likedByMe: true, likeCount: 1 });
    expect(getLog('same')).toMatchObject({ likedByMe: true, likeCount: 1 });
    expect(feed.state.items[1]).toMatchObject({ type: 'chapter', likedByMe: false, likeCount: 0 });
    receiveCommunity('/logs/same/comments', 'POST', { item: { _id: 'comment' } }); expect(getLog('same')?.commentCount).toBe(1);
    receiveCommunity('/logs/same', 'PATCH', { item: { ...log('same'), content: 'edited' } }); expect(feed.state.items[0]?.content).toBe('edited');
    receiveCommunity('/logs/same', 'DELETE', {}); expect(feed.state.items.map(feedKey)).toEqual(['chapter:same']); expect(getLog('same')).toBeNull(); close();
  });
  it('adds public/follower journals once but keeps private creation out of the feed', async () => {
    const feed = new FeedController(async () => page([])); const close = feed.connect(); await feed.refresh();
    for (const visibility of ['public', 'followers', 'private'] as const) receiveCommunity('/logs', 'POST', { item: log(visibility, visibility) });
    expect(feed.state.items.map(i => i._id).sort()).toEqual(['followers', 'public']);
    expect(getLog('private')?.visibility).toBe('private'); close();
  });
  it('locks a journal action across surfaces and resets locks between accounts', () => {
    expect(lockLog('one')).toBe(true); expect(lockLog('one')).toBe(false); unlockLog('one'); expect(lockLog('one')).toBe(true);
    clearCommunity(); expect(lockLog('one')).toBe(true);
  });
});
describe('local journal drafts', () => {
  it('isolates users and edit drafts and never silently cuts over-limit text or changes visibility', () => {
    expect(journalDraftKey('one')).not.toBe(journalDraftKey('two'));
    expect(journalDraftKey('one')).not.toBe(journalDraftKey('one', 'log'));
    const draft = { content: 'a'.repeat(3000), visibility: 'private', relatedWork: 'work' };
    expect(parseJournalDraft(JSON.stringify(draft))).toEqual(draft);
    expect(() => parseJournalDraft(JSON.stringify({ ...draft, visibility: 'typo' }))).toThrow();
  });
});
