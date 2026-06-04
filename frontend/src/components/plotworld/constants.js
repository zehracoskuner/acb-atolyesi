// components/plotworld/constants.js

export const BADGE_STYLES = {
  acilis:    { bg: "#fef9e7", text: "#92620a", label: "Açılış"     },
  act1:      { bg: "#eef2ff", text: "#3730a3", label: "Giriş"      },
  act2:      { bg: "#eef2ff", text: "#3730a3", label: "Gelişme"    },
  donum:     { bg: "#f0fdf4", text: "#166534", label: "Dönüm"      },
  catisma:   { bg: "#fdf2f8", text: "#9d174d", label: "Çatışma"    },
  twist:     { bg: "#fff7ed", text: "#9a3412", label: "Twist"      },
  kapanis:   { bg: "#f8fafc", text: "#334155", label: "Kapanış"    },
  flashback: { bg: "#fdf4ff", text: "#7e22ce", label: "Geri Dönüş" },
  // Alternatif dal — sarı
  alternative: { bg: "#fefce8", text: "#854d0e", label: "Alternatif Dal" },
};

/* ── Hacim etiketleri ── */
export const VOLUME_META = {
  short:  { label: "Kısa",  pages: "1–3 sayfa",  estimate: 2,  color: "#94a3b8" },
  medium: { label: "Orta",  pages: "4–8 sayfa",  estimate: 6,  color: "#6366f1" },
  long:   { label: "Uzun",  pages: "9+ sayfa",   estimate: 12, color: "#8b5cf6" },
};

export const STATUS_META = {
  idea:     { label: "Fikir",      color: "#94a3b8" },
  drafting: { label: "Taslak",     color: "#f59e0b" },
  writing:  { label: "Yazılıyor",  color: "#6366f1" },
  done:     { label: "Tamam",      color: "#10b981" },
};

export const CHAR_PALETTE = [
  "#6d28d9", "#0891b2", "#b45309", "#be123c",
  "#065f46", "#1e40af", "#7c3aed", "#c2410c",
];

export const ACT_ZONE_WIDTH  = 260;
export const ACT_ZONE_HEIGHT = 1400;
export const ACT_ZONE_COL_W  = 300;

/* ═══════════════════════════════════════════════════════════
   YAPI ŞABLONLARI
═══════════════════════════════════════════════════════════ */
export const STRUCTURE_TEMPLATES = {
  "klasik": {
    id:          "klasik",
    label:       "Klasik (3 Perde)",
    description: "Giriş · Gelişme · Sonuç. Çoğu roman için ideal.",
    acts: [
      { id: "giris",   label: "Giriş",   color: "#6d28d9", roman: "I"   },
      { id: "gelisme", label: "Gelişme", color: "#0891b2", roman: "II"  },
      { id: "sonuc",   label: "Sonuç",   color: "#b45309", roman: "III" },
    ],
  },
  "epik": {
    id:          "epik",
    label:       "Epik (5 Aşama)",
    description: "Kahramanın yolculuğu. Fantezi ve macera için.",
    acts: [
      { id: "dunya",   label: "Sıradan Dünya",  color: "#6d28d9", roman: "I"  },
      { id: "cagri",   label: "Çağrı & Sınav",  color: "#0891b2", roman: "II" },
      { id: "donusum", label: "Dönüşüm",         color: "#0e7490", roman: "III"},
      { id: "donum",   label: "Kritik Dönüm",    color: "#b45309", roman: "IV" },
      { id: "donus",   label: "Dönüş",           color: "#7c3aed", roman: "V"  },
    ],
  },
  "serbest": {
    id:          "serbest",
    label:       "Serbest",
    description: "Kendi perde yapını oluştur, istediğin kadar perde ekle.",
    acts: [
      { id: "perde1", label: "I. Perde", color: "#6d28d9", roman: "I"  },
      { id: "perde2", label: "II. Perde", color: "#0891b2", roman: "II" },
    ],
  },
};

export const DEFAULT_TEMPLATE = "klasik";

/* ── Dinamik actMeta objesi oluştur ── */
export function buildActMeta(acts = []) {
  return Object.fromEntries(
    acts.map(a => [a.id, { label: a.label, color: a.color, roman: a.roman }])
  );
}

/* ── Dinamik actOrder dizisi ── */
export function buildActOrder(acts = []) {
  return acts.map(a => a.id);
}

/* ── Toplam tahmini sayfa sayısı ── */
export function calcTotalPages(nodes) {
  return nodes.reduce((sum, n) => {
    const vol = VOLUME_META[n.data?.volume];
    return sum + (vol?.estimate || 0);
  }, 0);
}

// constants.js dosyasının EN ALTINA ekle

export const EDGE_TYPES = {
  karar:      { label: "Karar",      color: "#6d28d9", dash: false, icon: "◈" },
  sonuc:      { label: "Sonuç",      color: "#0891b2", dash: false, icon: "→" },
  kacis:      { label: "Kaçış",      color: "#b45309", dash: true,  icon: "⤷" },
  yuzlesme:   { label: "Yüzleşme",   color: "#be123c", dash: false, icon: "⚡" },
  kesif:      { label: "Keşif",      color: "#065f46", dash: false, icon: "◎" },
  zorunluluk: { label: "Zorunluluk", color: "#7c3aed", dash: true,  icon: "⬡" },
};

export const DEFAULT_EDGE_TYPE = "sonuc";