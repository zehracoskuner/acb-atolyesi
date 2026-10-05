import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { developmentOpenAIProvider, createDevelopmentOpenAIClient } from "../services/developmentOpenAIProvider.js";
import { coachResultSchema, openAIResultSchema } from "../services/developmentResult.js";
import { WRITER_DEVELOPMENT_COACH_PROMPT } from "../prompts/writerDevelopmentCoach.js";
import { validDevelopmentResult } from "./fixtures/developmentResult.js";

const context = { kind: "baseline", userId: "private-id", workId: "private-work", samples: [{ text: "Private test prose", revision: 1 }] };
const reply = (result = validDevelopmentResult(), extra = {}) => new Response(JSON.stringify({
  id: "resp_test", object: "response", model: "gpt-6-luna", status: "completed",
  output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(result) }] }],
  usage: { input_tokens: 12000, output_tokens: 2000, input_tokens_details: { cached_tokens: 1000 }, output_tokens_details: { reasoning_tokens: 300 } }, ...extra,
}), { status: 200, headers: { "Content-Type": "application/json" } });
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-key");
  vi.stubEnv("DEVELOPMENT_ANALYSIS_TIMEOUT_MS", "1000");
  vi.stubGlobal("fetch", vi.fn(async () => reply()));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("preserves the existing prompt, strict JSON contract, low reasoning, privacy and token accounting", async () => {
  const output = await developmentOpenAIProvider.generate(context);
  expect(output.result).toEqual(validDevelopmentResult());
  expect(output.usage).toEqual({ inputTokens: 12000, outputTokens: 2000, cachedInputTokens: 1000, reasoningTokens: 300 });
  const [url, request] = fetch.mock.calls[0];
  expect(String(url)).toBe("https://api.openai.com/v1/responses");
  const payload = JSON.parse(request.body);
  expect(payload.model).toBe("gpt-6-luna"); expect(payload.reasoning.effort).toBe("low");
  expect(payload.store).toBe(false); expect(payload.service_tier).toBe("default");
  expect(payload.instructions).toBe(WRITER_DEVELOPMENT_COACH_PROMPT);
  expect(payload.text.format.strict).toBe(true);
  expect(payload.input).not.toContain("private-id");
  expect(payload.text.format.schema.properties.voiceProfile.properties.signatureTraits.maxItems).toBe(5);
  expect(payload.text.format.schema.properties.summary.maxLength).toBe(coachResultSchema.properties.summary.maxLength);
  expect(payload.text.format.schema.properties.voiceProfile.additionalProperties).toBe(false);
});
it("does not mutate the Gemini/local schema", () => {
  const original = JSON.stringify(coachResultSchema);
  expect(openAIResultSchema().type).toBe("object");
  expect(JSON.stringify(coachResultSchema)).toBe(original);
});
it("accepts the selected model and uses generic user-facing failure messages", async () => {
  await developmentOpenAIProvider.generate(context, { model: "selected-model" });
  expect(JSON.parse(fetch.mock.calls[0][1].body).model).toBe("selected-model");
  fetch.mockResolvedValue(reply(null, { output: [{ type: "message", content: [{ type: "refusal", refusal: "private refusal" }] }] }));
  try { await developmentOpenAIProvider.generate(context); } catch (error) {
    expect(error.message).not.toMatch(/OpenAI|Gemini|gpt-6-luna/);
  }
});
it("defaults timeout to 90 seconds and rejects unsafe timeout values", () => {
  vi.stubEnv("DEVELOPMENT_ANALYSIS_TIMEOUT_MS", undefined);
  const client = createDevelopmentOpenAIClient();
  expect(client.timeout).toBe(90000); expect(client.maxRetries).toBe(0);
  expect(() => createDevelopmentOpenAIClient({ timeoutMs: 181000 })).toThrow();
});
it("times out an unfinished request once, without a provider fallback", async () => {
  vi.useFakeTimers();
  fetch.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }));
  try {
    const pending = expect(developmentOpenAIProvider.generate(context)).rejects.toMatchObject({ status: 504, code: "DEVELOPMENT_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(1001); await pending;
    expect(fetch).toHaveBeenCalledTimes(1);
  } finally { vi.useRealTimers(); }
});
it.each(["invalid-json", "wrong-mode", "extra-field", "too-many-focus", "incomplete", "refusal", "content-filter"])("rejects %s without retry", async kind => {
  let result = validDevelopmentResult(), extra = {};
  if (kind === "wrong-mode") result.analysisType = "progress";
  if (kind === "extra-field") result.score = 5;
  if (kind === "too-many-focus") result.focus = Array(3).fill({ title: "t", reason: "r", practice: "p" });
  if (kind === "invalid-json") extra.output = [{ type: "message", content: [{ type: "output_text", text: "not json" }] }];
  if (kind === "incomplete") extra.status = "incomplete";
  if (kind === "refusal") extra.output = [{ type: "message", content: [{ type: "refusal", refusal: "private refusal" }] }];
  if (kind === "content-filter") extra = { status: "incomplete", incomplete_details: { reason: "content_filter" } };
  fetch.mockResolvedValue(reply(result, extra));
  await expect(developmentOpenAIProvider.generate(context)).rejects.toMatchObject({ code: kind === "refusal" || kind === "content-filter" ? "DEVELOPMENT_OPENAI_REFUSAL" : kind === "incomplete" ? "DEVELOPMENT_OPENAI_INCOMPLETE" : "DEVELOPMENT_INVALID_RESULT" });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it.each([401, 404, 429, 500])("sanitizes HTTP %s errors and never logs or retries them", async status => {
  fetch.mockResolvedValue(new Response(JSON.stringify({ error: { message: "Private user content and secret key", type: "api_error" } }), { status }));
  await expect(developmentOpenAIProvider.generate(context)).rejects.toMatchObject({ status: 503, metrics: { httpStatus: status } });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("missing key and revoked consent prevent any request", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  await expect(developmentOpenAIProvider.generate(context)).rejects.toMatchObject({ code: "DEVELOPMENT_OPENAI_CONFIG" });
  await expect(developmentOpenAIProvider.generate(context, { signal: AbortSignal.abort() })).rejects.toMatchObject({ code: "DEVELOPMENT_CONSENT_REQUIRED" });
  expect(fetch).not.toHaveBeenCalled();
});
it("aborts an in-flight request when consent is revoked without retry", async () => {
  const controller = new AbortController();
  let started;
  const entered = new Promise(resolve => { started = resolve; });
  fetch.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    started();
  }));
  const pending = expect(developmentOpenAIProvider.generate(context, { signal: controller.signal })).rejects.toMatchObject({ code: "DEVELOPMENT_CONSENT_REQUIRED" });
  await entered; controller.abort(); await pending;
  expect(fetch).toHaveBeenCalledTimes(1);
});
