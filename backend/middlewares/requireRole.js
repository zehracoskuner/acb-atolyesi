// backend/middlewares/requireRole.js
export default function requireRole(...roles) {
  return (req, res, next) => {
    // ensureAuth'tan sonra gelir, req.user zaten set edilmiş olmalı
    if (!req.user)
      return res.status(401).json({ message: "Giriş yapmanız gerekiyor." });

    if (!roles.includes(req.user.role))
      return res.status(403).json({ message: "Bu işlem için yetkiniz yok." });

    next();
  };
}