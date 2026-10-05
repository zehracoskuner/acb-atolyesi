import User from "../models/User.js";
export async function readCoachPreference(userId) {
  const user = await User.findById(userId).select("settings.developmentCoach").lean();
  if (!user) throw Object.assign(new Error("Kullanıcı bulunamadı."), { status: 404 });
  return user.settings?.developmentCoach || "undecided";
}
export async function requireCoachConsent(userId) {
  if (await readCoachPreference(userId) !== "enabled") throw Object.assign(new Error("Yapay Zeka Gelişim Koçu kapalı. İstersen Ayarlar’dan açabilirsin."), { status: 403, code: "DEVELOPMENT_CONSENT_REQUIRED" });
}
