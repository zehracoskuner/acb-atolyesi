// src/lib/kelimeCantasi.js
// Kelime Çantası — frekans + kalıp (phrase) analizi + ses/değnek/yok-say etiketi.
// Tamamen client-side, AI yok.

const PREF_KEY = "acb_kelime_cantasi_prefs"; // { terim: "voice" | "crutch" | "ignore" }

// Sadece dilbilgisel parçacıklar — "çok, gibi, sanki, sessizce" gibi olası değnekler kalsın.
const STOP = new Set([
  "ve","veya","ile","için","de","da","ki","mi","mı","mu","mü","ya",
  "ama","çünkü","ben","sen","o","biz","siz","onlar","bu","şu","bir","ne","ise",
]);

// Fark edilmeden yaslanılan çok-kelimeli kalıplar (tek kelime sayımı bunları kaçırır).
export const CRUTCH_PHRASES = [
  "bir an", "bir anda", "derin bir nefes", "derin bir iç çekiş",
  "gözlerini kaçırdı", "başını çevirdi", "başını salladı",
  "ne diyeceğini bilemedi", "bir süre", "bir şekilde", "bir türlü",
];

function tokenize(t) {
  return (t || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/* ── Tercih deposu ── */
export function getPrefs() {
  try {
    const r = localStorage.getItem(PREF_KEY);
    return r ? JSON.parse(r) : {};
  } catch { return {}; }
}
function savePrefs(p) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* */ }
}
// pref: "voice" | "crutch" | "ignore" | null (null → kaldır)
export function setPref(term, pref) {
  if (!term) return getPrefs();
  const p = getPrefs();
  const key = term.toLowerCase();
  if (pref) p[key] = pref; else delete p[key];
  savePrefs(p);
  return p;
}
export function getPref(term) {
  return getPrefs()[(term || "").toLowerCase()] || null;
}
export function clearPrefs() {
  try { localStorage.removeItem(PREF_KEY); } catch { /* */ }
}

/* ── Frekans analizi (ignore'lar düşer) ── */
export function analyzeWords(text, { top = 10, minLen = 3, minCount = 2 } = {}) {
  const prefs = getPrefs();
  const counts = new Map();
  for (const w of tokenize(text)) {
    if (w.length < minLen || STOP.has(w) || prefs[w] === "ignore") continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([term, count]) => ({ term, count, pref: prefs[term] || null }))
    .filter((x) => x.count >= minCount)     // mesele tekrar → tek kullanımları gösterme
    .sort((a, b) => b.count - a.count)
    .slice(0, top);
}

/* ── Kalıp ifade sayımı (büyük/küçük harf duyarsız, örtüşmeyen) ── */
export function analyzePhrases(text, { minCount = 2 } = {}) {
  const lower = (text || "").toLowerCase();
  const prefs = getPrefs();
  const out = [];
  for (const phrase of CRUTCH_PHRASES) {
    if (prefs[phrase] === "ignore") continue;
    let count = 0, i = 0;
    while ((i = lower.indexOf(phrase, i)) !== -1) { count++; i += phrase.length; }
    if (count >= minCount) out.push({ term: phrase, count, pref: prefs[phrase] || null });
  }
  return out.sort((a, b) => b.count - a.count);
}

/* ── Pusula köprüsü ── */
// Sadece "crutch" işaretli terimler, eşik aşınca. Tekrar selini engeller.
export function crutchSignals(text) {
  const prefs = getPrefs();
  const all = [
    ...analyzeWords(text, { minCount: 1, top: 999 }),
    ...analyzePhrases(text, { minCount: 1 }),
  ];
  const signals = [];
  for (const { term, count } of all) {
    if (prefs[term] !== "crutch") continue;
    if (count >= 6) signals.push({ term, count, severity: "high" });
    else if (count >= 3) signals.push({ term, count, severity: "medium" });
  }
  return signals; // [{ term, count, severity }]
}