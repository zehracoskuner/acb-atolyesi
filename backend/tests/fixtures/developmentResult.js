export function validDevelopmentResult(analysisType = "baseline") {
  return {
    analysisType, headline: "Test headline", summary: "Test summary",
    voiceProfile: { signatureTraits: [{ trait: "Test trait", evidence: "Test evidence", confidence: "medium" }], developingTraits: [], frictions: [] },
    progress: { preserved: [], improved: [], emerging: [], persistent: [] }, focus: [],
    profileSnapshot: { narrativeDistance: "", interiority: "", dialogue: "", description: "", rhythm: "", subtext: "", bodyLanguage: "", pov: "", repetitionPatterns: [], distinctiveVoice: [] },
    coachNote: "Test observation",
  };
}
