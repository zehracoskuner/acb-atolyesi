import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';
vi.mock('dotenv/config', () => ({}));
const { mail } = vi.hoisted(() => ({ mail: vi.fn() }));
vi.mock('../services/emailService.js', () => ({ sendMail: mail }));
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import userRoutes from '../routes/user.js';
import User from '../models/User.js';
import EmailChange from '../models/EmailChange.js';
import { createNativeSession, validWebSession } from '../services/authSession.js';
import jwt from 'jsonwebtoken';
import { newTermsAcceptance } from '../config/terms.js';

describe('pending email changes on real account routes and MongoDB', () => {
  let repl, server, base, user, token; const password = 'real-test-password';
  beforeAll(async () => {
    vi.stubEnv('JWT_SECRET', randomUUID() + randomUUID()); vi.stubEnv('API_URL', 'https://api.example.test/api');
    repl = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(repl.getUri(), { dbName: `email_change_${randomUUID().replaceAll('-', '')}` });
    await Promise.all([User.init(), EmailChange.init()]);
    const app = express(); app.use(express.json()); app.use('/api/user', userRoutes);
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); base = `http://127.0.0.1:${server.address().port}/api/user`;
  }, 600000);
  beforeEach(async () => {
    mail.mockReset(); mail.mockResolvedValue(undefined);
    const id = randomUUID().replaceAll('-', '');
    user = await User.create({ email: `${id}@old.test`, kullaniciAdi: `u_${id}`, sifreHash: await bcrypt.hash(password, 4), emailVerified: true, birthYear: 1990, ...newTermsAcceptance() });
    token = await createNativeSession(user);
  });
  afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); if (repl) await repl.stop(); vi.unstubAllEnvs(); }, 30000);
  async function request(path, method = 'GET', body, credential = token) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  }
  const begin = (email = `${randomUUID()}@new.test`) => request('/change-email', 'PATCH', { newEmail: email, currentPassword: password });
  const code = () => mail.mock.calls.at(-1)[0].text.match(/kodun: (\d{6})/)[1];
  const linkToken = () => mail.mock.calls.at(-1)[0].html.match(/token=([a-f\d]{64})/)[1];
  const expireCooldown = () => EmailChange.updateOne({ user: user._id }, { $set: { sentAt: new Date(Date.now() - 61000) } });

  it('keeps the verified old address until proof; exposes no secrets; consumes the code once', async () => {
    const email = `${randomUUID()}@new.test`; const started = await begin(email);
    expect(started.status).toBe(202); expect(started.data.user.email).toBe(user.email); expect(started.data.user.emailVerified).toBe(true);
    expect((await User.findById(user._id)).email).toBe(user.email);
    const pending = await EmailChange.findOne({ user: user._id }); expect(pending.codeHash).not.toContain(code()); expect(pending.tokenHash).not.toBe(linkToken());
    const status = await request('/email-change'); expect(status.data.pending.email).toBe(email); expect(JSON.stringify(status.data)).not.toContain('Hash');
    expect(JSON.stringify((await request('/profile')).data)).not.toContain('codeHash');
    const confirmed = await request('/email-change/verify', 'POST', { otp: code() });
    expect(confirmed.status).toBe(200); expect(confirmed.data.user.email).toBe(email); expect(confirmed.data.user.emailVerified).toBe(true);
    expect((await request('/email-change/verify', 'POST', { otp: code() })).status).toBe(400);
    expect((await request('/email-change')).data.pending).toBe(null);
  });
  it('requires authentication and the current password and rejects invalid/duplicate addresses', async () => {
    expect((await request('/change-email', 'PATCH', { newEmail: 'n@new.test' }, '')).status).toBe(401);
    expect((await request('/change-email', 'PATCH', { newEmail: 'n@new.test', currentPassword: 'wrong' })).status).toBe(400);
    expect((await request('/change-email', 'PATCH', { newEmail: { bad: true } })).status).toBe(400);
    expect((await begin(user.email)).status).toBe(400);
    const other = await User.create({ email: `${randomUUID()}@taken.test` });
    expect((await begin(other.email)).status).toBe(409); expect(mail).not.toHaveBeenCalled();
  });
  it('persists a five attempt limit and rejects the correct code after exhaustion', async () => {
    await begin(); const wrong = code() === '000000' ? '000001' : '000000'; const right = code();
    for (let i = 0; i < 5; i++) expect((await request('/email-change/verify', 'POST', { otp: wrong })).status).toBe(400);
    expect((await request('/email-change')).data.pending.locked).toBe(true);
    expect((await request('/email-change/verify', 'POST', { otp: right })).status).toBe(400);
    expect((await User.findById(user._id)).email).toBe(user.email);
  });
  it('rejects expired codes and cancels pending requests without changing the address', async () => {
    await begin(); const otp = code(); await EmailChange.updateOne({ user: user._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await request('/email-change/verify', 'POST', { otp })).status).toBe(400);
    await request('/email-change', 'DELETE'); expect(await EmailChange.countDocuments({ user: user._id })).toBe(0);
    expect((await User.findById(user._id)).email).toBe(user.email);
  });
  it('throttles resend, allows only one concurrent replacement and invalidates old links', async () => {
    const email = `${randomUUID()}@new.test`; await begin(email); const previous = linkToken();
    expect((await begin(email)).status).toBe(429); expect(mail).toHaveBeenCalledTimes(1);
    await expireCooldown(); const results = await Promise.all([begin(email), begin(email)]);
    expect(results.map(r => r.status).sort()).toEqual([202, 429]); expect(mail).toHaveBeenCalledTimes(2);
    expect((await fetch(`${base}/email-change/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: previous }) })).status).toBe(400);
    expect((await request('/email-change/verify', 'POST', { otp: code() })).status).toBe(200);
  });
  it('leaves the old address intact when delivery fails', async () => {
    mail.mockRejectedValueOnce(new Error('provider unavailable'));
    expect((await begin()).status).toBe(503); expect((await User.findById(user._id)).email).toBe(user.email);
    expect((await request('/email-change')).data.pending).toBe(null);
  });
  it('handles uniqueness races at confirmation without replacing the old address', async () => {
    const email = `${randomUUID()}@race.test`; await begin(email); await User.create({ email });
    expect((await request('/email-change/verify', 'POST', { otp: code() })).status).toBe(409);
    expect((await User.findById(user._id)).email).toBe(user.email);
  });
  it('lets only one of simultaneous OTP submissions consume the request', async () => {
    await begin(); const otp = code(); const responses = await Promise.all([request('/email-change/verify', 'POST', { otp }), request('/email-change/verify', 'POST', { otp })]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 400]);
  });
  it('invalidates old email-change links when the password is reset', async () => {
    await begin(); const previous = linkToken();
    await User.updateOne({ _id: user._id }, { $set: { sifreHash: await bcrypt.hash('new-test-password', 4) } });
    const response = await fetch(`${base}/email-change/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: previous }) });
    expect(response.status).toBe(409); expect((await User.findById(user._id)).email).toBe(user.email);
  });
  it('supports unchanged web clients through explicit confirmation; link GET is read only', async () => {
    const email = `${randomUUID()}@web.test`; await begin(email); const tokenValue = linkToken();
    const landing = await fetch(`${base}/email-change/confirm?token=${tokenValue}`);
    expect(landing.status).toBe(200); expect(landing.headers.get('cache-control')).toBe('no-store');
    expect(await landing.text()).toContain('method="post"'); expect((await User.findById(user._id)).email).toBe(user.email);
    const response = await fetch(`${base}/email-change/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: tokenValue }) });
    expect(response.status).toBe(200); expect((await User.findById(user._id)).email).toBe(email);
    expect((await request('/email-change/verify', 'POST', { otp: code() })).status).toBe(400);
  });
  it('supports Google-only accounts and exposes first-password state without allowing replacement', async () => {
    await User.updateOne({ _id: user._id }, { $set: { sifreHash: null, authProvider: 'google' } });
    user = await User.findById(user._id); token = await createNativeSession(user);
    expect((await request('/email-change')).data.hasPassword).toBe(false);
    expect((await request('/change-email', 'PATCH', { newEmail: `${randomUUID()}@google.test` })).status).toBe(202);
    expect((await request('/set-password', 'PATCH', { newPassword: password })).status).toBe(200);
    expect(await validWebSession(jwt.decode(token), await User.findById(user._id))).toBe(false);
    user = await User.findById(user._id); expect(user.toSafeJSON().hasPassword).toBe(true); token = await createNativeSession(user);
    expect((await request('/set-password', 'PATCH', { newPassword: 'replaced-secret' })).status).toBe(400);
    expect(await bcrypt.compare(password, user.sifreHash)).toBe(true);
  });
});
