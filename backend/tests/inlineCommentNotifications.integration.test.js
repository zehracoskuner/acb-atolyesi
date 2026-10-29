import { beforeAll, afterAll, beforeEach, it, expect, vi } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Work from '../models/Work.js';
import Chapter from '../models/Chapter.js';
import InlineComment from '../models/InlineComment.js';
import Notification from '../models/Notification.js';
import MentionCooldown from '../models/MentionCooldown.js';
import AuthSession from '../models/AuthSession.js';
import inlineRouter from '../routes/inlineComments.js';
import { createNativeSession } from '../services/authSession.js';
import { newTermsAcceptance } from '../config/terms.js';

let mongo, server, base, users, tokens, work, chapter;
const models = [User, Work, Chapter, InlineComment, Notification, MentionCooldown, AuthSession];
beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', randomBytes(48).toString('hex'));
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.14', downloadDir: fileURLToPath(new URL('../node_modules/.cache/mongodb-binaries', import.meta.url)) } });
  await mongoose.connect(mongo.getUri(), { dbName: 'inline_notification_test' });
  await Promise.all(models.map(model => model.init()));
  const app = express(); app.use(express.json()); app.use('/inline-comments', inlineRouter);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
}, 120000);
afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect(); await mongo?.stop(); vi.unstubAllEnvs();
});
beforeEach(async () => {
  await Promise.all(models.map(model => model.deleteMany({})));
  users = await User.create([0, 1].map(i => ({ email: `inline${i}@test.local`, kullaniciAdi: `inline${i}`, birthYear: 1990, ...newTermsAcceptance() })));
  tokens = await Promise.all(users.map(createNativeSession));
  work = await Work.create({ user: users[0]._id, title: 'Book', status: 'published' });
  chapter = await Chapter.create({ work: work._id, title: 'First', content: '<p>Paragraph</p>', status: 'published' });
  await Work.updateOne({ _id: work._id }, { publishedChapterIds: [chapter._id] });
});
async function post(content = 'Paragraph comment', user = 1) {
  return fetch(`${base}/inline-comments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens[user]}` },
    body: JSON.stringify({ workId: String(work._id), chapterId: String(chapter._id), paragraphIndex: 0, content }),
  });
}
it('persists an unread owner notification with the comment and exact chapter', async () => {
  expect((await post()).status).toBe(201);
  const notifications = await Notification.find({ recipient: users[0]._id }).lean();
  expect(notifications).toHaveLength(1);
  expect(notifications[0]).toMatchObject({ type: 'comment', read: false });
  expect(String(notifications[0].sender)).toBe(String(users[1]._id));
  expect(String(notifications[0].work)).toBe(String(work._id));
  expect(String(notifications[0].chapter)).toBe(String(chapter._id));
  expect(notifications[0].text).toContain('Paragraph comment');
});
it('does not notify owners about their own comments', async () => {
  expect((await post('My comment', 0)).status).toBe(201);
  expect(await Notification.countDocuments()).toBe(0);
});
it('sends only the mention when the owner is tagged', async () => {
  expect((await post('@inline0 Hello')).status).toBe(201);
  const notifications = await Notification.find({ recipient: users[0]._id }).lean();
  expect(notifications).toHaveLength(1);
  expect(notifications[0].type).toBe('mention');
});
it('does not notify when comment creation is rejected', async () => {
  await User.updateOne({ _id: users[1]._id }, { commentBanned: true });
  expect((await post()).status).toBe(403);
  expect(await Notification.countDocuments()).toBe(0);
  expect(await InlineComment.countDocuments()).toBe(0);
});
