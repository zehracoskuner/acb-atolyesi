// Cookie credentials are ambient: require an explicitly trusted browser source.
// Native Bearer-only clients may omit Origin/Referer; cookie precedence still applies.
export default function uploadOrigin(req, res, next) {
  const trusted = [process.env.CLIENT_URL, process.env.SITE_URL].filter(Boolean)
    .map(value => { try { return new URL(value).origin; } catch { return null; } })
    .filter(value => value && value !== "null");
  if (process.env.NODE_ENV !== "production") trusted.push("http://localhost:5173");
  const origin = req.get("Origin");
  let source = origin;
  if (!origin && req.get("Referer")) {
    try { source = new URL(req.get("Referer")).origin; } catch { source = "null"; }
  }
  if ((source && !trusted.includes(source)) || (req.cookies?.token && !source)) {
    return res.status(403).json({ code: "UPLOAD_ORIGIN_REJECTED", message: "Yükleme isteğinin kaynağı doğrulanamadı." });
  }
  next();
}
