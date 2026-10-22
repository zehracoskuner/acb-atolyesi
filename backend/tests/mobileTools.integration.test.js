import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
vi.mock('dotenv/config', () => ({}));
vi.mock('../services/emailService.js', () => ({ sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn(), sendEmailVerifyOtp: vi.fn(), sendStaffMail: vi.fn() }));
// This suite sends a bulk of independent saves in seconds; quotas have their own tests.
vi.mock('../middlewares/rateLimiter.js', async importOriginal => ({ ...(await importOriginal()), writeLimiter: (_req, _res, next) => next() }));
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import auth from '../routes/auth.js';
import mobile from '../routes/mobile.js';
import notes from '../routes/notes.js';
import workNotes from '../routes/workNotes.js';
import characters from '../routes/characters.js';
import plots from '../routes/plots.js';
import world from '../routes/world.js';
import Work from '../models/Work.js';
import User from '../models/User.js';
import Note from '../models/Note.js';
import { newTermsAcceptance } from '../config/terms.js';

const initial = { title: 'Çağrı’nın notu', content: '<h2>İstanbul</h2><p><strong>Yağmur</strong> ve <em>öykü</em>.</p>', body: '<p>Üç şehir.</p>',
  name: 'Gezgin', role: 'Anlatıcı', tagline: 'Kendi sesini arar', notes: 'Türkçe notlar', description: 'Sabah', goal: 'Tanışma', act: 'giris', status: 'idea', draftText: 'İlk sahne', characters: [] };
describe('mobile form durability contract on real routes and MongoDB', () => {
  let repl, server, base, token, otherToken, workId;
  beforeAll(async () => {
    vi.stubEnv('JWT_SECRET', randomUUID() + randomUUID());
    repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(repl.getUri(), { dbName: `mobile_forms_${randomUUID().replaceAll('-', '')}` });
    for (const name of ['author', 'other']) await User.create({ email: `${name}@example.test`, kullaniciAdi: `forms_${name}`, sifreHash: await bcrypt.hash('real-test-password', 4), emailVerified: true, profileComplete: true, birthYear: 1990, ...newTermsAcceptance() });
    const app = express(); app.use(express.json());
    app.use('/api/auth', auth); app.use('/api/mobile', mobile); app.use('/api/notes', notes);
    app.use('/api/works/:workId/notes', workNotes); app.use('/api/characters', characters); app.use('/api/plots', plots); app.use('/api/world', world);
    app.use((error, _req, res, _next) => res.status(error.status || 500).json({ message: error.message }));
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); base = `http://127.0.0.1:${server.address().port}/api`;
    token = (await request('/auth/login', 'POST', { email: 'author@example.test', sifre: 'real-test-password', client: 'native' }, '')).data.token;
    otherToken = (await request('/auth/login', 'POST', { email: 'other@example.test', sifre: 'real-test-password', client: 'native' }, '')).data.token;
    const owner = await User.findOne({ email: 'author@example.test' });
    workId = String((await Work.create({ user: owner._id, title: 'Yağmurun Öyküsü' }))._id);
  }, 600000);
  afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (repl) await repl.stop(); vi.unstubAllEnvs(); }, 30000);
  async function request(path, method = 'GET', body, credential = token) {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: r.status, data: await r.json() };
  }
  const options = kind => ({ ...(kind !== 'personal' ? { workId } : {}), ...(kind === 'world' ? { category: 'locations' } : {}) });
  const mutation = kind => ({ ...options(kind), draftId: randomUUID(), data: { ...initial } });

  it.each(['personal', 'notes', 'characters', 'scenes', 'world'])('preserves %s and rejects an old version after a legacy web edit', async kind => {
    const body = mutation(kind); const created = await request(`/mobile/tools/${kind}`, 'POST', body);
    expect(created.status).toBe(200);
    const saved = created.data.saved; expect(saved.version).toMatch(/^[a-f\d]{64}$/);
    const query = new URLSearchParams(options(kind));
    expect((await request(`/mobile/tools/${kind}/${saved.recordId}?${query}`)).data.saved).toEqual(saved);
    const legacyPath = kind === 'personal' ? `/notes/${saved.recordId}` : kind === 'notes' ? `/works/${workId}/notes/${saved.recordId}` : kind === 'characters' ? `/characters/${saved.recordId}` : kind === 'scenes' ? `/plots/${workId}/scenes/${saved.recordId}` : `/world/${workId}/entries/${saved.recordId}`;
    const changed = kind === 'personal' ? { content: '<p>Web yeni metin.</p>' } : kind === 'notes' ? { body: '<p>Web yeni metin.</p>' } : kind === 'characters' ? { workId, notes: 'Web karakter notu' } : kind === 'scenes' ? { draftText: 'Web sahne metni' } : { category: 'locations', notes: 'Web dünya notu' };
    expect((await request(legacyPath, kind === 'notes' ? 'PUT' : 'PATCH', changed)).status).toBe(200);
    const stale = await request(`/mobile/tools/${kind}`, 'POST', { ...body, recordId: saved.recordId, expectedVersion: saved.version });
    expect(stale.status).toBe(409); expect(stale.data.current.version).not.toBe(saved.version);
    expect((await request(`/mobile/tools/${kind}/${saved.recordId}?${query}`)).data.saved).toEqual(stale.data.current);
    const explicit = await request(`/mobile/tools/${kind}`, 'POST', { ...body, recordId: saved.recordId, expectedVersion: stale.data.current.version });
    expect(explicit.status).toBe(200);
    for (const [key, value] of Object.entries(saved.data)) expect(explicit.data.saved.data[key]).toEqual(value);
  });

  it('makes retried creation idempotent and exposes divergent retries as a conflict', async () => {
    const body = mutation('personal');
    const [a, b] = await Promise.all([request('/mobile/tools/personal', 'POST', body), request('/mobile/tools/personal', 'POST', body)]);
    expect(a.status).toBe(200); expect(b.status).toBe(200); expect(a.data.saved).toEqual(b.data.saved);
    expect(await Note.countDocuments({ _id: a.data.saved.recordId })).toBe(1);
    const changed = await request('/mobile/tools/personal', 'POST', { ...body, data: { ...initial, content: '<p>Yanıt kaybından sonraki yeni metin.</p>' } });
    expect(changed.status).toBe(409); expect(changed.data.current).toEqual(a.data.saved);
  });
  it('allows only one of two simultaneous writes using the same version', async () => {
    const body = mutation('personal'); const { data: { saved } } = await request('/mobile/tools/personal', 'POST', body);
    const results = await Promise.all(['Bir', 'İki'].map(title => request('/mobile/tools/personal', 'POST', { ...body, recordId: saved.recordId, expectedVersion: saved.version, data: { ...initial, title } })));
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    const winner = results.find(result => result.status === 200).data.saved;
    expect((await request(`/mobile/tools/personal/${saved.recordId}`)).data.saved).toEqual(winner);
  });
  it('enforces record ownership and never returns another account’s text', async () => {
    const body = mutation('personal'); const { data: { saved } } = await request('/mobile/tools/personal', 'POST', body);
    const denied = await request(`/mobile/tools/personal/${saved.recordId}`, 'GET', undefined, otherToken);
    expect(denied.status).toBe(404); expect(denied.data.saved).toBeUndefined();
    expect((await request('/mobile/tools/scenes', 'POST', mutation('scenes'), otherToken)).status).toBe(403);
    expect((await request('/mobile/tools/personal', 'POST', body, '')).status).toBe(401);
  });
  it('requires an explicit version and keeps note formatting while removing executable markup', async () => {
    const body = { ...mutation('personal'), data: { ...initial, content: initial.content + '<script>alert(1)</script><img src=x onerror=alert(1)>' } };
    const { data: { saved } } = await request('/mobile/tools/personal', 'POST', body);
    expect(saved.data.content).toBe(initial.content);
    expect((await request('/mobile/tools/personal', 'POST', { ...body, recordId: saved.recordId })).status).toBe(400);
  });
  it.each(['scenes', 'world'])('isolates %s records and atomically rejects two competing writes to the same nested item', async kind => {
    const body = mutation(kind); const { data: { saved } } = await request(`/mobile/tools/${kind}`, 'POST', body);
    expect((await request(`/mobile/tools/${kind}`, 'POST', mutation(kind))).status).toBe(200);
    const independent = await request(`/mobile/tools/${kind}`, 'POST', { ...body, recordId: saved.recordId, expectedVersion: saved.version, data: { ...initial, title: 'İlk değişiklik', name: 'İlk değişiklik' } });
    expect(independent.status).toBe(200);
    const results = await Promise.all(['Bir', 'İki'].map(value => request(`/mobile/tools/${kind}`, 'POST', { ...body, recordId: saved.recordId, expectedVersion: independent.data.saved.version, data: { ...initial, title: value, name: value } })));
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
  });
  it.each(['personal', 'notes'])('preserves legacy %s newlines and literal markup while keeping the web field plain', async kind => {
    const original = 'İlk satır\nİkinci <bir> & üçüncü satır\n';
    const endpoint = kind === 'personal' ? '/notes' : `/works/${workId}/notes`; const field = kind === 'personal' ? 'content' : 'body';
    const created = await request(endpoint, 'POST', { title: 'Düz metin', [field]: original });
    const recordId = created.data.item._id;
    const { data: { saved } } = await request(`/mobile/tools/${kind}/${recordId}?${new URLSearchParams(options(kind))}`);
    expect(saved.data[field]).toContain('&lt;bir&gt;'); expect(saved.data[field]).toContain('<br>');
    const updated = await request(`/mobile/tools/${kind}`, 'POST', { ...options(kind), draftId: randomUUID(), recordId, expectedVersion: saved.version, data: { ...saved.data, title: 'Mobilde değişen başlık' } });
    expect(updated.status).toBe(200);
    const legacy = (await request(endpoint)).data.items.find(item => item._id === recordId);
    expect(legacy[field]).toBe(original);
    const webChange = kind === 'personal' ? { content: 'Web yeni\nsatır' } : { body: 'Web yeni\nsatır' };
    await request(`${endpoint}/${recordId}`, kind === 'personal' ? 'PATCH' : 'PUT', webChange);
    const afterWeb = await request(`/mobile/tools/${kind}/${recordId}?${new URLSearchParams(options(kind))}`);
    expect(afterWeb.data.saved.data[field]).toBe('<p>Web yeni<br>satır</p>');
  });
});
