import { randomBytes } from 'node:crypto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { validateStartupEnvironment } from '../config/startupEnvironment.js';
const settings = { NODE_ENV: 'production', JWT_SECRET: '', MONGO_URI: 'mongodb://127.0.0.1:27017/isolated', ADMIN_SECRET_PATH: 'staff-admin', CLIENT_URL: 'https://app.example.test', SITE_URL: 'https://app.example.test', GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-google-secret', CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'test-key', CLOUDINARY_API_SECRET: 'test-secret', RESEND_API_KEY: 'test-mail-key', EMAIL_FROM: 'test@example.test', API_URL: 'https://api.example.test/api', GOOGLE_CALLBACK_URL: 'https://api.example.test/api/auth/google/callback', PORT: '5000' };
beforeEach(() => { for (const [name, value] of Object.entries(settings)) vi.stubEnv(name, name === 'JWT_SECRET' ? randomBytes(32).toString('hex') : value); });
afterEach(() => vi.unstubAllEnvs());
it('accepts explicitly configured production services', () => expect(validateStartupEnvironment()).toBeUndefined());
it.each(['MONGO_URI', 'ADMIN_SECRET_PATH', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'RESEND_API_KEY', 'EMAIL_FROM', 'API_URL', 'GOOGLE_CALLBACK_URL'])('fails closed with missing %s without leaking configuration', name => {
  vi.stubEnv(name, ''); expect(() => validateStartupEnvironment()).toThrow(name);
});
it.each(['short', '<placeholder-secret-with-at-least-32-bytes>', 'change-me-change-me-change-me-change-me'])('rejects weak/placeholder secrets %s', secret => {
  vi.stubEnv('JWT_SECRET', secret); expect(() => validateStartupEnvironment()).toThrow('JWT_SECRET');
});
it.each(['http://api.example.test/api', 'https://localhost/api', 'https://user:password@api.example.test/api'])('rejects unsafe API URL %s', url => {
  vi.stubEnv('API_URL', url); expect(() => validateStartupEnvironment()).toThrow('API_URL');
});
it.each([undefined, '', ' ', '0', '65536', 'abc'])('rejects missing or invalid production port %s', port => {
  vi.stubEnv('PORT', port); expect(() => validateStartupEnvironment()).toThrow('PORT');
});
it('allows the local port fallback outside production', () => {
  vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('PORT', undefined);
  expect(() => validateStartupEnvironment()).not.toThrow();
});
