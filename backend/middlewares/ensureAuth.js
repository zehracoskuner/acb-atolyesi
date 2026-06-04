import jwt from "jsonwebtoken";

export default function ensureAuth(req, res, next) {
  try {
    const tokenFromCookie = req.cookies?.token;
    const authHeader = req.headers.authorization || "";
    const tokenFromHeader = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    const token = tokenFromCookie || tokenFromHeader;
    if (!token)
      return res.status(401).json({ message: "Giriş yapmanız gerekiyor." });

    // Fallback string kaldırıldı — JWT_SECRET .env'de yoksa uygulama başlamasın
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET tanımlı değil");

    const decoded = jwt.verify(token, secret);

    if (decoded.role === "banned")
    return res.status(403).json({ message: "Hesabınız askıya alınmış." });

    req.user = { id: decoded.id, email: decoded.email, role: decoded.role ?? "user" };
    next();
  } catch (err) {
    console.error("ensureAuth error:", err.message);
    return res.status(401).json({ message: "Yetkisiz veya token geçersiz." });
  }
}