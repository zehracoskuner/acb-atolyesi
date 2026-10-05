// Matches the schema supplied with the writer-development prompt.
const text = (maxLength = 4000, minLength = 1) => ({ type: "STRING", minLength, maxLength });
const list = (items, maxItems = 20) => ({ type: "ARRAY", items, maxItems });
const object = properties => ({ type: "OBJECT", properties, required: Object.keys(properties) });
const trait = object({ trait: text(), evidence: text(), confidence: { type: "STRING", enum: ["low", "medium", "high"] } });
export const coachResultSchema = object({
  analysisType: { type: "STRING", enum: ["baseline", "progress"] },
  headline: text(300), summary: text(),
  voiceProfile: object({ signatureTraits: list(trait, 5), developingTraits: list(trait, 4), frictions: list(trait, 3) }),
  progress: object({ preserved: list(text()), improved: list(text()), emerging: list(text()), persistent: list(text()) }),
  focus: list(object({ title: text(300), reason: text(), practice: text() }), 2),
  profileSnapshot: object({
    narrativeDistance: text(4000, 0), interiority: text(4000, 0), dialogue: text(4000, 0),
    description: text(4000, 0), rhythm: text(4000, 0), subtext: text(4000, 0),
    bodyLanguage: text(4000, 0), pov: text(4000, 0),
    repetitionPatterns: list(text()), distinctiveVoice: list(text()),
  }),
  coachNote: text(),
});
// The installed Gemini SDK exposes only a subset of JSON Schema. Keep length
// bounds in local validation; send only supported fields to the provider.
export function providerResultSchema(schema = coachResultSchema) {
  const { minLength, maxLength, properties, items, ...supported } = schema;
  if (properties) supported.properties = Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, providerResultSchema(value)]));
  if (items) supported.items = providerResultSchema(items);
  return supported;
}
// OpenAI strict Structured Outputs, derived from the same local contract.
export function openAIResultSchema(schema = coachResultSchema) {
  const { type, properties, items, ...constraints } = schema;
  return { ...constraints, type: type.toLowerCase(),
    ...(properties ? { properties: Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, openAIResultSchema(value)])), additionalProperties: false } : {}),
    ...(items ? { items: openAIResultSchema(items) } : {}) };
}
function matches(value, schema) {
  if (schema.type === "STRING") return typeof value === "string" &&
    (!schema.enum || schema.enum.includes(value)) && value.trim().length >= (schema.minLength ?? 1) &&
    value.length <= (schema.maxLength ?? 100);
  if (schema.type === "ARRAY") return Array.isArray(value) && value.length <= schema.maxItems && value.every(v => matches(v, schema.items));
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).every(key => Object.hasOwn(schema.properties, key)) &&
    schema.required.every(key => Object.hasOwn(value, key) && matches(value[key], schema.properties[key]));
}
export function validateCoachResult(result, context) {
  if (!matches(result, coachResultSchema)) return false;
  if (context && result.analysisType !== (context.kind === "baseline" ? "baseline" : "progress")) return false;
  const improved = new Set(result.progress.improved.map(s => s.trim().toLocaleLowerCase("tr")));
  return !result.progress.persistent.some(s => improved.has(s.trim().toLocaleLowerCase("tr")));
}
