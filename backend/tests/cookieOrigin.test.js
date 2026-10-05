import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import cookieOrigin, { allowedOrigins } from '../middlewares/cookieOrigin.js';

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('CLIENT_URL', 'https://app.example.test');
  vi.stubEnv('SITE_URL', 'https://example.test');
});
afterEach(() => vi.unstubAllEnvs());
function check(headers = {}, cookies = {}, method = 'POST') {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }, next = vi.fn();
  cookieOrigin({ method, cookies, get: name => headers[name] }, res, next);
  return { res, next };
}
it.each(['https://evil.example.test', 'http://localhost:5173', 'null', 'https://app.example.test.evil.test'])('rejects untrusted source %s', origin => {
  expect(check({ Origin: origin }, { token: 'opaque' }).res.status).toHaveBeenCalledWith(403);
});
it('accepts allowlisted origins and referers, but not missing cookie sources', () => {
  for (const Origin of allowedOrigins()) expect(check({ Origin }, { token: 'opaque' }).next).toHaveBeenCalledOnce();
  expect(check({ Referer: 'https://app.example.test/settings' }, { token: 'opaque' }).next).toHaveBeenCalledOnce();
  expect(check({}, { token: 'opaque' }).res.status).toHaveBeenCalledWith(403);
  expect(check({ 'Sec-Fetch-Site': 'cross-site' }).res.status).toHaveBeenCalledWith(403);
});
it('preserves native header credentials and safe navigation', () => {
  expect(check({ Authorization: 'Bearer opaque' }).next).toHaveBeenCalledOnce();
  expect(check({}, { token: 'opaque' }, 'GET').next).toHaveBeenCalledOnce();
});
it.each(['http://app.example.test', 'https://localhost', 'https://127.0.0.1', 'https://app.example.test/path', 'https://name:password@app.example.test'])('fails closed for invalid production origin configuration %s', value => {
  vi.stubEnv('CLIENT_URL', value);
  expect(() => allowedOrigins()).toThrow();
});
it('requires an explicit production origin', () => {
  vi.stubEnv('CLIENT_URL', ''); vi.stubEnv('SITE_URL', '');
  expect(() => allowedOrigins()).toThrow();
});
