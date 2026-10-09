import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const mail = vi.hoisted(() => vi.fn());
vi.mock('../services/emailService.js', () => ({ sendVerificationEmail: mail, sendPasswordResetEmail: vi.fn(), sendEmailVerifyOtp: vi.fn() }));
vi.mock('dns/promises', () => ({ default: { resolveMx: vi.fn(async () => [{ exchange: 'mail.example.test' }]) } }));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn(async () => 'hashed') } }));
import router from '../routes/auth.js';
import User from '../models/User.js';
const handler = path => router.stack.find(layer => layer.route?.path === path).route.stack.at(-1).handle;
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });
beforeEach(() => { mail.mockReset().mockResolvedValue('message-id'); vi.spyOn(console, 'error').mockImplementation(() => {}); vi.spyOn(console, 'info').mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());
it('keeps the new account when mail fails and returns a retryable response', async () => {
  vi.spyOn(User, 'findOne').mockResolvedValue(null);
  const create = vi.spyOn(User, 'create').mockResolvedValue({});
  mail.mockRejectedValue(new Error('provider down'));
  const res = response();
  await handler('/register')({ body: { kullaniciAdi: 'reader', email: 'reader@example.test', sifre: 'secret123' } }, res);
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ emailVerified: false }));
  expect(res.status).toHaveBeenCalledWith(503);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'EMAIL_SEND_FAILED', accountCreated: true, emailAccepted: false }));
});
it('only returns registration success after the provider accepts', async () => {
  vi.spyOn(User, 'findOne').mockResolvedValue(null); vi.spyOn(User, 'create').mockResolvedValue({});
  let resolve; mail.mockImplementation(() => new Promise(r => { resolve = r; }));
  const res = response();
  const pending = handler('/register')({ body: { kullaniciAdi: 'reader', email: 'reader@example.test', sifre: 'secret123' } }, res);
  await vi.waitFor(() => expect(mail).toHaveBeenCalled());
  expect(res.json).not.toHaveBeenCalled(); resolve('accepted'); await pending;
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ accountCreated: true, emailAccepted: true }));
});
it('restores the previous token conditionally on failed resend', async () => {
  const old = { _id: 'user-id', emailVerified: false, emailVerifyToken: 'old-token', emailVerifyExpires: new Date(Date.now() + 100000) };
  vi.spyOn(User, 'findOne').mockResolvedValue(old);
  const update = vi.spyOn(User, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
  mail.mockRejectedValue(new Error('provider down')); const res = response();
  await handler('/resend-verification')({ body: { email: 'reader@example.test' } }, res);
  const newToken = update.mock.calls[0][1].$set.emailVerifyToken;
  expect(update).toHaveBeenNthCalledWith(2, { _id: old._id, emailVerified: false, emailVerifyToken: newToken }, { $set: { emailVerifyToken: old.emailVerifyToken, emailVerifyExpires: old.emailVerifyExpires } });
  expect(res.status).toHaveBeenCalledWith(503);
});
it('does not send after a concurrent token change', async () => {
  vi.spyOn(User, 'findOne').mockResolvedValue({ _id: 'user-id', emailVerified: false, emailVerifyToken: 'old' });
  vi.spyOn(User, 'updateOne').mockResolvedValue({ modifiedCount: 0 }); const res = response();
  await handler('/resend-verification')({ body: { email: 'reader@example.test' } }, res);
  expect(res.status).toHaveBeenCalledWith(409); expect(mail).not.toHaveBeenCalled();
});
