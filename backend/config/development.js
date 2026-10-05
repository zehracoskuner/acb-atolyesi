export const DEVELOPMENT_WORD_THRESHOLD = 3000;
export const DEVELOPMENT_WINDOW_MS = 24 * 60 * 60 * 1000;
export function developmentConfig() {
  const dailyLimit = Number(process.env.DEVELOPMENT_ANALYSIS_DAILY_LIMIT ?? 2);
  if (!Number.isSafeInteger(dailyLimit) || dailyLimit < 1) throw new Error("Invalid development daily limit");
  const provider = process.env.DEVELOPMENT_COACH_PROVIDER ?? "openai";
  if (!["openai", "gemini"].includes(provider)) throw new Error("Invalid development provider");
  const model = process.env.DEVELOPMENT_COACH_MODEL ?? (provider === "openai" ? "gpt-6-luna" : process.env.GEMINI_MODEL);
  if (typeof model !== "string" || !model.trim()) throw new Error("Invalid development model");
  const timeoutMs = Number(process.env.DEVELOPMENT_ANALYSIS_TIMEOUT_MS ?? 90000);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 180000) throw new Error("Invalid development timeout");
  return { dailyLimit, provider, model: model.trim(), timeoutMs, enabled: process.env.DEVELOPMENT_COACH_ENABLED === "true" };
}
