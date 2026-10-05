import { afterEach, expect, it, vi } from "vitest";
import { developmentConfig } from "../config/development.js";
afterEach(() => vi.unstubAllEnvs());
it("defaults to two and accepts a configurable positive integer limit without an hourly cooldown", () => {
  vi.stubEnv("DEVELOPMENT_ANALYSIS_DAILY_LIMIT", undefined);
  expect(developmentConfig().dailyLimit).toBe(2);
  vi.stubEnv("DEVELOPMENT_ANALYSIS_DAILY_LIMIT", "3");
  vi.stubEnv("DEVELOPMENT_ANALYSIS_COOLDOWN_HOURS", "invalid-unused-legacy-setting");
  expect(developmentConfig().dailyLimit).toBe(3);
  expect(developmentConfig()).not.toHaveProperty("cooldownMs");
});
it.each(["", "0", "-1", "1.5", "NaN", "Infinity"])("rejects invalid limit %s", value => {
  vi.stubEnv("DEVELOPMENT_ANALYSIS_DAILY_LIMIT", value);
  expect(() => developmentConfig()).toThrow("Invalid development daily limit");
});
