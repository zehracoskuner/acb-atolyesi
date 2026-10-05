import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createNativeSession } from "../services/authSession.js";
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { randomBytes, randomUUID, randomInt } from 'node:crypto';
import { once } from 'node:events';
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Work from '../models/Work.js';
import Chapter from '../models/Chapter.js';
import Comment from '../models/Comment.js';
import InlineComment from '../models/InlineComment.js';
import AuthSession from '../models/AuthSession.js';
import authRouter from '../routes/auth.js';
import userRouter from '../routes/user.js';
import commentRouter from '../routes/comments.js';
import inlineRouter from '../routes/inlineComments.js';
import cookieOrigin from '../middlewares/cookieOrigin.js';
import { newTermsAcceptance } from '../config/terms.js';

vi.mock('../services/emailService.js', () => ({ sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn(), sendEmailVerifyOtp: vi.fn() }));
let server, base, owner, work, chapter;
const uri = process.env.CHAPTER_TEST_MONGO_URI;
describe.skipIf(!uri)('HTTP security boundaries with isolated MongoDB', () => {
beforeAll(async () => {
  if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):\d+\/?(?:\?.*)?$/.test(uri || '')) throw Error('Run test:all with its isolated loopback replica set');
  vi.stubEnv('JWT_SECRET', randomBytes(32).toString('hex'));
  vi.stubEnv('CLIENT_URL', 'https://app.example.test');
  await mongoose.connect(uri, { dbName: `security_${randomUUID().replaceAll('-', '')}` });
  const app = express();
  app.use(cookieParser(), express.json(), cookieOrigin);
  app.use('/auth', authRouter); app.use('/user', userRouter);
  app.use('/comments', commentRouter); app.use('/inline-comments', inlineRouter);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => { if (server) await new Promise(r => server.close(r)); await mongoose.disconnect(); vi.unstubAllEnvs(); });
afterEach(() => vi.restoreAllMocks());
beforeEach(async () => {
  await Promise.all([User, Work, Chapter, Comment, InlineComment, AuthSession].map(m => m.deleteMany({})));
  owner = await User.create({ email: 'member@example.test', kullaniciAdi: 'member', birthYear: 1990, emailVerified: true, ...newTermsAcceptance() });
  work = await Work.create({ user: owner._id, title: 'Work', status: 'published' });
  chapter = await Chapter.create({ work: work._id, title: 'Chapter', content: 'Text', status: 'published' });
  await Work.updateOne({ _id: work._id }, { publishedChapterIds: [chapter._id] });
});
async function request(path, { method = 'GET', body, auth = false, headers = {} } = {}) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${await createNativeSession(owner)}` } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, data: await res.json(), cookie: res.headers.get('set-cookie') };
}
it('denies verified-account OTP takeover over HTTP, without a token or cookie', async () => {
  const r = await request('/auth/verify-email-otp', { method: 'POST', body: { email: owner.email, otp: '123456', web: true } });
  expect(r.status).toBe(400); expect(r.data.token).toBeUndefined(); expect(r.cookie).toBeNull();
  expect(await AuthSession.countDocuments()).toBe(0);
});
it('rejects NoSQL object credentials before querying an account', async () => {
  const spy = vi.spyOn(User, 'findOne');
  const r = await request('/auth/reset-password', { method: 'POST', body: { email: { $ne: null }, otp: { $ne: null }, newPassword: 'arbitrary-password' } });
  expect(r.status).toBe(400); expect(spy).not.toHaveBeenCalled();
});
it('excludes reset and verification credentials from authenticated profile responses', async () => {
  const secret = randomBytes(16).toString('hex');
  await User.updateOne({ _id: owner._id }, { emailVerifyOtp: secret, passwordResetOtp: secret, passwordResetToken: secret, emailVerifyToken: secret });
  const r = await request('/user/profile', { auth: true });
  expect(r.status).toBe(200); expect(JSON.stringify(r.data)).not.toContain(secret);
  for (const field of ['sifreHash', 'passwordResetOtp', 'passwordResetToken', 'emailVerifyOtp', 'emailVerifyToken']) expect(r.data.user).not.toHaveProperty(field);
});
it('checks publication for normal and inline comments even when a withdrawn chapter ID is known', async () => {
  await Comment.create({ author: owner._id, work: work._id, chapter: chapter._id, content: 'visible-comment', status: 'published' });
  await InlineComment.create({ author: owner._id, workId: work._id, chapterId: chapter._id, paragraphIndex: 0, content: 'inline-visible', status: 'published' });
  expect((await request(`/comments/chapter/${chapter._id}`)).status).toBe(200);
  expect((await request(`/inline-comments?chapterId=${chapter._id}`)).data.items).toHaveLength(1);
  await Chapter.updateOne({ _id: chapter._id }, { status: 'draft' });
  const hidden = await request(`/comments/chapter/${chapter._id}`);
  expect(hidden.status).toBe(404); expect(JSON.stringify(hidden.data)).not.toContain('visible-comment');
  expect((await request(`/inline-comments?chapterId=${chapter._id}`)).data.items).toHaveLength(0);
});
it('does not attach an inline comment to another work or a private chapter', async () => {
  const send = (workId = work._id) => request('/inline-comments', { auth: true, method: 'POST', body: { workId, chapterId: chapter._id, paragraphIndex: 0, content: 'comment' } });
  expect((await send(new mongoose.Types.ObjectId())).status).toBe(404);
  await Chapter.updateOne({ _id: chapter._id }, { status: 'draft' });
  expect((await send()).status).toBe(404);
  expect(await InlineComment.countDocuments()).toBe(0);
});

it.each(['bearer', 'cookie'])('rejects validly signed sid-less legacy %s credentials', async transport => {
  const token = jwt.sign({ id: String(owner._id) }, process.env.JWT_SECRET, { expiresIn: '30d' });
  const headers = transport === 'cookie' ? { Cookie: 'token=' + token } : { Authorization: 'Bearer ' + token };
  expect((await request('/auth/me', { headers })).status).toBe(401);
});
it.each(['native', 'web'])('logout revokes a copied %s credential in real session storage', async client => {
  owner.sifreHash = await bcrypt.hash('initial-password', 4); await owner.save();
  const login = await request('/auth/login', { method: 'POST', body: { email: owner.email, sifre: 'initial-password', client, rememberMe: true } });
  expect(login.status).toBe(200);
  const credential = client === 'native' ? login.data.token : login.cookie.match(/token=([^;]+)/)[1];
  const headers = client === 'native' ? { Authorization: 'Bearer ' + credential } : { Cookie: 'token=' + credential, Origin: 'https://app.example.test' };
  expect((await request('/auth/me', { headers })).status).toBe(200);
  expect((await request('/auth/logout', { method: 'POST', headers })).status).toBe(200);
  expect((await request('/auth/me', { headers })).status).toBe(401);
  expect(await AuthSession.countDocuments()).toBe(0);
});
it('password change invalidates every previously issued credential and new login still works', async () => {
  owner.sifreHash = await bcrypt.hash('initial-password', 4); await owner.save();
  const native = await createNativeSession(owner);
  const login = await request('/auth/login', { method: 'POST', body: { email: owner.email, sifre: 'initial-password', rememberMe: true } });
  const cookie = login.cookie.match(/token=([^;]+)/)[1];
  expect((await request('/user/password', { method: 'PATCH', headers: { Authorization: 'Bearer ' + native }, body: { currentPassword: 'initial-password', newPassword: 'replacement-password' } })).status).toBe(200);
  for (const headers of [{ Authorization: 'Bearer ' + native }, { Cookie: 'token=' + cookie }]) expect((await request('/auth/me', { headers })).status).toBe(401);
  const fresh = await request('/auth/login', { method: 'POST', body: { email: owner.email, sifre: 'replacement-password', client: 'native' } });
  expect(fresh.status).toBe(200);
  expect((await request('/auth/me', { headers: { Authorization: 'Bearer ' + fresh.data.token } })).status).toBe(200);
});

it.each(['otp', 'link'])('password reset through %s invalidates issued sessions and consumes the reset credential', async mode => {
  owner.sifreHash = await bcrypt.hash('initial-password', 4);
  const reset = mode === 'otp' ? String(randomInt(100000, 1000000)) : randomBytes(16).toString('hex');
  if (mode === 'otp') { owner.passwordResetOtp = reset; owner.passwordResetOtpExpires = new Date(Date.now() + 60000); }
  else { owner.passwordResetToken = reset; owner.passwordResetExpires = new Date(Date.now() + 60000); }
  await owner.save();
  const old = await createNativeSession(owner);
  const body = { newPassword: 'replacement-password', ...(mode === 'otp' ? { email: owner.email, otp: reset } : { token: reset }) };
  expect((await request('/auth/reset-password', { method: 'POST', body })).status).toBe(200);
  expect((await request('/auth/me', { headers: { Authorization: 'Bearer ' + old } })).status).toBe(401);
  expect((await request('/auth/reset-password', { method: 'POST', body })).status).toBe(400);
});
});
