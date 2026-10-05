// Development Coach adapter. Other AI routes retain their own providers.
import OpenAI from "openai";
import { performance } from "node:perf_hooks";
import { buildCoachInput } from "./developmentProvider.js";
import { openAIResultSchema, validateCoachResult } from "./developmentResult.js";
import { WRITER_DEVELOPMENT_COACH_PROMPT, promptReady, promptVersion } from "../prompts/writerDevelopmentCoach.js";

export const DEVELOPMENT_OPENAI_MODEL = "gpt-6-luna";
const fail = (status, code, message, metrics = {}) => Object.assign(new Error(message), { status, code, metrics });
export function openAIUsage(usage) {
  const count = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  return { inputTokens: count(usage?.input_tokens), outputTokens: count(usage?.output_tokens),
    cachedInputTokens: count(usage?.input_tokens_details?.cached_tokens), reasoningTokens: count(usage?.output_tokens_details?.reasoning_tokens) };
}
export function createDevelopmentOpenAIClient({ timeoutMs = Number(process.env.DEVELOPMENT_ANALYSIS_TIMEOUT_MS ?? 90000) } = {}) {
  const timeout = timeoutMs;
  if (!process.env.OPENAI_API_KEY) throw fail(503, "DEVELOPMENT_OPENAI_CONFIG", "Gelişim Koçu bağlantısı yapılandırılmadı. Hakkın korunuyor.");
  if (!Number.isSafeInteger(timeout) || timeout < 1000 || timeout > 180000) throw fail(503, "DEVELOPMENT_OPENAI_CONFIG", "Gelişim Koçu zaman aşımı ayarı geçersiz.");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: "https://api.openai.com/v1", timeout, maxRetries: 0, logLevel: "off" });
}
export const developmentOpenAIProvider = {
  ready: promptReady, promptVersion, analysisVersion: "1", validate: validateCoachResult,
  async generate(context, { signal, model = DEVELOPMENT_OPENAI_MODEL, timeoutMs } = {}) {
    if (signal?.aborted) throw fail(403, "DEVELOPMENT_CONSENT_REQUIRED", "Gelişim Koçu kapatıldı. Hakkın korunuyor.");
    const input = JSON.stringify(buildCoachInput(context));
    if (Buffer.byteLength(input) > 200000) throw fail(413, "DEVELOPMENT_CONTEXT_LIMIT", "Yazı örnekleri değerlendirme sınırını aşıyor.");
    const client = createDevelopmentOpenAIClient({ timeoutMs });
    const started = performance.now();
    let metrics = {};
    try {
      const response = await client.responses.create({
        model, reasoning: { effort: "low" }, store: false, service_tier: "default",
        instructions: WRITER_DEVELOPMENT_COACH_PROMPT, input,
        text: { format: { type: "json_schema", name: "writer_development", strict: true, schema: openAIResultSchema() } },
        max_output_tokens: 8192,
      }, { signal });
      metrics = { latencyMs: Math.round(performance.now() - started), usage: openAIUsage(response.usage), responseStatus: response.status };
      const parts = (response.output || []).flatMap(item => item.type === "message" ? item.content || [] : []);
      if (parts.some(part => part.type === "refusal") || response.incomplete_details?.reason === "content_filter") {
        throw fail(422, "DEVELOPMENT_OPENAI_REFUSAL", "Bu yazı örneği için değerlendirme üretilemedi. Hakkın ve yazıların korunuyor.", metrics);
      }
      if (response.status !== "completed") throw fail(502, "DEVELOPMENT_OPENAI_INCOMPLETE", "Değerlendirme tamamlanamadı. Hakkın korunuyor.", metrics);
      const raw = response.output_text ?? parts.filter(part => part.type === "output_text").map(part => part.text).join("");
      if (typeof raw !== "string" || Buffer.byteLength(raw) > 60000) throw fail(502, "DEVELOPMENT_INVALID_RESULT", "Değerlendirme doğrulanamadı.", metrics);
      let result;
      try { result = JSON.parse(raw); } catch { throw fail(502, "DEVELOPMENT_INVALID_RESULT", "Değerlendirme doğrulanamadı.", metrics); }
      if (!validateCoachResult(result, context)) throw fail(502, "DEVELOPMENT_INVALID_RESULT", "Değerlendirme doğrulanamadı.", metrics);
      return { modelIdentifier: response.model || model, result, profileSnapshot: result.profileSnapshot, ...metrics };
    } catch (error) {
      if (signal?.aborted) throw fail(403, "DEVELOPMENT_CONSENT_REQUIRED", "Gelişim Koçu kapatıldı. Hakkın korunuyor.");
      if (error.code?.startsWith("DEVELOPMENT_")) throw error;
      if (error instanceof OpenAI.APIConnectionTimeoutError) throw fail(504, "DEVELOPMENT_TIMEOUT", "Değerlendirme zamanında tamamlanamadı. Hakkın korunuyor.", { latencyMs: Math.round(performance.now() - started) });
      // Never expose or log SDK errors, which can contain response/user content.
      const code = error.status === 429 ? "DEVELOPMENT_OPENAI_RATE_LIMIT" : error.status === 401 ? "DEVELOPMENT_OPENAI_AUTH" : error.status === 404 ? "DEVELOPMENT_OPENAI_MODEL_UNAVAILABLE" : "DEVELOPMENT_OPENAI_ERROR";
      throw fail(503, code, "Değerlendirme servisine ulaşılamadı. Hakkın korunuyor.", { latencyMs: Math.round(performance.now() - started), httpStatus: error.status || null });
    }
  },
};
