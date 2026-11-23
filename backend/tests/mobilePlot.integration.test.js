import { beforeAll, afterAll, expect, it, vi } from 'vitest';
vi.mock('dotenv/config', () => ({}));
vi.mock('../services/emailService.js', () => ({ sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn(), sendEmailVerifyOtp: vi.fn(), sendStaffMail: vi.fn() }));
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import auth from '../routes/auth.js';
import plots from '../routes/plots.js';
import world from '../routes/world.js';
import mobile from '../routes/mobile.js';
import User from '../models/User.js';
import Work from '../models/Work.js';
import Plot from '../models/Plot.js';
import Chapter from '../models/Chapter.js';
import '../models/Character.js';
import { newTermsAcceptance } from '../config/terms.js';
let repl, server, base, token, user;
beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', randomUUID() + randomUUID());
  repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(repl.getUri(), { dbName: `plot_test_${randomUUID().replaceAll('-', '')}` });
  user = await User.create({ email: 'plot@example.test', kullaniciAdi: 'harita_yazari', sifreHash: await bcrypt.hash('test-password-123', 4), emailVerified: true, profileComplete: true, birthYear: 1990, ...newTermsAcceptance() });
  const app = express(); app.use(express.json()); app.use(cookieParser());
  for (const [name, route] of Object.entries({ auth, plots, world, mobile })) app.use(`/api/${name}`, route);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}/api`;
  token = (await request('/auth/login', 'POST', { email: 'plot@example.test', sifre: 'test-password-123', client: 'native' })).data.token;
}, 600000);
afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (repl) await repl.stop(); vi.unstubAllEnvs(); }, 30000);
async function request(path, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
}
const newWork = () => Work.create({ user: user._id, title: 'Harita ' + randomUUID() });
const create = async (work, title, act = 'giris') => (await request(`/plots/${work._id}/scenes`, 'POST', { title, act })).data.scene;
const read = async work => (await request(`/plots/${work._id}`)).data.plot;

it('moves against the entire act atomically, preserves hidden order and rejects stale or foreign targets', async () => {
  const work = await newWork(); const foreign = await newWork();
  const a = await create(work, 'A'); const hidden = await create(work, 'Aramada görünmeyen'); const b = await create(work, 'B'); const c = await create(work, 'C', 'sonuc');
  const other = await create(foreign, 'Diğer eser'); const snapshot = await read(work);
  expect((await request(`/mobile/tools/scenes/${a._id}?workId=${foreign._id}`)).status).toBe(404);
  expect((await read(foreign)).scenes.map(s => s._id)).toEqual([other._id]);
  const moved = await request(`/mobile/plots/${work._id}/move`, 'POST', { sceneId: b._id, act: 'giris', beforeId: a._id, expectedUpdatedAt: snapshot.updatedAt });
  expect(moved.status).toBe(200);
  const sorted = act => async () => (await read(work)).scenes.filter(s => s.act === act).sort((a, b) => a.order - b.order).map(s => s._id);
  expect(await sorted('giris')()).toEqual([b._id, a._id, hidden._id]);
  expect((await request(`/mobile/plots/${work._id}/move`, 'POST', { sceneId: a._id, act: 'sonuc', expectedUpdatedAt: snapshot.updatedAt })).status).toBe(409);
  const latest = await read(work);
  expect((await request(`/mobile/plots/${work._id}/move`, 'POST', { sceneId: a._id, act: 'sonuc', beforeId: other._id, expectedUpdatedAt: latest.updatedAt })).status).toBe(409);
  expect((await request(`/mobile/plots/${work._id}/move`, 'POST', { sceneId: a._id, act: 'sonuc', beforeId: c._id, expectedUpdatedAt: latest.updatedAt })).status).toBe(200);
  expect(await sorted('giris')()).toEqual([b._id, hidden._id]); expect(await sorted('sonuc')()).toEqual([a._id, c._id]);
});

it('validates links in the same work, preserves incoming directions and deletes only the connection', async () => {
  const work = await newWork(); const foreign = await newWork(); const a = await create(work, 'Kaynak'); const b = await create(work, 'Hedef'); const c = await create(foreign, 'Yabancı');
  const connect = body => request(`/plots/${work._id}/scenes/${a._id}/connect`, 'PATCH', body);
  expect((await connect({ targetId: a._id })).status).toBe(400);
  expect((await connect({ targetId: c._id })).status).toBe(400);
  expect((await connect({ targetId: b._id, edgeType: 'kesif' })).status).toBe(200);
  await connect({ targetId: b._id, edgeType: 'karar' });
  let plot = await read(work); expect(plot.scenes.find(s => s._id === a._id).connections).toHaveLength(1);
  expect(plot.scenes.find(s => s._id === a._id).connections[0]).toMatchObject({ target: b._id, edgeType: 'kesif' });
  expect(plot.scenes.find(s => s._id === b._id).connections).toHaveLength(0);
  expect((await request(`/plots/${work._id}/scenes/${a._id}/disconnect`, 'PATCH', { targetId: b._id })).status).toBe(200);
  plot = await read(work); expect(plot.scenes).toHaveLength(2); expect(plot.scenes.find(s => s._id === a._id).connections).toHaveLength(0);
  const concurrent = await Promise.all([connect({ targetId: b._id, edgeType: 'karar' }), connect({ targetId: b._id, edgeType: 'karar' })]);
  expect(concurrent.some(result => result.status === 200)).toBe(true);
  expect(concurrent.every(result => [200, 409].includes(result.status))).toBe(true);
  expect((await read(work)).scenes.find(s => s._id === a._id).connections).toHaveLength(1);
});

it('saves partial versioned scene text, retains hidden web fields and never writes a chapter', async () => {
  const work = await newWork(); const a = await create(work, 'Eski sahne', 'legacy-act'); const b = await create(work, 'Dal', 'legacy-act');
  const chapter = await Chapter.create({ work: work._id, title: 'Bölüm', content: '<p>Değişmeyen bölüm</p>', status: 'draft', order: 4 });
  await Plot.updateOne({ work: work._id }, { $set: { 'scenes.0.position': { x: 902, y: 801 }, 'scenes.0.isAlternative': true, 'scenes.0.time': 'Üç yıl önce', 'scenes.0.chapter': chapter._id, 'scenes.0.connections': [{ target: b._id, edgeType: 'karar' }] } });
  const beforeChapter = JSON.stringify(await Chapter.findById(chapter._id).lean());
  const remote = (await request(`/mobile/tools/scenes/${a._id}?workId=${work._id}`)).data.saved;
  const body = { workId: String(work._id), recordId: a._id, draftId: 'scene-save', expectedVersion: remote.version, partial: true, data: { draftText: 'Yeni metin\nİstanbul', status: 'done', volume: 'long' } };
  expect((await request('/mobile/tools/scenes', 'POST', body)).status).toBe(200);
  const stale = await request('/mobile/tools/scenes', 'POST', { ...body, data: { draftText: 'Eski cihaz' } }); expect(stale.status).toBe(409);
  expect((await read(work)).scenes[0]).toMatchObject({ draftText: 'Yeni metin\nİstanbul', position: { x: 902, y: 801 }, isAlternative: true, time: 'Üç yıl önce', chapter: String(chapter._id), act: 'legacy-act', status: 'done', volume: 'long' });
  expect((await request(`/world/${work._id}`, 'PATCH', { structure: { templateId: 'epik', acts: [{ id: 'dunya', label: 'Sıradan Dünya' }] } })).status).toBe(200);
  expect((await read(work)).scenes.map(s => s._id)).toEqual([a._id, b._id]);
  const plot = await read(work);
  expect((await request(`/mobile/plots/${work._id}/move`, 'POST', { sceneId: a._id, act: 'dunya', expectedUpdatedAt: plot.updatedAt })).status).toBe(200);
  expect((await read(work)).scenes[0].connections[0].target).toBe(b._id);
  await request(`/plots/${work._id}/scenes/${a._id}`, 'DELETE');
  expect(JSON.stringify(await Chapter.findById(chapter._id).lean())).toBe(beforeChapter);
});

it('creates once on retry and rejects blank or invalid scene saves without altering data', async () => {
  const work = await newWork(); const body = { workId: String(work._id), draftId: 'new-retry', data: { title: '', description: '', goal: '', act: 'giris', status: 'idea', draftText: '', characters: [] } };
  expect((await request('/mobile/tools/scenes', 'POST', body)).status).toBe(400);
  expect((await read(work)).scenes).toHaveLength(0);
  body.data.title = 'İlk sahne'; const first = await request('/mobile/tools/scenes', 'POST', body); expect(first.status).toBe(200);
  const retry = await request('/mobile/tools/scenes', 'POST', body); expect(retry.data.saved.recordId).toBe(first.data.saved.recordId); expect((await read(work)).scenes).toHaveLength(1);
  expect((await request('/mobile/tools/scenes', 'POST', { ...body, recordId: first.data.saved.recordId, expectedVersion: first.data.saved.version, data: { title: '' } })).status).toBe(400);
  expect((await read(work)).scenes[0].title).toBe('İlk sahne');
});
