import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { developmentProvider, buildCoachInput } from "../services/developmentProvider.js";
import { validateCoachResult } from "../services/developmentResult.js";
import { WRITER_DEVELOPMENT_COACH_PROMPT } from "../prompts/writerDevelopmentCoach.js";
import { validDevelopmentResult } from "./fixtures/developmentResult.js";

const context = { kind: "baseline", userId: "private-user", workId: "private-work", workContext: { title: "Test" }, samples: [{ text: "Sample text", chapterId: "private-chapter", revision: 2 }] };
const response = (result = validDevelopmentResult(), finishReason = "STOP") => new Response(JSON.stringify({
  candidates: [{ content: { parts: [{ text: typeof result === "string" ? result : JSON.stringify(result) }], role: "model" }, finishReason }],
}), { status: 200, headers: { "Content-Type": "application/json" } });
beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("GEMINI_API_KEY", "test-key-not-real");
  vi.stubEnv("GEMINI_MODEL", "test-model");
  vi.stubEnv("DEVELOPMENT_COACH_MODEL", "");
  vi.stubEnv("DEVELOPMENT_ANALYSIS_TIMEOUT_MS", "1000");
  vi.stubGlobal("fetch", vi.fn(async () => response()));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("development adapter with installed SDK and isolated transport", () => {
  it("separates supplied system prompt from prose and returns validated snapshot", async () => {
    const result = await developmentProvider.generate(context);
    expect(result.modelIdentifier).toBe("test-model");
    expect(result.profileSnapshot).toEqual(result.result.profileSnapshot);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, request] = fetch.mock.calls[0];
    expect(String(url)).toContain("test-model");
    const payload = JSON.parse(request.body);
    expect(payload.systemInstruction.parts[0].text).toBe(WRITER_DEVELOPMENT_COACH_PROMPT);
    expect(payload.generationConfig.responseMimeType).toBe("application/json");
    expect(payload.generationConfig.responseSchema.properties.focus.maxItems).toBe(2);
    expect(payload.generationConfig.responseSchema.properties.summary.minLength).toBeUndefined();
    const input = JSON.parse(payload.contents[0].parts[0].text);
    expect(input.analysisMode).toBe("baseline");
    expect(input.samples[0]).toEqual({ text: "Sample text", revision: 2 });
    expect(JSON.stringify(input)).not.toContain("private-");
  });
  it("maps comparison to progress with the prior snapshot and evidence summary", () => {
    const input = buildCoachInput({ ...context, kind: "comparison", previous: { profile: { rhythm: "test" }, summary: { summary: "evidence" } } });
    expect(input.analysisMode).toBe("progress"); expect(input.previousProfile.rhythm).toBe("test");
    expect(input.previousDevelopmentSummary.summary).toBe("evidence");
  });
  it("uses the development model override", async () => {
    vi.stubEnv("DEVELOPMENT_COACH_MODEL", "coach-model");
    expect((await developmentProvider.generate(context)).modelIdentifier).toBe("coach-model");
  });
  it.each(["missing", "invalid", "markdown", "wrong-mode", "truncated", "too-many-focus", "extra-field"])("rejects %s responses", async kind => {
    let result = validDevelopmentResult(), finish = "STOP";
    if (kind === "missing") delete result.summary;
    if (kind === "invalid") result = "not json";
    if (kind === "markdown") result = "```json\n" + JSON.stringify(result) + "\n```";
    if (kind === "wrong-mode") result.analysisType = "progress";
    if (kind === "truncated") finish = "MAX_TOKENS";
    if (kind === "too-many-focus") result.focus = Array(3).fill({ title: "t", reason: "r", practice: "p" });
    if (kind === "extra-field") result.score = 10;
    fetch.mockResolvedValue(response(result, finish));
    await expect(developmentProvider.generate(context)).rejects.toMatchObject({ status: 502 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("aborts timed-out transport and never retries", async () => {
    vi.useFakeTimers();
    fetch.mockImplementation((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))));
    const request = expect(developmentProvider.generate(context)).rejects.toMatchObject({ code: "DEVELOPMENT_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(1001); await request;
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("reports a prompt blocked without candidates instead of an incomplete analysis", async () => {
    fetch.mockResolvedValue(new Response(JSON.stringify({
      promptFeedback: { blockReason: "PROHIBITED_CONTENT", blockReasonMessage: "private feedback" },
      usageMetadata: { promptTokenCount: 10908, totalTokenCount: 10908, privateField: "private usage data" },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await expect(developmentProvider.generate(context)).rejects.toMatchObject({ status: 422, code: "DEVELOPMENT_PROVIDER_BLOCKED" });
    expect(fetch).toHaveBeenCalledTimes(1);
    const log = JSON.stringify(console.warn.mock.calls);
    expect(log).toContain("PROHIBITED_CONTENT");
    for (const secret of ["private feedback", "private usage data", "Sample text", "test-key-not-real"]) expect(log).not.toContain(secret);
  });
  it.each(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"])("does not accept or retry a %s filtered candidate", async finishReason => {
    fetch.mockResolvedValue(response(validDevelopmentResult(), finishReason));
    await expect(developmentProvider.generate(context)).rejects.toMatchObject({ status: 422, code: "DEVELOPMENT_PROVIDER_BLOCKED" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("distinguishes output exhaustion from content filtering", async () => {
    fetch.mockResolvedValue(response("truncated JSON", "MAX_TOKENS"));
    await expect(developmentProvider.generate(context)).rejects.toMatchObject({ status: 502, code: "DEVELOPMENT_OUTPUT_LIMIT" });
  });
  it("revoked consent aborts transport without reporting a provider timeout", async () => {
    const controller = new AbortController();
    let started;
    const entered = new Promise(resolve => { started = resolve; });
    fetch.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))); started();
    }));
    const running = expect(developmentProvider.generate(context, { signal: controller.signal })).rejects.toMatchObject({ code: "DEVELOPMENT_CONSENT_REQUIRED" });
    await entered; controller.abort(); await running;
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([429, 500])("sanitizes provider %s failures without retry", async status => {
    fetch.mockResolvedValue(new Response(JSON.stringify({ error: { message: "secret-provider-message" } }), { status }));
    await expect(developmentProvider.generate(context)).rejects.toMatchObject({ status: 503 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("missing configuration and oversized input do not call the provider", async () => {
    vi.stubEnv("GEMINI_MODEL", "");
    await expect(developmentProvider.generate(context)).rejects.toMatchObject({ code: "DEVELOPMENT_CONFIG" });
    vi.stubEnv("GEMINI_MODEL", "test-model");
    await expect(developmentProvider.generate({ ...context, samples: [{ text: "x".repeat(200001) }] })).rejects.toMatchObject({ status: 413 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("validates prompt cardinalities, confidence and contradictory exact changes", () => {
    const result = validDevelopmentResult();
    expect(validateCoachResult(result)).toBe(true);
    result.voiceProfile.signatureTraits[0].confidence = "certain";
    expect(validateCoachResult(result)).toBe(false);
    result.voiceProfile.signatureTraits = [];
    result.progress.improved = ["same"];
    result.progress.persistent = ["same"];
    expect(validateCoachResult(result)).toBe(false);
    expect(validateCoachResult(null)).toBe(false);
  });
});
