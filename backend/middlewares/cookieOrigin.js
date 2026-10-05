// Cookie credentials are ambient. Unsafe requests must have a trusted browser
// source; native Bearer clients without cookies may omit browser headers.
export function allowedOrigins() {
  const configured = [process.env.CLIENT_URL, process.env.SITE_URL].filter(Boolean);
  if (process.env.NODE_ENV === 'production' && !configured.length) throw new Error('Production requires CLIENT_URL or SITE_URL.');
  const origins = configured.map(value => {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
        !['http:', 'https:'].includes(url.protocol) ||
        (process.env.NODE_ENV === 'production' && (url.protocol !== 'https:' || /^(localhost|127\.|\[::1\])/.test(url.hostname)))) {
      throw new Error('CLIENT_URL and SITE_URL must be trusted origins (HTTPS in production).');
    }
    return url.origin;
  });
  if (process.env.NODE_ENV !== 'production') origins.push('http://localhost:5173');
  return origins;
}

export default function cookieOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('Origin');
  let source = origin;
  if (!source && req.get('Referer')) {
    try { source = new URL(req.get('Referer')).origin; } catch { source = 'null'; }
  }
  if ((source && !allowedOrigins().includes(source)) ||
      (!source && (req.cookies?.token || req.get('Sec-Fetch-Site') === 'cross-site'))) {
    return res.status(403).json({ code: 'ORIGIN_REJECTED', message: 'İsteğin kaynağı doğrulanamadı.' });
  }
  next();
}
