// src/lib/pusula.js
// Gelişim Pusulası — veri katmanı. Saf mantık + localStorage, UI yok.
// Sinyal sözleşmesi: { ts, skill, severity, source }
//   skill   : writingConstraints + focus taksonomisiyle uyumlu (duygu, altmetin, ritim…)
//   severity: "low" | "medium" | "high"
//   source  : "rule" (koç motoru, bedava) | "review" (focus review verdict'i)

const KEY = "acb_pusula";
const MAX = 500;                       // sinyal geçmişi tavanı
const SEVERITY_W = { low: 1, medium: 2, high: 3 };
const HALF_LIFE_DAYS = 30;             // eski sinyaller yarılanarak solar

export const SKILL_LABELS = {
  karakter: "Karakter", diyalog: "Diyalog", duygu: "Duygu gösterimi",
  ritim: "Ritim", betimleme: "Betimleme", tekrar: "Tekrar",
  altmetin: "Alt metin", atmosfer: "Atmosfer", bakis: "Bakış açısı",
  zaman: "Zaman", duyular: "Duyular", kurgu: "Sahne kurgusu", etki: "Okur etkisi",
};
export const skillLabel = (skill) => SKILL_LABELS[skill] || skill;

/* ── Depo ── */
export function getSignals() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(signals) {
  try {
    localStorage.setItem(KEY, JSON.stringify(signals.slice(-MAX)));
  } catch {
    /* kota dolu / private mode — sessizce geç */
  }
}

export function recordSignal({ skill, severity = "medium", source = "rule" }) {
  if (!skill) return;
  const sev = SEVERITY_W[severity] ? severity : "medium";
  const signals = getSignals();
  signals.push({ ts: Date.now(), skill, severity: sev, source });
  save(signals);
}

export function clearPusula() {
  try { localStorage.removeItem(KEY); } catch { /* */ }
}

/* ── Toplama ── */
function recencyWeight(ts, now) {
  const ageDays = (now - ts) / 86_400_000;
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

// Beceri başına recency-ağırlıklı severity skoru, yüksekten düşüğe.
export function getSkillScores({ sinceDays = null } = {}) {
  const now = Date.now();
  const cutoff = sinceDays ? now - sinceDays * 86_400_000 : 0;
  const acc = {};
  for (const s of getSignals()) {
    if (s.ts < cutoff) continue;
    const w = (SEVERITY_W[s.severity] || 1) * recencyWeight(s.ts, now);
    (acc[s.skill] ||= { skill: s.skill, score: 0, count: 0 });
    acc[s.skill].score += w;
    acc[s.skill].count += 1;
  }
  return Object.values(acc).sort((a, b) => b.score - a.score);
}

// En zayıf beceri (Antrenman reçetesi bunu kullanacak).
export function getWeakest(opts) {
  const ranked = getSkillScores(opts);
  return ranked.length ? ranked[0] : null;
}

// Yörünge: bir becerinin geçmişini ikiye böl, son yarı daha iyi mi?
// Varsayılan olarak review verdict'lerine bakar (rule notları gürültülü).
export function getTrajectory(skill, { minSamples = 4, source = "review" } = {}) {
  const list = getSignals()
    .filter((s) => s.skill === skill && (!source || s.source === source))
    .sort((a, b) => a.ts - b.ts);

  if (list.length < minSamples) return { direction: "yetersiz", samples: list.length };

  const mid = Math.floor(list.length / 2);
  const avg = (arr) =>
    arr.reduce((sum, s) => sum + (SEVERITY_W[s.severity] || 1), 0) / (arr.length || 1);
  const olderAvg = avg(list.slice(0, mid));
  const recentAvg = avg(list.slice(mid));
  const delta = recentAvg - olderAvg;

  let direction = "sabit";
  if (delta <= -0.5) direction = "iyilesiyor";
  else if (delta >= 0.5) direction = "kotulesiyor";
  return { direction, samples: list.length, olderAvg, recentAvg };
}