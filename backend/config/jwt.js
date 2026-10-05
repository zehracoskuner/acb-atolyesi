export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (typeof secret !== "string" || !secret.trim()) {
    throw new Error("Sunucu başlatılamadı: JWT_SECRET ortam değişkeni gereklidir.");
  }
  return secret;
}
