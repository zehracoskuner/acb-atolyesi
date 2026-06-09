// routes/ai.js — ACB Atölyesi AI Router
import "dotenv/config";
import { Router }             from "express";
import rateLimit              from "express-rate-limit";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ensureAuth             from "../middlewares/ensureAuth.js";

const GEMINI_KEY   = () => process.env.GEMINI_API_KEY  || "";
const GEMINI_MODEL = () => process.env.GEMINI_MODEL    || "gemini-1.5-flash";
const MIN_INTERVAL = Number(process.env.GEMINI_MIN_INTERVAL_MS || 1200);

/* ─── Sistem promptları ─── */
const BASE_IDENTITY = `
Sen ACB Atölyesi'nin Yazarlık Koçu AI'sısın.
Görevin: yazarın kendi sesini bulmasına ve hikâyesini güçlendirmesine yardım etmek.
Kullanıcı yerine yazmaz, sadece yolunu açarsın.
Temel ilke: "Bu senin hikâyen — ben sadece haritayı tutuyorum."

SIKI SINIRLAR:
- Erotik içerik, gore, +18 sahneler ❌
- Terapi, flört, aile danışmanlığı ❌
- Finans, siyaset, sağlık tavsiyeleri ❌
- Reşit olmayan karakterlerle riskli sahneler ❌

ÜSLUP: Kısa, teknik, doğrudan. Gereksiz övgü yok. Yazara doğrudan hitap et.
`.trim();

const PLOTWORLD_SYSTEM = `
${BASE_IDENTITY}

PlotWorld — Sahne ve Olay Örgüsü Analizi:
Sen bir dramaturg gibi düşünürsün. Bağlantı sayısı, sahne adedi gibi metriklere takılmazsın.
Seni ilgilendiren: nedensellik zinciri, karakterin dönüşüm eğrisi, duygusal tempo, dramatik gerilimin nerede yoğunlaştığı.
Her analizinde yazara somut ve eyleme dönük bir yol açarsın.
Abartılı övgü yok. Gerçeği söyle, ama yapıcı ol.
`.trim();

/* ─── Review odakları (whitelist) ─── */
const REVIEW_FOCUS = {
  genel: {
    label: "Genel editör yorumu",
    instruction:
      "Metni bütünsel değerlendir: en güçlü yanı ne, en çok hangi yönü gelişebilir? Tek bir alana sıkışma.",
  },
  karakter: {
    label: "Karakter gerçekçiliği",
    instruction:
      "Sadece karaktere odaklan: istek ve korkuları metinden okunuyor mu, davranışları tutarlı mı, duygular gösteriliyor mu yoksa etiketleniyor mu (örn. 'üzgündü' deyip geçmek)?",
  },
  diyalog: {
    label: "Diyalog doğallığı",
    instruction:
      "Sadece diyaloğa odaklan: karakterlerin sesleri birbirinden ayrışıyor mu, alt metin var mı, replikler bilgi dökümüne kaçıyor mu, konuşma gerçekçi mi?",
  },
  duygu: {
    label: "Duygu gösterimi",
    instruction:
      "Sadece duygu gösterimine odaklan: duygular doğrudan mı söyleniyor, yoksa beden dili, eylem ve seçimlerle mi sezdiriliyor? 'Göster, anlatma' ilkesiyle değerlendir.",
  },
  ritim: {
    label: "Sahne ritmi",
    instruction:
      "Sadece tempo ve ritme odaklan: cümle uzunlukları çeşitleniyor mu, metin akıyor mu yoksa tıkanıyor mu, nerede hızlanmalı veya yavaşlamalı?",
  },
  betimleme: {
    label: "Betimleme gücü",
    instruction:
      "Sadece betimlemeye odaklan: duyusal detaylar somut mu, mekân ruh hâlini taşıyor mu, betimleme klişeye mi kaçıyor yoksa özgün mü?",
  },
  tekrar: {
    label: "Tekrarlar",
    instruction:
      "Sadece tekrarlara odaklan: aynı kelime veya yapı fazla mı tekrar ediyor, koltuk değneği kelimeler var mı, cümle başlangıçları monoton mu?",
  },
};

/* ─── Pusula sinyali için whitelist ─── */
const SIGNAL_SKILLS = new Set([
  "karakter", "diyalog", "duygu", "ritim", "betimleme", "tekrar",
  "altmetin", "atmosfer", "bakis", "zaman", "duyular", "kurgu", "etki",
]);
const SIGNAL_SEVERITY = new Set(["low", "medium", "high"]);

/* ─── Gemini istemcisi ─── */
let _genAI = null;

function getModel() {
  const key = GEMINI_KEY();
  if (!key) throw new Error("GEMINI_API_KEY eksik (.env)");
  if (!_genAI) _genAI = new GoogleGenerativeAI(key);
  return _genAI.getGenerativeModel({ model: GEMINI_MODEL() });
}

function buildRequest(system = "", userPrompt = "") {
  return {
    contents: [
      { role: "model", parts: [{ text: system.trim() }] },
      { role: "user",  parts: [{ text: userPrompt.trim() }] },
    ],
  };
}

let _lastCallAt = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function throttle() {
  const wait = Math.max(0, MIN_INTERVAL - (Date.now() - _lastCallAt));
  if (wait > 0) await sleep(wait);
  _lastCallAt = Date.now();
}

async function callGemini(system, userPrompt, { retries = 3, baseDelay = 800 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      await throttle();
      const result = await getModel().generateContent(buildRequest(system, userPrompt));
      return result?.response?.text?.() || "";
    } catch (e) {
      lastErr = e;
      const msg  = String(e?.message || e);
      const wait = msg.includes("429") || msg.includes("quota") || msg.includes("503");
      if (wait && i < retries) { await sleep(baseDelay * Math.pow(2, i)); continue; }
      break;
    }
  }
  throw lastErr;
}

function parseJSON(raw) {
  const clean = raw.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end   = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("JSON bulunamadı");
  return JSON.parse(clean.slice(start, end + 1));
}

/* ─── Rate limit ─── */
const limiter = rateLimit({
  windowMs: 60_000,
  max: 25,
  message: { error: "Çok fazla istek. Bir dakika bekle." },
});

const router = Router();
router.use(limiter);

/* ══════════════════════════════════════════════
   GENEL UÇLAR
══════════════════════════════════════════════ */

router.post("/chat",  ensureAuth, async (req, res) => {
  const { input, context } = req.body || {};
  if (!input?.trim()) return res.status(400).json({ error: "input gerekli" });
  const prompt = `Bağlam: ${context || "(yok)"}\n\nKullanıcı sorusu: ${input}`;
  try {
    const answer = await callGemini("", prompt);
    res.json({ answer });
  } catch (e) {
    console.error("[AI/chat]", e?.message);
    res.json({ answer: "Bir sorun oluştu, tekrar dener misin?" });
  }
});

router.post("/review", ensureAuth, async (req, res) => {
  const { text, focus } = req.body || {};
  if (!text || text.trim().length < 10)
    return res.status(400).json({ error: "text gerekli (min 10 karakter)" });

  const f = REVIEW_FOCUS[focus] ? focus : "genel";
  const { label, instruction } = REVIEW_FOCUS[f];

  const prompt = `
Metni okuyucu + editör + yazarlık koçu bakışıyla değerlendir.
DEĞERLENDİRME ODAĞI: ${label}.
${instruction}

SADECE şu JSON:
{
  "analysis":    "Tek akıcı paragraf — yukarıdaki odağa göre teknik yorum.",
  "closingNote": "Yazara bu odakla ilgili 1 cümlelik yönlendirici kapanış.",
  "weakness": {
    "skill": "En çok gelişmesi gereken tek alan (odak belirliyse o odak): karakter|diyalog|duygu|ritim|betimleme|tekrar|altmetin|atmosfer|bakis|zaman|duyular|kurgu|etki",
    "severity": "Bu alanın aciliyeti: low|medium|high"
  }
}
Metin:
${text}
`.trim();

  try {
    const raw    = await callGemini("", prompt);
    const parsed = parseJSON(raw);

    const w = parsed.weakness || {};
    const skill = f !== "genel"
      ? f
      : (SIGNAL_SKILLS.has(w.skill) ? w.skill : null);
    const severity = SIGNAL_SEVERITY.has(w.severity) ? w.severity : "medium";
    const signal = skill ? { skill, severity } : null;

    res.json({
      focus:       f,
      focusLabel:  label,
      analysis:    parsed.analysis    || "",
      closingNote: parsed.closingNote || "",
      signal,
    });
  } catch (e) {
    const is429 = String(e?.message).includes("429");
    console.error("[AI/review]", e?.message);
    if (is429) return res.status(429).json({ error: "Gemini kotası doldu. Biraz bekle." });
    res.status(500).json({ error: "Değerlendirme yapılamadı." });
  }
});

router.post("/chaos", ensureAuth, async (req, res) => {
  const { characterName, role, notes, mode = "question" } = req.body || {};
  if (!characterName?.trim())
    return res.status(400).json({ message: "characterName gerekli" });

  const jsonShape = mode === "qa"
    ? `{ "question": "...", "internal_truth": "..." }`
    : `{ "question": "..." }`;

  const prompt = `
Karakter: ${characterName.trim()}
Rol: ${role || "(yok)"}
Notlar: ${notes ? String(notes).slice(0, 1200) : "(yok)"}

Bu karakterin maskesini sarsacak, iç çelişkisini açığa çıkaran bir derinlik sorusu üret.
Ahlaki ikilem, gizli korku veya bastırılmış tutkulara odaklan.
Edebi, keskin, kışkırtıcı dil — erotizm/gore kesinlikle yok.

SADECE şu JSON: ${jsonShape}
`.trim();

  try {
    const raw    = await callGemini("", prompt);
    const parsed = parseJSON(raw);
    res.json({ question: parsed.question || "", internal_truth: parsed.internal_truth || "" });
  } catch (e) {
    console.error("[AI/chaos]", e?.message);
    res.status(500).json({ message: "Kaos sorusu üretilemedi." });
  }
});

router.post("/scene-spark", ensureAuth, async (req, res) => {
  const { characters } = req.body || {};
  if (!Array.isArray(characters) || characters.length !== 2)
    return res.status(400).json({ message: "Tam 2 karakter gerekli" });

  const [a, b] = characters;
  const prompt = `
Karakter A: ${a.name} (${a.role || "?"}) — ${a.notes || "(notlar yok)"}
Karakter B: ${b.name} (${b.role || "?"}) — ${b.notes || "(notlar yok)"}

Bu iki karakter arasında bir sahne BAŞLANGICI yaz:
- Max 2 kısa paragraf
- Açık ya da örtük gerilim zorunlu
- En az bir karakter bir şeyi gizlemeli
- Atmosfer duyguyu desteklemeli
- Sonuç bağlama, açık bırak
- Güvenli: erotizm/gore yok

Sadece sahne metnini yaz.
`.trim();

  try {
    const scene = await callGemini("", prompt);
    res.json({ scene });
  } catch (e) {
    console.error("[AI/scene-spark]", e?.message);
    res.status(500).json({ message: "Sahne üretilemedi." });
  }
});

/* ══════════════════════════════════════════════
   PLOTWORLD UÇLARI
══════════════════════════════════════════════ */

router.post("/plotworld/butterfly", ensureAuth, async (req, res) => {
  const {
    scene,
    connectedScenes = [],
    allScenes       = [],
    characters      = [],
    allActLabels    = {},
    worldRules      = [],
  } = req.body || {};

  if (!scene?.title) return res.status(400).json({ message: "scene.title gerekli" });

  const actLabel = allActLabels[scene.act] || scene.act || "?";

  const connText = connectedScenes.length
    ? connectedScenes.map(s => `  • "${s.title}" (${allActLabels[s.act] || s.act})${s.goal ? ` — ${s.goal}` : ""}`).join("\n")
    : "  (bağlı sahne yok)";

  const storyFlow = allScenes.length
    ? allScenes.slice(0, 20).map(s => `  [${allActLabels[s.act] || s.act}] "${s.title}"${s.goal ? ` — ${s.goal}` : ""}`).join("\n")
    : "  (diğer sahne yok)";

  const charText = characters.length
    ? characters.map(c => `  • ${c.name} (${c.role || "?"})${c.notes ? `: ${String(c.notes).slice(0, 200)}` : ""}`).join("\n")
    : "  (karakter notu yok)";

  const rulesText = worldRules.length
    ? worldRules.slice(0, 5).map(r => `  • ${r}`).join("\n")
    : "  (kural tanımlanmamış)";

  const isAlt = scene.isAlternative
    ? "⚠ Bu zaten bir ALTERNATİF DAL sahnesi."
    : "";

  const prompt = `
Sen bir yazarlık koçusun ve dramaturg gibi düşünüyorsun.
${isAlt}

─── ODAK SAHNE ───────────────────────────────────
"${scene.title}" — ${actLabel} perdesi
Hedef: ${scene.goal || "(belirtilmemiş)"}
Özet: ${scene.description || "(özet yok)"}
Durum: ${scene.status || "?"}

─── BU SAHNEDEN SONRA GELEN SAHNELER ─────────────
${connText}

─── HİKÂYENİN GENEL AKIŞI ────────────────────────
${storyFlow}

─── SAHNEDEKİ KARAKTERLER ────────────────────────
${charText}

─── DÜNYA KURALLARI ──────────────────────────────
${rulesText}

GÖREV:
Bu sahne farklı bir kararla ya da sonuçla bitseydi hikâye nasıl dallanırdı?
3 farklı, dramatik açıdan belirgin alternatif dal üret.
Klişelerden kaçın. Her dal farklı bir dramatik mantığı izlemeli.

SADECE şu JSON:
{
  "branches": [
    {
      "title":           "Dalın adı — kısa ama çarpıcı (maks 7 kelime)",
      "consequence":     "Bu tercihle hikâye nasıl devam eder? (2-3 cümle)",
      "characterImpact": "Bu sahnedeki karakter(ler) ne kaybeder ya da kazanır? (1-2 cümle)",
      "emotionalShift":  "Hikâyenin duygusal tonu nasıl değişir? (1 cümle)",
      "reversible":      true
    }
  ]
}
`.trim();

  try {
    const raw    = await callGemini(PLOTWORLD_SYSTEM, prompt);
    const parsed = parseJSON(raw);
    res.json({ branches: (parsed.branches || []).slice(0, 3) });
  } catch (e) {
    console.error("[AI/plotworld/butterfly]", e?.message);
    res.status(500).json({ message: "Kelebek analizi yapılamadı." });
  }
});

// ai.js — gap-analysis endpoint'ini bununla değiştir

router.post("/plotworld/gap-analysis", ensureAuth, async (req, res) => {
  const { scenes = [], actOrder = [], allActLabels = {} } = req.body || {};
  if (!scenes.length) return res.status(400).json({ message: "scenes gerekli" });

  /* Yazım durumu istatistikleri — AI'ya bağlam ver */
  const totalScenes = scenes.length;
  const doneCount   = scenes.filter(s => s.status === "done").length;
  const writingCount= scenes.filter(s => s.status === "writing" || s.status === "drafting").length;
  const ideaCount   = scenes.filter(s => s.status === "idea" || !s.status).length;

  /* Hikayenin olgunluk seviyesi */
  const maturity = doneCount === 0 && writingCount === 0
    ? "henüz başlangıç aşamasında — sahnelerin tamamı fikir halinde"
    : doneCount < totalScenes * 0.3
    ? "erken yazım aşamasında — sahnelerin büyük çoğunluğu henüz yazılmamış"
    : doneCount < totalScenes * 0.7
    ? "orta yazım aşamasında — bir kısım sahne tamamlanmış"
    : "ileri yazım aşamasında — sahnelerin büyük çoğunluğu tamamlanmış";

  const byAct = actOrder.map(actId => {
    const label     = allActLabels[actId] || actId;
    const actScenes = scenes.filter(s => s.act === actId);
    return `\n=== ${label} (${actScenes.length} sahne) ===\n` +
      (actScenes.length
        ? actScenes.map(s =>
            `• [${s.id}] "${s.title}"` +
            `${s.goal        ? `\n  hedef: ${s.goal}`                     : ""}` +
            `${s.description ? `\n  özet: ${s.description.slice(0, 150)}` : ""}` +
            `\n  durum: ${s.status || "fikir"}`
          ).join("\n\n")
        : "  (henüz sahne yazılmamış)");
  }).join("\n");

  const prompt = `
Sen bir yazarlık koçusun. Yazarın henüz tamamlanmamış bir hikayesini analiz ediyorsun.

ÖNEMLİ BAĞLAM:
Bu hikaye ${maturity}.
Toplam ${totalScenes} sahne var: ${doneCount} tamamlanmış, ${writingCount} yazılıyor, ${ideaCount} fikir aşamasında.

Bu nedenle analizini yaparken şunu göz önünde bulundur:
- Boş veya az sahneli perdeler "eksik" değil, "henüz yazılmamış" olabilir. Bunu "hata" olarak değil, "fırsat" olarak sun.
- Tamamlanmış sahneler üzerinden nedensellik ve tempo yorumu yap.
- Henüz yazılmamış perdelere "buraya şu gelebilir" şeklinde yönlendirici öneride bulun.
- Yazarı cesaretsizleştirme, yönlendir. "Eksik" yerine "henüz yazılmamış", "sorun" yerine "güçlendirilebilir" dil kullan.

─── PERDE YAPISI ──────────────────────────────
${byAct}
───────────────────────────────────────────────

GÖREV:
1. Tamamlanmış sahneler arasındaki nedensellik bağlarını değerlendir
2. Boş perdelere yazara yol gösterecek öneriler sun
3. Tempo ve ritim sorunlarını işaretle
4. İzole sahneleri tespit et
5. Amacı belirsiz sahneleri işaretle

SADECE şu JSON:
{
  "summary": "Hikayenin şu anki durumunun yapıcı değerlendirmesi. Güçlü yanları da mutlaka belirt. (3-4 cümle)",
  "gaps": [
    {
      "type":       "missing_act | causality | tempo | isolated_scene | unclear_goal",
      "actId":      "ilgili akt id (yoksa null)",
      "sceneId":    "ilgili sahne id (yoksa null)",
      "message":    "Sorunu yapıcı bir dille açıkla. 'Eksik' yerine 'henüz yazılmamış' kullan. (1-2 cümle)",
      "suggestion": "Yazara somut, eyleme dönük ve cesaret verici öneri. (1-2 cümle)"
    }
  ]
}
`.trim();

  try {
    const raw    = await callGemini(PLOTWORLD_SYSTEM, prompt);
    const parsed = parseJSON(raw);
    res.json({ gaps: parsed.gaps || [], summary: parsed.summary || "" });
  } catch (e) {
    console.error("[AI/plotworld/gap-analysis]", e?.message);
    res.status(500).json({ message: "Boşluk analizi yapılamadı." });
  }
});

router.post("/plotworld/scene-suggest", ensureAuth, async (req, res) => {
  const { actId, actLabel, existingScenes = [], characters = [] } = req.body || {};
  if (!actId) return res.status(400).json({ message: "actId gerekli" });

  const sceneList = existingScenes.length
    ? existingScenes.map(s => `• "${s.title}"${s.goal ? ` — hedef: ${s.goal}` : ""}`).join("\n")
    : "(henüz sahne yok)";

  const charList = characters.length
    ? characters.map(c => `• ${c.name} (${c.role || "?"})${c.notes ? `: ${String(c.notes).slice(0, 150)}` : ""}`).join("\n")
    : "(karakter tanımlanmamış)";

  const prompt = `
Perde: ${actLabel || actId}
Mevcut sahneler:
${sceneList}

Karakterler:
${charList}

GÖREV:
Bu perdeye eklenebilecek 3 özgün sahne öner.
Her öneri belirli bir dramatik işlev üstlenmeli.

SADECE şu JSON:
{
  "suggestions": [
    {
      "title":            "Sahne başlığı",
      "goal":             "Dramatik hedef (1 cümle)",
      "dramaticFunction": "Bu sahne hikâyede ne işe yarıyor? (1 cümle)",
      "hint":             "Yazara ipucu (1 cümle)"
    }
  ]
}
`.trim();

  try {
    const raw    = await callGemini(PLOTWORLD_SYSTEM, prompt);
    const parsed = parseJSON(raw);
    res.json({ suggestions: (parsed.suggestions || []).slice(0, 3) });
  } catch (e) {
    console.error("[AI/plotworld/scene-suggest]", e?.message);
    res.status(500).json({ message: "Sahne önerisi üretilemedi." });
  }
});

router.post("/plotworld/story-coach", ensureAuth, async (req, res) => {
  const {
    scenes      = [],
    characters  = [],
    world       = {},
    actOrder    = [],
    allActLabels= {},
  } = req.body || {};

  if (!scenes.length) return res.status(400).json({ message: "scenes gerekli" });

  const byAct = actOrder.map(actId => {
    const label     = allActLabels[actId] || actId;
    const actScenes = scenes.filter(s => s.act === actId);
    if (!actScenes.length) return `\n— ${label}: (boş)`;
    return `\n— ${label} (${actScenes.length} sahne):\n` +
      actScenes.map(s =>
        `  • "${s.title}"` +
        `${s.goal        ? `\n    hedef: ${s.goal}`                     : ""}` +
        `${s.description ? `\n    özet: ${s.description.slice(0, 180)}` : ""}` +
        `\n    durum: ${s.status || "fikir"}`
      ).join("\n\n");
  }).join("");

  const charText = characters.length
    ? characters.map(c =>
        `• ${c.name} (${c.role || "?"})` +
        `${c.notes ? `\n  ${String(c.notes).slice(0, 200)}` : ""}`
      ).join("\n\n")
    : "(karakter tanımlanmamış)";

  const worldText = (() => {
    const parts = [];
    if (world.locations?.length) parts.push(`Mekanlar: ${world.locations.slice(0, 5).map(x => x.name).join(", ")}`);
    if (world.rules?.length)     parts.push(`Kurallar: ${world.rules.slice(0, 4).map(x => x.name).join(" | ")}`);
    if (world.notes?.length)     parts.push(`Notlar: ${world.notes.slice(0, 3).map(x => x.name).join(", ")}`);
    return parts.length ? parts.join("\n") : "(dünya notu yok)";
  })();

  const total    = scenes.length;
  const doneCnt  = scenes.filter(s => s.status === "done").length;
  const draftCnt = scenes.filter(s => s.status === "drafting" || s.status === "writing").length;

  const prompt = `
Sen deneyimli bir yazarlık koçusun.
Önünde ${total} sahneden oluşan, ${doneCnt} tanesi tamamlanmış, ${draftCnt} tanesi yazılıyor bir hikâye var.

─── PERDE YAPISI VE SAHNELER ─────────────────────
${byAct}

─── KARAKTERLER ──────────────────────────────────
${charText}

─── DÜNYA ────────────────────────────────────────
${worldText}
──────────────────────────────────────────────────

Yazara doğrudan, samimi ve yapıcı bir koç olarak yorum yap.
"Bu hikâyende" diye hitap et.

SADECE şu JSON:
{
  "momentum":  "Dramatik ivme yorumu (2-4 cümle)",
  "arcs":      "Karakter dönüşüm yorumu (2-4 cümle)",
  "rhythm":    "Tempo/ritim yorumu (2-4 cümle)",
  "direction": "Hikâye nereye gidiyor (2-4 cümle)",
  "next":      "Yazarın şimdi yapması gereken tek somut şey (2-3 cümle)",
  "watchOut":  "En büyük dramatik risk (1-2 cümle)",
  "keyScene":  "Şu an en kritik sahnenin adı ve neden kritik (1-2 cümle)"
}
`.trim();

  try {
    const raw    = await callGemini(PLOTWORLD_SYSTEM, prompt);
    const parsed = parseJSON(raw);
    res.json({
      momentum:  parsed.momentum  || "",
      arcs:      parsed.arcs      || "",
      rhythm:    parsed.rhythm    || "",
      direction: parsed.direction || "",
      next:      parsed.next      || "",
      watchOut:  parsed.watchOut  || "",
      keyScene:  parsed.keyScene  || "",
    });
  } catch (e) {
    console.error("[AI/plotworld/story-coach]", e?.message);
    res.status(500).json({ message: "Hikâye koçu analizi yapılamadı." });
  }
});

/* ── YENİ: arc-analysis ── */
router.post("/plotworld/arc-analysis", ensureAuth, async (req, res) => {
  const {
    character    = {},
    scenes       = [],
    actOrder     = [],
    allActLabels = {},
  } = req.body || {};

  if (!character.name?.trim())
    return res.status(400).json({ message: "character.name gerekli" });
  if (!scenes.length)
    return res.status(400).json({ message: "scenes gerekli" });

  const sceneText = scenes
    .map(s =>
      `[ID: ${s.id}] "${s.title}" — ${allActLabels[s.act] || s.act}` +
      `${s.goal        ? `\n  hedef: ${s.goal}`                     : ""}` +
      `${s.description ? `\n  özet: ${s.description.slice(0, 200)}` : ""}` +
      `\n  durum: ${s.status || "fikir"}`
    )
    .join("\n\n");

  const prompt = `
Sen bir yazarlık koçusun ve bu karakterin hikâyedeki yolculuğunu okuyorsun.

─── KARAKTER ─────────────────────────────────────
İsim: ${character.name}
Rol: ${character.role || "(belirtilmemiş)"}
Notlar: ${character.notes ? String(character.notes).slice(0, 400) : "(not yok)"}

─── KARAKTERIN SAHNELERİ ─────────────────────────
${sceneText}
──────────────────────────────────────────────────

GÖREV:
1. ARK ÖZETİ: Bu karakter nerede başlıyor, nerede bitiyor? Somut ol.
2. YARA SORUSU: Bu karakteri en derinden zorlayan, maskesini düşüren bir soru. Keskin, 1 cümle.
3. KIRILMA NOKTALARI: Hangi sahneler gerçek bir kırılma? Maks 3, ID ver.
4. ISI HARİTASI: Her sahne için duygusal etiket.
   Seçenekler: catisma, kayip, kazanim, kacis, yuzlesme, donum, kesfet, neutral
5. EKSİK MOMENT: Bu karakter hikâyede henüz ne yaşamadı? Somut, 1-2 cümle.

SADECE şu JSON:
{
  "arcSummary":      "Karakterin yolculuğunun dramatik özeti (2-3 cümle)",
  "woundQuestion":   "Karakteri en derinden zorlayan soru (1 cümle)",
  "breakpoints":     ["sahne_id_1", "sahne_id_2"],
  "heatMap":         { "sahne_id_1": "catisma", "sahne_id_2": "kayip" },
  "missingQuestion": "Bu karakter henüz X yaşamadı (1-2 cümle)"
}

Sadece verilen sahne ID'lerini kullan. ID uydurmak yasak.
`.trim();

  try {
    const raw    = await callGemini(PLOTWORLD_SYSTEM, prompt);
    const parsed = parseJSON(raw);

    const validIds    = new Set(scenes.map(s => s.id));
    const breakpoints = (parsed.breakpoints || []).filter(id => validIds.has(id));
    const heatMap     = Object.fromEntries(
      Object.entries(parsed.heatMap || {}).filter(([id]) => validIds.has(id))
    );

    res.json({
      arcSummary:      parsed.arcSummary      || "",
      woundQuestion:   parsed.woundQuestion   || "",
      breakpoints,
      heatMap,
      missingQuestion: parsed.missingQuestion || "",
    });
  } catch (e) {
    console.error("[AI/plotworld/arc-analysis]", e?.message);
    res.status(500).json({ message: "Karakter yolculuğu analizi yapılamadı." });
  }
});

router.post("/plotworld/scene-butterfly", ensureAuth, async (req, res) => {
  const { title, description, goal, act, draftText, characters = [] } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ message: "title gerekli" });

  const charList = characters.length
    ? characters.map(c => c.name || c).filter(Boolean).join(", ")
    : "(belirtilmemiş)";

  const draft = draftText ? `\nTaslak:\n${String(draftText).slice(0, 600)}` : "";

  const prompt = `
Sahne: "${title}"
Perde: ${act || "?"}
Hedef: ${goal || "(belirtilmemiş)"}
Açıklama: ${description || "(yok)"}
Karakterler: ${charList}${draft}

3 alternatif dal üret.

SADECE şu JSON:
{
  "branches": [
    {
      "title":          "Dalın adı (maks 6 kelime)",
      "consequence":    "Sonraki 2-3 sahnede ne olurdu? (1-2 cümle)",
      "emotionalShift": "Hikâyenin tonu nasıl değişirdi? (1 cümle)"
    }
  ]
}
`.trim();

  try {
    const raw    = await callGemini(PLOTWORLD_SYSTEM, prompt);
    const parsed = parseJSON(raw);
    res.json({ branches: (parsed.branches || []).slice(0, 3) });
  } catch (e) {
    console.error("[AI/plotworld/scene-butterfly]", e?.message);
    res.status(500).json({ message: "Kelebek analizi yapılamadı." });
  }
});

router.post("/plotworld/scene-analyze", ensureAuth, async (req, res) => {
  const { title, description, draftText, characters = [] } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ message: "title gerekli" });

  const charNotes = characters.length
    ? characters.map(c => `• ${c.name} (${c.role || "?"}): ${c.notes || "not yok"}`).join("\n")
    : "(karakter tanımı yok)";

  const draft = draftText ? `\nTaslak:\n${String(draftText).slice(0, 800)}` : "";

  const prompt = `
Sahne: "${title}"
Açıklama: ${description || "(yok)"}${draft}

Karakter tanımları:
${charNotes}

SADECE şu JSON:
{
  "consistency": "Tutarlılık değerlendirmesi (1-2 cümle)",
  "issues":      ["somut tutarsızlık 1", "tutarsızlık 2"],
  "strengths":   ["güçlü yan 1", "güçlü yan 2"],
  "suggestion":  "Yazara 1 cümlelik öneri"
}
`.trim();

  try {
    const raw    = await callGemini(PLOTWORLD_SYSTEM, prompt);
    const parsed = parseJSON(raw);
    res.json({
      consistency: parsed.consistency || "",
      issues:      parsed.issues      || [],
      strengths:   parsed.strengths   || [],
      suggestion:  parsed.suggestion  || "",
    });
  } catch (e) {
    console.error("[AI/plotworld/scene-analyze]", e?.message);
    res.status(500).json({ message: "Karakter analizi yapılamadı." });
  }
});

router.post("/plotworld/scene-strengthen", ensureAuth, async (req, res) => {
  const { title, description, draftText, goal } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ message: "title gerekli" });

  const draft = draftText ? `\nTaslak:\n${String(draftText).slice(0, 900)}` : "";

  const prompt = `
Sahne: "${title}"
Hedef: ${goal || "(belirtilmemiş)"}
Açıklama: ${description || "(yok)"}${draft}

Duygu, gerilim, diyalog ve tempo açısından 3 somut öneri ver.

SADECE şu JSON:
{
  "tips": [
    {
      "aspect":     "Duygu | Gerilim | Diyalog | Tempo | Atmosfer",
      "suggestion": "Somut, eyleme dönük öneri (1-2 cümle)"
    }
  ]
}
`.trim();

  try {
    const raw    = await callGemini(PLOTWORLD_SYSTEM, prompt);
    const parsed = parseJSON(raw);
    res.json({ tips: (parsed.tips || []).slice(0, 3) });
  } catch (e) {
    console.error("[AI/plotworld/scene-strengthen]", e?.message);
    res.status(500).json({ message: "Güçlendirme önerileri alınamadı." });
  }
});

router.post("/plotworld/scene-coach", ensureAuth, async (req, res) => {
  const {
    scene      = {},
    allScenes  = [],
    characters = [],
    actLabel   = "",
  } = req.body || {};

  if (!scene.title?.trim()) return res.status(400).json({ message: "scene.title gerekli" });

  const otherScenes = allScenes
    .filter(s => s.title !== scene.title)
    .slice(0, 12)
    .map(s => `• "${s.title}" (${s.act})${s.goal ? ` — ${s.goal}` : ""}`)
    .join("\n");

  const charContext = characters.length
    ? characters.map(c => `• ${c.name} (${c.role || "?"})${c.notes ? `: ${String(c.notes).slice(0, 120)}` : ""}`).join("\n")
    : "(karakter notu yok)";

  const draftContext = scene.draftText
    ? `\nTaslak:\n${String(scene.draftText).slice(0, 700)}`
    : "";

  const prompt = `
ODAK SAHNE:
"${scene.title}" — ${actLabel || scene.act || "?"}
Hedef: ${scene.goal || "(belirtilmemiş)"}
Açıklama: ${scene.description || "(yok)"}${draftContext}

DİĞER SAHNELER:
${otherScenes || "(başka sahne yok)"}

KARAKTERLERİN NOTLARI:
${charContext}

SADECE şu JSON:
{
  "role":       "Bu sahnenin dramatik rolü (2-3 cümle)",
  "tension":    "Gerilim/duygu analizi (2-3 cümle)",
  "characters": "Karakter dinamiği (2-3 cümle)",
  "after":      "Bu sahneden sonra ne beklenmeli (2-3 cümle)",
  "strengthen": "Sahneyi güçlendirecek tek öneri (1-2 cümle)"
}
`.trim();

  try {
    const raw    = await callGemini(PLOTWORLD_SYSTEM, prompt);
    const parsed = parseJSON(raw);
    res.json({
      role:       parsed.role       || "",
      tension:    parsed.tension    || "",
      characters: parsed.characters || "",
      after:      parsed.after      || "",
      strengthen: parsed.strengthen || "",
    });
  } catch (e) {
    console.error("[AI/plotworld/scene-coach]", e?.message);
    res.status(500).json({ message: "Sahne koçu analizi yapılamadı." });
  }
});

/* ══════════════════════════════════════════════
   HEALTH
══════════════════════════════════════════════ */
router.get("/health", async (_req, res) => {
  try {
    await callGemini("", "ping");
    res.json({ ok: true, model: GEMINI_MODEL() });
  } catch (e) {
    res.status(503).json({ ok: false, error: String(e?.message || e) });
  }
});

export async function initAI() {
  try {
    await callGemini("", "ping");
    console.log(`[AI] Gemini bağlantısı OK ✔ (model: ${GEMINI_MODEL()})`);
  } catch (e) {
    console.error("[AI] Gemini bağlantı hatası ❌", e?.message || e);
  }
}

export default router;