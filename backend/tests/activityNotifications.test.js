import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../models/User.js', () => ({ default: { find: vi.fn() } }));
vi.mock('../models/Notification.js', () => ({ default: { insertMany: vi.fn() } }));
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { notifyNewLog, notifyNewChapter, notifyNewRegistration } from '../services/activityNotifications.js';
import { notificationTarget } from '../../frontend/src/lib/notificationTarget.js';
beforeEach(() => {
  vi.clearAllMocks();
  const query = { select: () => query, session: () => query, lean: async () => [{ _id: 'reader', birthYear: 1990 }, { _id: 'minor', birthYear: 2012 }] };
  User.find.mockReturnValue(query);
});
it('keeps private logs out of follower inboxes', async () => {
  await notifyNewLog({ visibility: 'private' });
  expect(User.find).not.toHaveBeenCalled();
  await notifyNewLog({ _id: 'log', author: 'author', visibility: 'followers' });
  expect(User.find).toHaveBeenCalledWith(expect.objectContaining({ following: 'author' }));
  expect(Notification.insertMany.mock.calls[0][0][0]).toMatchObject({ type: 'new_log', log: 'log', sender: 'author' });
});
it('only announces first publication, respecting anonymity and age', async () => {
  const work = { _id: 'work', user: 'author', contentWarning: true };
  const chapter = { _id: 'chapter', status: 'published' };
  for (const value of [{ ...chapter, status: 'pending_review' }, { ...chapter, firstPublishedAt: new Date() }, { ...chapter, $locals: { previouslyPublished: true } }]) await notifyNewChapter(value, work, 'session');
  await notifyNewChapter(chapter, { ...work, isAnonymous: true }, 'session');
  expect(Notification.insertMany).not.toHaveBeenCalled();
  await notifyNewChapter(chapter, work, 'session');
  expect(Notification.insertMany).toHaveBeenCalledWith([expect.objectContaining({ recipient: 'reader', chapter: 'chapter' })], { session: 'session' });
});
it('addresses registration events to admins and links to the new profile', async () => {
  await notifyNewRegistration({ _id: 'new', kullaniciAdi: 'Deniz' });
  expect(User.find).toHaveBeenCalledWith({ role: 'admin', _id: { $ne: 'new' } });
  expect(notificationTarget({ type: 'new_registration', sender: 'new' }).path).toBe('/profile/new');
  expect(notificationTarget({ type: 'new_chapter', work: 'w', chapter: 'c' }).path).toBe('/read/w?chapter=c');
  expect(notificationTarget({ type: 'new_log', sender: 'author', log: 'l' }).path).toBe('/profile/author?tab=log&log=l');
});
