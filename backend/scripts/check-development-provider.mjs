// Explicit live smoke check: synthetic prose only, no database or user quota.
import "dotenv/config";
import { developmentConfig } from "../config/development.js";
import { selectDevelopmentProvider } from "../services/developmentProviderSelection.js";
const developmentProvider = selectDevelopmentProvider();

if (!process.argv.includes("--live")) throw new Error("Pass --live to send one synthetic sample to the configured provider.");
if (!developmentConfig().enabled) throw new Error("Development coach is disabled.");
const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (!response.ok) {
    const detail = await response.clone().json().catch(() => ({}));
    const safeMessage = String(detail.error?.message || "").replaceAll(process.env.GEMINI_API_KEY || "unused-key", "[redacted]");
    console.error(JSON.stringify({ providerStatus: response.status, message: safeMessage }));
  } else {
    const detail = await response.clone().json().catch(() => ({}));
    console.log(JSON.stringify({ providerStatus: response.status,
      finishReason: detail.candidates?.[0]?.finishReason, blockReason: detail.promptFeedback?.blockReason,
      usage: detail.usageMetadata || (detail.usage ? { inputTokens: detail.usage.input_tokens, outputTokens: detail.usage.output_tokens } : undefined) }));
  }
  return response;
};
try {
  const context = {
    kind: "baseline", workContext: { title: "Synthetic verification sample" }, previous: null,
    samples: [{ revision: 1, text: "Akşam vapuru iskeleye yaklaşırken Elif cebindeki anahtarı sıktı. Eve dönmeyeli üç yıl olmuştu. Babasının pencerede beklediğini düşündü, sonra bu düşünceden utandı. Babası artık orada değildi. Sokaktaki fırından ekmek kokusu geliyordu. Fırıncı başını kaldırıp onu tanıdı ama bir şey söylemedi. Elif iki ekmek istedi. Biri gereksizdi; bunu ancak kapıya vardığında fark etti. Merdivendeki ışık yanmıyordu. Basamakları sayarak çıktı. Kapıyı açınca evin sessizliği karşısında durdu. Çantasını yere bıraktı, ekmekleri masaya koydu. Mutfağın penceresi aralıktı. Perde rüzgârla kıpırdadı. Elif sandalyeyi çekip oturdu. Bir süre anahtarı elinden bırakamadı." }],
  };
  if (process.argv.includes("--full")) {
    const words = context.samples[0].text.split(/\s+/u);
    context.samples[0].text = Array.from({ length: 3000 }, (_, i) => words[i % words.length]).join(" ");
  }
  console.log(JSON.stringify({ sampleWords: context.samples[0].text.split(/\s+/u).length }));
  const output = await developmentProvider.generate(context);
  console.log(JSON.stringify({ ok: true, model: output.modelIdentifier, analysisType: output.result.analysisType, valid: developmentProvider.validate(output.result, { kind: "baseline" }) }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: error.code, message: error.message }));
  process.exitCode = 1;
} finally { globalThis.fetch = originalFetch; }
