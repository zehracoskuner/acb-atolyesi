import { developmentConfig } from "../config/development.js";
import { developmentProvider } from "./developmentProvider.js";
import { developmentOpenAIProvider } from "./developmentOpenAIProvider.js";

// Exactly one configured provider. Errors never cause a cross-provider retry.
export function selectDevelopmentProvider(config = developmentConfig()) {
  const adapter = config.provider === "openai" ? developmentOpenAIProvider : config.provider === "gemini" ? developmentProvider : null;
  if (!adapter) throw new Error("Invalid development provider");
  return { ...adapter, generate: (context, options) => adapter.generate(context, { ...options, model: config.model, timeoutMs: config.timeoutMs }) };
}
