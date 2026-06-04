// backend/utils/aiModerator.js
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { sendMail } from "../services/emailService.js";

const MODERATION_KEY = process.env.GEMINI_MODERATION_KEY || process.env.GEMINI_API_KEY;
const genAI          = new GoogleGenerativeAI(MODERATION_KEY);
const MODEL          = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const MIN_INTERVAL   = parseInt(process.env.GEMINI_MIN_INTERVAL_MS) || 3500;
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;

/* ── Mail spam koruması ── */
let lastAdminNotification = 0;
const ADMIN_NOTIFY_COOLDOWN = 15 * 60 * 1000;

/* ── Async queue ── */
let queue = Promise.resolve();
let queueLength = 0;
const MAX_QUEUE_LENGTH = 15;

function enqueue(fn) {
  if (queueLength >= MAX_QUEUE_LENGTH) {
    console.warn("[aiModerator] Kuyruk dolu, istek bypass ediliyor.");
    return Promise.resolve({ severity: "clean", violations: [], reason: null });
  }
  queueLength++;
  const result = queue.then(() => fn());
  queue = result.finally(() => {
    queueLength--;
    return new Promise((r) => setTimeout(r, MIN_INTERVAL));
  });
  return result;
}

/* ── Admin hata maili ── */
async function notifyAdminError(context, detail) {
  if (!ADMIN_EMAIL) return;
  const now = Date.now();
  if (now - lastAdminNotification < ADMIN_NOTIFY_COOLDOWN) return;
  try {
    lastAdminNotification = now;
    await sendMail({
      to:      ADMIN_EMAIL,
      subject: `⚠️ Moderasyon API Hatası — ${context}`,
      html: `
        <p><strong>Moderasyon servisi yanıt vermedi.</strong></p>
        <p>İçerik kontrolsüz yayınlandı. Arka arkaya hatalar 15 dk susturulur.</p>
        <p><strong>Bağlam:</strong> ${context}</p>
        <p><strong>Hata:</strong> ${detail}</p>
        <p><small>${new Date().toISOString()}</small></p>
      `,
    });
  } catch (err) {
    console.error("[aiModerator] Admin maili gönderilemedi:", err.message);
  }
}

/* ── Structured output config ── */
const generationConfig = {
  responseMimeType: "application/json",
  responseSchema: {
    type: SchemaType.OBJECT,
    properties: {
      severity: {
        type: SchemaType.STRING,
        description: "clean | review | reject",
      },
      violations: {
        type:  SchemaType.ARRAY,
        items: { type: SchemaType.STRING },
      },
      reason: {
        type:     SchemaType.STRING,
        nullable: true,
      },
    },
    required: ["severity", "violations", "reason"],
  },
};

/* ══════════════════════════════════════════════
   BÖLÜM İÇERİK KONTROLÜ
   → { severity: "clean"|"review"|"reject", violations: string[], reason: string|null }
══════════════════════════════════════════════ */
export async function moderateChapter(title, content) {
  if (!content?.trim()) return { severity: "clean", violations: [], reason: null };

  return enqueue(async () => {
    try {
      const model = genAI.getGenerativeModel({ model: MODEL, generationConfig });

      const excerpt = content.length > 8000
        ? `${content.slice(0, 4000)}\n\n...[ORTA KISIM KESİLDİ]...\n\n${content.slice(-4000)}`
        : content;

      const prompt = `Sen özgürlükçü bir yaratıcı yazarlık platformu için içerik güvenliği asistanısın.

Platform; grimdark, korku, distopya, psikolojik gerilim, suç, savaş, trajedi,
romantizm ve karanlık anlatılar barındırır. Bu türler tamamen meşrudur.

TEMEL PRENSİP:
Görevin ahlaki denetim değil, yalnızca platformu yasal riske sokacak
içerikleri tespit etmektir. Kurgusal içeriklerde yazarın sesi ile
karakterin sesi birbirinden ayrıdır.

VARSAYILAN KARAR "clean"dir.
Aşağıdaki kategorilere girip girmediğinden emin değilsen "clean" seç.

────────────────────────────────────────────────────────
ŞİDDET
────────────────────────────────────────────────────────
SERBEST:
Kan, bıçaklama, cinayet, işkence, savaş, ölüm, vahşet,
sadist karakter psikolojisi, grafik yaralanma sahneleri.
Bunlar edebiyatın ayrılmaz parçasıdır.

İHLAL (reject):
Gerçek hayatta uygulanabilir bomba, silah veya
kimyasal madde yapım talimatı içeren metin.

────────────────────────────────────────────────────────
CİNSELLİK
────────────────────────────────────────────────────────
SERBEST:
Erotik gerilim, romantik sahneler, cinsel birleşme tasvirleri,
müstehcen diyalog — bunların tümü kurgunun parçasıysa serbesttir.

İHLAL (reject):
Hiçbir hikayesel bağlamı olmayan, salt pornografik amaçlı,
uzun ve detaylı cinsel içerik.
NOT: Kısa cinsel sahneler veya erotik gerilim içeren metinler
bu kategoriye girmez.

────────────────────────────────────────────────────────
NEFRET SÖYLEMİ
────────────────────────────────────────────────────────
SERBEST:
Karakterlerin ırkçı, faşist veya psikopat olması,
kin dolu iç monologlar, karanlık ideolojilerin tasviri,
distopik evren düzenleri, tarihsel vahşetin anlatımı.

İHLAL (reject):
Yazar kurgudan çıkıp doğrudan gerçek bir kişiye veya
gruba gerçek hayatta zarar vermeyi açıkça çağırıyorsa.

────────────────────────────────────────────────────────
İNTİHAR / KENDİNE ZARAR VERME
────────────────────────────────────────────────────────
SERBEST:
Karakterlerin bunalımı, intiharı, kendine zarar vermesi,
trajik sonlar, umutsuzluk anlatımı.

İHLAL (reject):
Kurgu kılığından sıyrılıp okuyucuya doğrudan hitap ederek
intihar veya kendine zarar vermeyi açıkça yönlendiren metin.

────────────────────────────────────────────────────────
ÇOCUK İSTİSMARI
────────────────────────────────────────────────────────
SIFIR TOLERANS — her koşulda reject:
Reşit olmayanlara yönelik her türlü cinsel içerik veya tasvir.

────────────────────────────────────────────────────────
KARAR KADEMELERİ
────────────────────────────────────────────────────────
"clean"
→ Varsayılan karar budur.
→ Kurgusal bağlam varsa içindeki şiddet, cinsellik veya
  karanlık temalar ne kadar uçlarda olursa olsun "clean" seç.

"review"
→ Metnin gerçek bir tehdit, talimat veya manifesto mu yoksa
  kurgu mu olduğundan gerçekten emin olamadığında kullan.
→ Nadir kullanılmalıdır. Kurgu olduğuna dair en küçük bir
  işaret varsa "clean" seç.

"reject"
→ SADECE tartışmasız, edebi bağlamı olmayan, yasal suç teşkil
  eden açık ihlaller için kullan.
→ Şüphe durumunda asla "reject" seçme.

Bölüm Başlığı: ${title}
Bölüm İçeriği:
${excerpt}`;

      const result = await model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text());

      const severity = ["clean", "review", "reject"].includes(parsed.severity)
        ? parsed.severity
        : "review";

      return {
        severity,
        violations: parsed.violations || [],
        reason:     parsed.reason || null,
      };
    } catch (err) {
      console.error(`[aiModerator] moderateChapter hatası (${title}):`, err.message);
      await notifyAdminError(`Bölüm: "${title}"`, err.message);
      return { severity: "clean", violations: [], reason: null };
    }
  });
}

/* ══════════════════════════════════════════════
   KAPAK FOTOĞRAFI KONTROLÜ
   → { severity: "clean"|"review"|"reject", violations: string[], reason: string|null }
══════════════════════════════════════════════ */
export async function moderateCover(buffer, mimeType = "image/jpeg") {
  if (!buffer || buffer.length === 0) return { severity: "clean", violations: [], reason: null };

  if (buffer.length > 5 * 1024 * 1024) {
    console.warn("[aiModerator] Resim >5MB, moderasyon atlanıyor.");
    return { severity: "clean", violations: [], reason: null };
  }

  return enqueue(async () => {
    try {
      const model  = genAI.getGenerativeModel({ model: MODEL, generationConfig });
      const base64 = buffer.toString("base64");

      const prompt = `
Bu bir yaratıcı yazarlık platformu için kapak fotoğrafı.

severity değerleri:
"clean"  → Normal görsel. Portre, manzara, illüstrasyon, fantastik sahne, karanlık atmosfer.
"review" → Belirsiz, sınırda içerik. Emin değilsen bunu seç.
"reject" → SADECE: açık cinsel içerik/çıplaklık, grafik kan/şiddet, nefret sembolü (swastika vb.), çocuk istismarı.

Emin değilsen "review" seç, asla "reject" yapma.
`;

      const result = await model.generateContent([
        prompt,
        { inlineData: { mimeType, data: base64 } },
      ]);

      const parsed = JSON.parse(result.response.text());

      const severity = ["clean", "review", "reject"].includes(parsed.severity)
        ? parsed.severity
        : "review";

      return {
        severity,
        violations: parsed.violations || [],
        reason:     parsed.reason || null,
      };
    } catch (err) {
      console.error("[aiModerator] moderateCover hatası:", err.message);
      await notifyAdminError("Kapak fotoğrafı moderasyonu", err.message);
      return { severity: "clean", violations: [], reason: null };
    }
  });
}