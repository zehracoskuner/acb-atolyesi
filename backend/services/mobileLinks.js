// Fixed, server-owned links; no user-supplied redirect target.
export function mobileLink(action, params) {
  const configured = process.env.MOBILE_LINK_BASE || 'acbatolyesi://mobile-link';
  const base = new URL(configured);
  if (base.username || base.password || base.search || base.hash ||
      !['https:', 'acbatolyesi:'].includes(base.protocol) ||
      (base.protocol === 'https:' && /^(localhost|127\.|\[::1\])/.test(base.hostname))) throw new Error('MOBILE_LINK_BASE must be a trusted HTTPS or acbatolyesi link.');
  if (!['verify', 'reset'].includes(action)) throw new Error('Invalid mobile link action.');
  return `${configured.replace(/\/$/, '')}/${action}?${new URLSearchParams(params)}`;
}
