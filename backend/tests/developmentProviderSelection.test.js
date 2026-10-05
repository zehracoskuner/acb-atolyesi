import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { developmentConfig } from "../config/development.js";
import { selectDevelopmentProvider } from "../services/developmentProviderSelection.js";
import { developmentProvider } from "../services/developmentProvider.js";
import { developmentOpenAIProvider } from "../services/developmentOpenAIProvider.js";
beforeEach(() => {
  for (const name of ["DEVELOPMENT_COACH_PROVIDER", "DEVELOPMENT_COACH_MODEL", "DEVELOPMENT_ANALYSIS_TIMEOUT_MS"]) vi.stubEnv(name, undefined);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
it("defaults production coaching to Luna low with a 90-second timeout", async () => {
  const config = developmentConfig();
  expect(config).toMatchObject({ provider: "openai", model: "gpt-6-luna", timeoutMs: 90000 });
  const openai = vi.spyOn(developmentOpenAIProvider, "generate").mockResolvedValue({ test: true });
  const gemini = vi.spyOn(developmentProvider, "generate");
  await selectDevelopmentProvider(config).generate({ samples: [] }, { signal: undefined });
  expect(openai).toHaveBeenCalledWith({ samples: [] }, { signal: undefined, model: "gpt-6-luna", timeoutMs: 90000 });
  expect(gemini).not.toHaveBeenCalled();
});
it("supports explicit provider/model selection without changing GEMINI_MODEL", async () => {
  vi.stubEnv("GEMINI_MODEL", "arc-gemini-model");
  vi.stubEnv("DEVELOPMENT_COACH_PROVIDER", "gemini");
  vi.stubEnv("DEVELOPMENT_COACH_MODEL", "coach-gemini-model");
  const gemini = vi.spyOn(developmentProvider, "generate").mockResolvedValue({ test: true });
  await selectDevelopmentProvider().generate({ samples: [] });
  expect(gemini).toHaveBeenCalledWith({ samples: [] }, { model: "coach-gemini-model", timeoutMs: 90000 });
  expect(process.env.GEMINI_MODEL).toBe("arc-gemini-model");
});
it.each(["refusal", "timeout", "network"])("does not fall back to Gemini on %s", async message => {
  vi.spyOn(developmentOpenAIProvider, "generate").mockRejectedValue(Error(message));
  const gemini = vi.spyOn(developmentProvider, "generate");
  await expect(selectDevelopmentProvider().generate({ samples: [] })).rejects.toThrow(message);
  expect(gemini).not.toHaveBeenCalled();
});
it.each(["", "other"])("rejects unsupported provider %s", value => {
  vi.stubEnv("DEVELOPMENT_COACH_PROVIDER", value);
  expect(() => developmentConfig()).toThrow("Invalid development provider");
});
it("validates the model and timeout", () => {
  vi.stubEnv("DEVELOPMENT_COACH_MODEL", " ");
  expect(() => developmentConfig()).toThrow("Invalid development model");
  vi.stubEnv("DEVELOPMENT_COACH_MODEL", "gpt-6-luna");
  vi.stubEnv("DEVELOPMENT_ANALYSIS_TIMEOUT_MS", "NaN");
  expect(() => developmentConfig()).toThrow("Invalid development timeout");
});
