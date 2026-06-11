// backend/routes/reports.js
import { Router } from "express";
import mongoose   from "mongoose";
import Report     from "../models/Report.js";
import { sendStaffMail, SITE_URL } from "../services/emailService.js";

const router = Router();

function isValidId(id) { return mongoose.Types.ObjectId.isValid(id); }

const SEBEP_ETIKETLERI = {
  spam:            "Spam",
  uygunsuz_icerik: "Uygunsuz İçerik",
  telif_ihlali:    "Telif İhlali",
  taciz:           "Taciz",
  nefret_soylemi:  "Nefret Söylemi",
  diger:           "Diğer",
};

const TARGET_LABELS = {
  work: "Eser", chapter: "Bölüm", user: "Kullanıcı", comment: "Yorum",
};

/* ─── Şikayet oluştur ─────────────────────────
   POST /api/reports
─────────────────────────────────────────────── */
router.post("/", async (req, res) => {
  try {
    const { targetType, targetId, reason, description } = req.body;

    const gecerliTargetler = ["work", "chapter", "user", "comment"];
    const gecerliSebepler  = ["spam", "uygunsuz_icerik", "telif_ihlali", "taciz", "nefret_soylemi", "diger"];

    if (!gecerliTargetler.includes(targetType))
      return res.status(400).json({ message: "Geçersiz hedef türü." });
    if (!isValidId(targetId))
      return res.status(400).json({ message: "Geçersiz hedef ID." });
    if (!gecerliSebepler.includes(reason))
      return res.status(400).json({ message: "Geçersiz şikayet sebebi." });
    if (targetType === "user" && targetId === req.user.id)
      return res.status(400).json({ message: "Kendinizi şikayet edemezsiniz." });

    const sikayet = await Report.create({
      reporter:    req.user.id,
      targetType,
      targetId,
      reason,
      description: description?.trim() || "",
    });

    // Acil sebepler → kırmızı mail, diğerleri → turuncu
    const isUrgent = ["taciz", "nefret_soylemi", "uygunsuz_icerik"].includes(reason);

    try {
      await sendStaffMail({
        subject:  `Yeni Şikayet: ${SEBEP_ETIKETLERI[reason]} — ${TARGET_LABELS[targetType] || targetType}`,
        urgency:  isUrgent ? "high" : "medium",
        html: `
          <h3>Yeni Şikayet Bildirimi</h3>
          <table style="border-collapse:collapse;width:100%">
            <tr><td style="padding:6px;font-weight:bold">Şikayet Eden</td><td>${req.user.id}</td></tr>
            <tr><td style="padding:6px;font-weight:bold">Hedef Tür</td><td>${TARGET_LABELS[targetType] || targetType}</td></tr>
            <tr><td style="padding:6px;font-weight:bold">Hedef ID</td><td>${targetId}</td></tr>
            <tr><td style="padding:6px;font-weight:bold">Sebep</td><td>${SEBEP_ETIKETLERI[reason]}</td></tr>
            <tr><td style="padding:6px;font-weight:bold">Açıklama</td><td>${description || "—"}</td></tr>
          </table>
          <br>
          <a href="${SITE_URL}/admin/reports"
             style="background:#e67e22;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px">
            Admin Panelde İncele
          </a>
        `,
      });
    } catch (mailErr) {
      console.error("Şikayet maili gönderilemedi:", mailErr.message);
    }

    return res.status(201).json({
      message: "Şikayetiniz alındı. En kısa sürede incelenecektir.",
      sikayet: { id: sikayet._id, status: sikayet.status },
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        message: "Bu içeriği daha önce şikayet ettiniz. Şikayetiniz inceleniyor.",
      });
    }
    console.error("POST /reports hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ─── Kullanıcının kendi şikayetleri ──────────
   GET /api/reports/mine
─────────────────────────────────────────────── */
router.get("/mine", async (req, res) => {
  try {
    const sikayetler = await Report.find({ reporter: req.user.id })
      .select("targetType targetId reason status createdAt")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json({ sikayetler });
  } catch (err) {
    console.error("GET /reports/mine hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

export default router;