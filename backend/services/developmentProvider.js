import { GoogleGenerativeAI } from "@google/generative-ai";
import { promptReady, promptVersion, validateCoachResult, WRITER_DEVELOPMENT_COACH_PROMPT } from "../prompts/writerDevelopmentCoach.js";
import { providerResultSchema } from "./developmentResult.js";

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
export function providerSettings() {
  const timeoutMs = Number(process.env.DEVELOPMENT_ANALYSIS_TIMEOUT_MS || 60000);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 180000) throw fail(503, "DEVELOPMENT_CONFIG", "Gelişim Koçu zaman aşımı ayarı geçersiz.");
  return { apiKey: process.env.GEMINI_API_KEY || "", model: process.env.DEVELOPMENT_COACH_MODEL || process.env.GEMINI_MODEL || "", timeoutMs };
}
export function buildCoachInput(context) {
  return {
    analysisMode: context.kind === "baseline" ? "baseline" : "progress",
    workContext: context.workContext || {},
    previousProfile: context.previous?.profile || null,
    previousDevelopmentSummary: context.previous?.summary || null,
    samples: context.samples.map(({ text, revision }) => ({ text, revision })),
  };
}

// Single adapter; existing AI routes/SDK behavior remain unchanged.
export const developmentProvider = {
  ready: promptReady,
  promptVersion,
  analysisVersion: "1",
  validate: validateCoachResult,
  async generate(context, { signal, model: selectedModel, timeoutMs: selectedTimeout } = {}) {
    const settings = providerSettings();
    const { apiKey } = settings;
    const model = selectedModel ?? settings.model;
    const timeoutMs = selectedTimeout ?? settings.timeoutMs;
    if (!apiKey || !model) throw fail(503, "DEVELOPMENT_CONFIG", "Gelişim Koçu bağlantısı henüz yapılandırılmadı. Hakkın korunuyor.");
    const input = JSON.stringify(buildCoachInput(context));
    if (Buffer.byteLength(input) > 200000) throw fail(413, "DEVELOPMENT_CONTEXT_LIMIT", "Yazı örnekleri değerlendirme sınırını aşıyor. Hakkın korunuyor.");
    const generator = new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model, systemInstruction: WRITER_DEVELOPMENT_COACH_PROMPT,
      generationConfig: { responseMimeType: "application/json", responseSchema: providerResultSchema(), maxOutputTokens: 8192 },
    });
    const controller = new AbortController();
    const cancel = () => controller.abort();
    if (signal?.aborted) throw fail(403, "DEVELOPMENT_CONSENT_REQUIRED", "Gelişim Koçu kapatıldı. Hakkın korunuyor.");
    signal?.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await generator.generateContent({ contents: [{ role: "user", parts: [{ text: input }] }] }, { signal: controller.signal });
      if (controller.signal.aborted) throw fail(504, "DEVELOPMENT_TIMEOUT", "Değerlendirme zamanında tamamlanamadı. Hakkın korunuyor.");
      const candidate = response.response.candidates?.[0];
      const blockReason = response.response.promptFeedback?.blockReason;
      if (!candidate || candidate.finishReason !== "STOP" || blockReason) {
        // Operational metadata only: never log writing samples, output, or keys.
        console.warn("[development-provider] incomplete", JSON.stringify({ model,
          finishReason: candidate?.finishReason || null, blockReason: blockReason || null,
          promptTokens: response.response.usageMetadata?.promptTokenCount,
          outputTokens: response.response.usageMetadata?.candidatesTokenCount }));
        if (blockReason || ["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"].includes(candidate?.finishReason)) {
          throw fail(422, "DEVELOPMENT_PROVIDER_BLOCKED", "Bu yazı örneğinin değerlendirilmesi içerik filtresi nedeniyle engellendi. Analiz oluşturulmadı; hakkın ve yazıların korunuyor.");
        }
        if (candidate?.finishReason === "MAX_TOKENS") {
          throw fail(502, "DEVELOPMENT_OUTPUT_LIMIT", "Değerlendirme yanıtı uzunluk sınırında kesildi. Analiz kaydedilmedi; hakkın korunuyor.");
        }
        throw fail(502, "DEVELOPMENT_INCOMPLETE", "Değerlendirme tamamlanamadı. Hakkın korunuyor.");
      }
      const raw = response.response.text();
      if (typeof raw !== "string" || Buffer.byteLength(raw) > 60000) throw fail(502, "DEVELOPMENT_INVALID_RESULT", "Değerlendirme doğrulanamadı. Hakkın korunuyor.");
      let result;
      try { result = JSON.parse(raw); }
      catch { throw fail(502, "DEVELOPMENT_INVALID_RESULT", "Değerlendirme doğrulanamadı. Hakkın korunuyor."); }
      if (!validateCoachResult(result, context)) throw fail(502, "DEVELOPMENT_INVALID_RESULT", "Değerlendirme doğrulanamadı. Hakkın korunuyor.");
      return { modelIdentifier: model, result, profileSnapshot: result.profileSnapshot };
    } catch (error) {
      if (signal?.aborted) throw fail(403, "DEVELOPMENT_CONSENT_REQUIRED", "Gelişim Koçu kapatıldı. Hakkın korunuyor.");
      if (controller.signal.aborted) throw fail(504, "DEVELOPMENT_TIMEOUT", "Değerlendirme zamanında tamamlanamadı. Hakkın korunuyor.");
      if (typeof error.code === "string" && error.code.startsWith("DEVELOPMENT_")) throw error;
      if (error.status === 429) throw fail(503, "DEVELOPMENT_PROVIDER_BUSY", "Değerlendirme servisi şu an yoğun. Hakkın korunuyor; daha sonra tekrar deneyebilirsin.");
      throw fail(503, "DEVELOPMENT_PROVIDER_ERROR", "Değerlendirme servisine ulaşılamadı. Hakkın korunuyor.");
    } finally { clearTimeout(timer); signal?.removeEventListener("abort", cancel); }
  },
};
