// src/hooks/useAICoach.js
import { useState, useEffect, useCallback, useRef } from "react";
import { apiPost, describeAiError } from "../lib/api";

/* ── Sabitler ── */
export const ATELIER_TABS = {
  ILHAM:  "ilham",
  SOHBET: "sohbet",
  YORUM:  "yorum",
  KOC:    "koc",
};

/* ── Debounce ── */
function useDebounce(value, delay) {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDeb(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return deb;
}

/* ── Prompt ── */
function buildSystemPrompt(style, tone) {
  const base =
    style === "harsh"
      ? "Kısa, net ve eleştirel yanıt ver. Kusurları açıkça söyle. Türkçe yaz."
      : style === "friendly"
      ? "Pozitif ve yapıcı bir dille yanıt ver. Kısa ve net ol. Türkçe yaz."
      : "Yazar koçu gibi davran; hem öv hem geliştir. Kısa ve net ol. Türkçe yaz.";
  return tone ? `${base} Ton tercihi: ${tone}.` : base;
}

/* ── API yardımcıları ── */
async function aiChatReq({ input, context }) {
  const data = await apiPost("/ai/chat", { input, context });
  return { reply: data.answer || "" };
}

async function aiReviewReq({ text, focus }) {
  const data = await apiPost("/ai/review", { text, focus });
  return {
    analysis:    data.analysis    || "",
    closingNote: data.closingNote || "",
    focus:       data.focus       || focus || "genel",
    focusLabel:  data.focusLabel  || "",
  };
}

/* ══════════════════════════════════════════════
   EDİTORYAL CORE
══════════════════════════════════════════════ */
const STOP_WORDS = new Set([
  "ve","veya","ama","fakat","lakin","ile","için","gibi","kadar","bir","şey","her",
  "şu","bu","o","de","da","ki","mi","mı","mu","mü","ben","sen","biz","siz","onlar"
]);

const BREATH_CONJ = new Set([
  "ve","ama","fakat","çünkü","ancak","oysa","halbuki","lakin","yani","diye","gibi","kadar"
]);

const PANIC_WORDS = new Set([
  "panik","panikle","panikledi","nefes","nefesnefese","nefes-nefese",
  "hızlıca","durmadan","koşarcasına","boğulur","boğuluyor"
]);

const EMOTION_WORDS = new Set([
  "mutlu","üzgün","korkmuş","heyecanlı","sinirli","tedirgin","kaygılı","huzursuz",
  "şaşkın","öfkeli","utangaç","yalnız","çaresiz","umutsuz","sevinçli","kırgın",
  "stresli","gergin","harika","muhteşem","rezalet","kötü","berbat","mükemmel","iğrenç"
]);

function tokenize(t) {
  return (t || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function lastN(arr, n) {
  return arr.length <= n ? arr : arr.slice(arr.length - n);
}

function splitSentencesWithTokens(text) {
  const parts = (text || "").split(/([.!?]+)/g);
  const sentences = [];
  let buf = "";
  for (let i = 0; i < parts.length; i++) {
    buf += parts[i];
    if (/[.!?]+/.test(parts[i]) || i === parts.length - 1) {
      const s = buf.trim();
      if (s) sentences.push(s);
      buf = "";
    }
  }
  return sentences.map(s => ({ s, words: tokenize(s) }));
}

function hasBreathMarks(sentenceStr, sentenceWords) {
  if (/[,;:]/.test(sentenceStr)) return true;
  return sentenceWords.some(w => BREATH_CONJ.has(w));
}

function emotionDensity(last200) {
  const total = last200.length || 1;
  const emotionCount = last200.filter(w => EMOTION_WORDS.has(w)).length;
  return { emotionCount, ratio: emotionCount / total };
}

function buildWordLocations(sentences) {
  const loc = new Map();
  sentences.forEach((obj, si) => {
    obj.words.forEach((w, wi) => {
      if (!w || w.length < 2 || STOP_WORDS.has(w)) return;
      const arr = loc.get(w) || [];
      arr.push({ si, wi });
      loc.set(w, arr);
    });
  });
  return loc;
}

/* ══════════════════════════════════════════════
   HOOK
══════════════════════════════════════════════ */
export function useAICoach() {
  const [title, setTitle]   = useState("");
  const [text, setText]     = useState("");
  const [tab, setTab]       = useState(ATELIER_TABS.ILHAM);
  const [loadingAI, setLoadingAI] = useState(false);
  const [msg, setMsg]       = useState("");

  const [tone, setTone]     = useState("");
  const [style, setStyle]   = useState("coach");

  const [chatInput, setChatInput] = useState("");
  const [chat, setChat]     = useState([]);
  const [review, setReview] = useState(null);
  const [reviewFocus, setReviewFocus] = useState("genel");

  const [liveAlert, setLiveAlert]     = useState(null);
  const [coachNotes, setCoachNotes]   = useState([]);

  // ← YENİ: koç modu toggle
  const [coachEnabled, setCoachEnabled] = useState(true);

  const lastInputAtRef    = useRef(Date.now());
  const lastWcAtInputRef  = useRef(0);
  const bubbleCooldownRef = useRef({ t: 0, key: "" });
  const noteCooldownRef   = useRef(new Map());

  const alertText = useDebounce(text, 1500);

  /* ── Handlers ── */
  const sendChat = useCallback(async () => {
    const content = chatInput.trim();
    if (!content) return;
    setChat(c => [...c, { role: "user", content }]);
    setChatInput("");
    try {
      setLoadingAI(true);
      const system = buildSystemPrompt(style, tone);
      const { reply } = await aiChatReq({ input: content, context: system });
      setChat(c => [...c, { role: "assistant", content: reply }]);
      setTab(ATELIER_TABS.SOHBET);
    } catch (err) {
      console.error("Chat hatası:", err);
      setChat(c => [...c, { role: "assistant", content: "⚠️ Yanıt alınamadı." }]);
    } finally { setLoadingAI(false); }
  }, [chatInput, style, tone]);

  const handleReview = useCallback(async (focusArg) => {
    if (!text.trim()) {
      setMsg("⚠️ Yorum için metin gerekli.");
      setTimeout(() => setMsg(""), 1500);
      return;
    }
    const focus = typeof focusArg === "string" ? focusArg : reviewFocus;
    try {
      setLoadingAI(true);
      const data = await aiReviewReq({ text, focus });
      setReview(data);
      setTab(ATELIER_TABS.YORUM);
    } catch (err) {
      const { message } = describeAiError(err, { fallback: "Değerlendirme alınamadı." });
      setMsg(`⚠️ ${message}`);
      setTimeout(() => setMsg(""), 2500);
    } finally { setLoadingAI(false); }
  }, [text, reviewFocus]);

  /* ── Input metrics ── */
  useEffect(() => {
    lastInputAtRef.current   = Date.now();
    lastWcAtInputRef.current = tokenize(text).length;
  }, [text]);

  /* ── Emit policies ── */
  const emitBubble = useCallback((a) => {
    if (!coachEnabled) return;            // ← toggle kontrolü
    const now = Date.now();
    if (now - bubbleCooldownRef.current.t < 20000) return;
    if (bubbleCooldownRef.current.key === a.key && now - bubbleCooldownRef.current.t < 120000) return;
    bubbleCooldownRef.current = { t: now, key: a.key };
    setLiveAlert(a);
    setTimeout(() => setLiveAlert(null), 4000);
  }, [coachEnabled]);

  const upsertNote = useCallback((n) => {
    if (!coachEnabled) return;            // ← toggle kontrolü
    const now   = Date.now();
    const last  = noteCooldownRef.current.get(n.key) || 0;
    if (now - last < 300000) {
      setCoachNotes(prev => prev.map(x => x.key === n.key ? { ...x, count: (x.count || 1) + 1, ts: now } : x));
      return;
    }
    noteCooldownRef.current.set(n.key, now);
    setCoachNotes(prev => [{ ...n, ts: now, count: n.count || 1 }, ...prev].slice(0, 40));
  }, [coachEnabled]);

  /* ── Koç kapatılınca mevcut uyarıları temizle ── */
  useEffect(() => {
    if (!coachEnabled) {
      setLiveAlert(null);
    }
  }, [coachEnabled]);

  /* ══════════════════════════════════════════════
     RULE ENGINE
  ══════════════════════════════════════════════ */
  useEffect(() => {
    if (!coachEnabled) return;            // ← toggle kontrolü
    const t = (alertText || "").trim();
    if (t.length < 30) return;

    const sentences    = splitSentencesWithTokens(t);
    const allWords     = tokenize(t);
    const lastSentObj  = sentences[sentences.length - 1] || null;
    const last200      = lastN(allWords, 200);
    const last160      = lastN(allWords, 160);
    const panicContext = last200.some(w => PANIC_WORDS.has(w));

    // RULE 1: Nefessiz Cümle
    if (lastSentObj) {
      const wc      = lastSentObj.words.length;
      const breathOK = hasBreathMarks(lastSentObj.s, lastSentObj.words);
      if (wc > 20 && !breathOK && !panicContext) {
        emitBubble({
          id: "breathless_sentence", key: "breathless_sentence", severity: "high",
          message: "Bu cümle dik bir yokuş gibi; okuyucunun nefesi kesilebilir. Bir basamak (virgül) eklemeye ne dersin?",
          meta: { wc }
        });
        return;
      }
    }

    // RULE 2: Show, don't tell
    {
      const { emotionCount, ratio } = emotionDensity(last200);
      if (emotionCount >= 2 && ratio >= 0.02) {
        emitBubble({
          id: "show_dont_tell", key: "show_dont_tell", severity: "high",
          message: "Duyguları etiketliyorsun. Onları eyleme dök: sesi mi titriyor, yoksa yumruklarını mı sıkıyor?",
          meta: { emotionCount, ratio }
        });
      }
    }

    // RULE 3: Echo & Anafor
    if (last160.length >= 60 && sentences.length >= 2) {
      const loc = buildWordLocations(sentences);
      let top = null;
      for (const [w, arr] of loc.entries()) {
        if (arr.length < 5) continue;
        if (!top || arr.length > top.count) top = { w, arr, count: arr.length };
      }
      if (top) {
        const starts = top.arr.filter(p => p.wi <= 1).length;
        const anaphoraLikely = starts >= 2 && starts / top.count >= 0.5;
        if (anaphoraLikely && top.count >= 7) {
          upsertNote({
            id: "anaphora_fatigue", key: `anaphora_fatigue_${top.w}`, severity: "low",
            icon: "🎭", title: "Anafor yorgunluğu",
            message: `"${top.w}" ile cümle başlatmak güçlü bir teknik; ama çok sık kullanınca etkisi azalabilir.`,
            meta: { word: top.w, count: top.count, starts }
          });
        } else if (!anaphoraLikely) {
          upsertNote({
            id: "echo_repeat", key: `echo_${top.w}`,
            severity: top.count >= 7 ? "medium" : "low",
            icon: "🔄", title: "Yankı (Echo)",
            message: `"${top.w}" son bölümde fazlaca tekrarlanıyor. Birini sil ya da zamirle değiştir.`,
            meta: { word: top.w, count: top.count }
          });
        }
      }
    }
  }, [alertText, emitBubble, upsertNote, coachEnabled]);

  /* ── Idle phases ── */
  useEffect(() => {
    if (!coachEnabled) return;            // ← toggle kontrolü
    const tick = setInterval(() => {
      const now    = Date.now();
      const idleMs = now - lastInputAtRef.current;
      if (text.trim().length === 0) return;
      const wcNow = tokenize(text).length;
      if (wcNow > lastWcAtInputRef.current + 1) return;

      if (idleMs >= 120000) {
        emitBubble({ id: "idle_120", key: "idle_120", severity: "high",
          message: "Odak dağılmış gibi. 2 dakikalık ısınma egzersiziyle motoru çalıştıralım mı?",
          meta: { idleMs } });
        return;
      }
      if (idleMs >= 90000) {
        upsertNote({ id: "idle_90", key: "idle_90", severity: "medium",
          icon: "🧩", title: "Küçük adım",
          message: "Karakterin elinde ne tutuyor? Sadece bu detayı yaz.",
          meta: { idleMs, highlight: true } });
        return;
      }
      if (idleMs >= 60000) {
        upsertNote({ id: "idle_60", key: "idle_60", severity: "low",
          icon: "🧠", title: "Zihin nefesi",
          message: "Bir sonraki sahneyi hayal et; sonra tek bir cümle yaz.",
          meta: { idleMs } });
      }
    }, 2500);
    return () => clearInterval(tick);
  }, [text, emitBubble, upsertNote, coachEnabled]);

  /* ── chat scroll ── */
  const chatBoxRef = useRef(null);
  useEffect(() => {
    if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
  }, [chat]);

  return {
    title, setTitle,
    text, setText,
    msg, setMsg,
    tab, setTab,
    loadingAI,
    tone, setTone,
    style, setStyle,
    chatInput, setChatInput,
    chat, sendChat,
    review, handleReview,
    reviewFocus, setReviewFocus,
    liveAlert,
    coachNotes, setCoachNotes,
    chatBoxRef,
    coachEnabled, setCoachEnabled,   // ← dışa aç
    setEditorFocus: () => {},         // geriye dönük uyumluluk
  };
}