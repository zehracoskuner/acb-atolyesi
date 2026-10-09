import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ smtp: vi.fn(), resend: vi.fn(), transport: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport: mocks.transport } }));
vi.mock('resend', () => ({ Resend: class { emails = { send: mocks.resend }; } }));
vi.mock('../models/User.js', () => ({ default: {} }));
let sendVerificationEmail;
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks();
  for (const [key, value] of Object.entries({ EMAIL_PROVIDER: 'gmail', GMAIL_USER: 'acbatolyesi@gmail.com', GMAIL_APP_PASSWORD: 'test app password', NODE_ENV: 'production', API_URL: 'https://api.example.test/api', EMAIL_FROM: 'test@example.test', RESEND_API_KEY: 'test-key' })) vi.stubEnv(key, value);
  mocks.transport.mockReturnValue({ sendMail: mocks.smtp });
  mocks.smtp.mockResolvedValue({ messageId: 'smtp-id', accepted: ['reader@example.test'], rejected: [] });
  mocks.resend.mockResolvedValue({ data: { id: 'resend-id' }, error: null });
  ({ sendVerificationEmail } = await import('../services/emailService.js'));
});
afterEach(() => vi.unstubAllEnvs());
it('sends from the configured Gmail account with a public verification link', async () => {
  await expect(sendVerificationEmail('reader@example.test', 'a&b')).resolves.toBe('smtp-id');
  expect(mocks.smtp).toHaveBeenCalledWith(expect.objectContaining({ from: { name: 'ACB Atölyesi', address: 'acbatolyesi@gmail.com' }, html: expect.stringContaining('https://api.example.test/api/auth/verify-email?token=a%26b') }));
  expect(mocks.transport).toHaveBeenCalledWith(expect.objectContaining({ service: 'gmail', auth: { user: 'acbatolyesi@gmail.com', pass: 'testapppassword' } }));
  expect(mocks.resend).not.toHaveBeenCalled();
});
it('fails without an app password before connecting', async () => {
  vi.stubEnv('GMAIL_APP_PASSWORD', '');
  await expect(sendVerificationEmail('reader@example.test', 'token')).rejects.toThrow('GMAIL_APP_PASSWORD');
  expect(mocks.transport).not.toHaveBeenCalled();
});
it('rejects SMTP refusal instead of reporting success', async () => {
  mocks.smtp.mockResolvedValue({ messageId: 'id', accepted: [], rejected: ['reader@example.test'] });
  await expect(sendVerificationEmail('reader@example.test', 'token')).rejects.toThrow('kabul edilmedi');
});
it('propagates connection failure', async () => {
  mocks.smtp.mockRejectedValue(new Error('connection failed'));
  await expect(sendVerificationEmail('reader@example.test', 'token')).rejects.toThrow('connection failed');
});
it.each(['https://localhost/api', 'http://api.example.test/api', 'https://api.example.test', 'https://user:password@api.example.test/api'])('rejects unsafe production URL %s', async url => {
  vi.stubEnv('API_URL', url);
  await expect(sendVerificationEmail('reader@example.test', 'token')).rejects.toThrow();
  expect(mocks.smtp).not.toHaveBeenCalled();
});
it('preserves Resend as an explicit alternative', async () => {
  vi.stubEnv('EMAIL_PROVIDER', 'resend');
  await expect(sendVerificationEmail('reader@example.test', 'token')).resolves.toBe('resend-id');
  expect(mocks.smtp).not.toHaveBeenCalled();
});
it.each([{ error: { message: 'rejected' } }, { data: {} }])('rejects unsuccessful Resend response', async response => {
  vi.stubEnv('EMAIL_PROVIDER', 'resend'); mocks.resend.mockResolvedValue(response);
  await expect(sendVerificationEmail('reader@example.test', 'token')).rejects.toThrow();
});
