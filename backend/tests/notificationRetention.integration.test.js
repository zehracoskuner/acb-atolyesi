import { beforeAll, afterAll, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import User from '../models/User.js';
import '../models/Work.js';
import '../models/Chapter.js';
import AuthSession from '../models/AuthSession.js';
import Notification from '../models/Notification.js';
import PushDelivery from '../models/PushDelivery.js';
import WebPushDelivery from '../models/WebPushDelivery.js';
import router from '../routes/notifications.js';
import { createNativeSession, createWebSession } from '../services/authSession.js';
import { newTermsAcceptance } from '../config/terms.js';
import { prepareNotificationRetention } from '../services/notificationRetention.js';

let mongo, server, base, user, now, cutoff;
const retainedModels = [Notification, PushDelivery, WebPushDelivery];
beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', 'notification-retention-isolated-test-secret-123456789');
  mongo = await MongoMemoryServer.create({
    binary: { version: '7.0.14', downloadDir: fileURLToPath(new URL('../node_modules/.cache/mongodb-binaries', import.meta.url)) },
    instance: { args: ['--setParameter', 'ttlMonitorEnabled=false', '--setParameter', 'ttlMonitorSleepSecs=1'] },
  });
  await mongoose.connect(mongo.getUri(), { dbName: 'notification_retention_test', autoIndex: false });
  await prepareNotificationRetention();
  const app = express();
  app.use(express.json(), cookieParser());
  app.use('/api/notifications', router);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api/notifications`;
}, 120000);
afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  await mongo?.stop();
  vi.unstubAllEnvs();
});
beforeEach(async () => {
  await mongoose.connection.db.admin().command({ setParameter: 1, ttlMonitorEnabled: false });
  await Promise.all([...retainedModels, User, AuthSession].map(model => model.deleteMany({})));
  now = Date.now();
  cutoff = now - 90 * 86400 * 1000;
  user = await User.create({ email: 'retention@test.example', kullaniciAdi: 'retention',
    birthYear: 1990, profileComplete: true, ...newTermsAcceptance() });
});
afterEach(() => vi.restoreAllMocks());

async function seedNotification(age, read = false, recipient = user._id) {
  return Notification.create({ recipient, type: 'follow', text: 'Test notification', read,
    createdAt: new Date(age), updatedAt: new Date(now) });
}

it('installs 90-day TTL indexes even with autoIndex disabled and can run again', async () => {
  await prepareNotificationRetention();
  for (const model of retainedModels) {
    const indexes = await model.collection.indexes();
    expect(indexes.find(index => index.key.createdAt === 1)).toMatchObject({ expireAfterSeconds: 7776000 });
  }
});

it.each(['web', 'mobile'])('%s excludes expired read/unread items and the exact boundary before TTL deletion', async client => {
  vi.spyOn(Date, 'now').mockReturnValue(now);
  await seedNotification(cutoff - 1);
  await seedNotification(cutoff - 1, true);
  await seedNotification(cutoff);
  const oldestActive = await seedNotification(cutoff + 1);
  const recent = await seedNotification(now - 1000, true);
  await seedNotification(now - 500, false, new mongoose.Types.ObjectId());
  let headers;
  if (client === 'mobile') headers = { Authorization: `Bearer ${await createNativeSession(user)}` };
  else {
    let token;
    await createWebSession({}, { cookie: (name, value) => { token = value; }, set: () => {} }, user, false);
    headers = { Cookie: `token=${token}` };
  }
  // Prove the API is filtering, rather than relying on the database monitor.
  expect(await Notification.countDocuments()).toBe(6);
  const response = await fetch(base, { headers });
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.items.map(item => item._id)).toEqual([String(recent._id), String(oldestActive._id)]);
  expect(body.unreadCount).toBe(1);
  const marked = await fetch(`${base}/${oldestActive._id}/read`, { method: 'PATCH', headers });
  expect(marked.status).toBe(200);
  expect((await Notification.findById(oldestActive._id)).createdAt.getTime()).toBe(cutoff + 1);
  expect((await (await fetch(base, { headers })).json()).unreadCount).toBe(0);
});

it('physically deletes expired notifications and delivery records while preserving recent ones', async () => {
  await seedNotification(cutoff - 86400000);
  await seedNotification(cutoff - 86400000, true);
  await seedNotification(now);
  for (const model of [PushDelivery, WebPushDelivery]) {
    await model.collection.insertMany([cutoff - 86400000, now].map(time => ({
      notification: new mongoose.Types.ObjectId(), createdAt: new Date(time), updatedAt: new Date(now),
    })));
  }
  await mongoose.connection.db.admin().command({ setParameter: 1, ttlMonitorEnabled: true });
  await expect.poll(async () => Promise.all(retainedModels.map(model => model.countDocuments())), {
    timeout: 10000, interval: 200,
  }).toEqual([1, 1, 1]);
  expect((await Notification.findOne()).createdAt.getTime()).toBe(now);
}, 15000);
