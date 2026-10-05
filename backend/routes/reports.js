// backend/routes/reports.js
import { Router } from "express";
import mongoose   from "mongoose";
import Report     from "../models/Report.js";
import Work from "../models/Work.js";
import Chapter from "../models/Chapter.js";
import { sendStaffMail, sendAdminMail, SITE_URL } from "../services/emailService.js";

import { captureEvidence, publicReport, textField, transition } from '../services/reportWorkflow.js';
import { fileContentReport, imageKinds } from "../services/contentModeration.js";
const router = Router();
router.use((req, res, next) => req.user ? next() : res.status(401).json({ message: 'Giriş gerekli.' }));

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
    // Resolve ownership from the database, never from the client payload.
    if (["work", "chapter", "cover"].includes(targetType) && isValidId(targetId)) {
      const chapter = targetType === "chapter" ? await Chapter.findById(targetId).select("work").lean() : null;
      const work = await Work.findById(targetType === "chapter" ? chapter?.work : targetId).select("user").lean();
      if (work?.user && String(work.user) === String(req.user.id)) {
        return res.status(400).json({ message: "Kendi eserinizi şikâyet edemezsiniz." });
      }
    }
    if (imageKinds.includes(targetType) || (targetType === "chapter" && reason !== "telif_ihlali")) {
      const report = await fileContentReport(req.user, req.body);
      return res.status(201).json({ message: "Şikâyetiniz insan incelemesine alındı.", sikayet: { id: report._id, contentCase: report.contentCase } });
    }

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

    const copyright = reason === 'telif_ihlali';
    const extra = copyright ? { originalWork: textField(req.body.originalWork), description: textField(description, 500), stage: 'received', ...await captureEvidence(targetType, targetId) } : {};
    const sikayet = await Report.create({
      reporter:    req.user.id,
      targetType,
      targetId,
      reason,
      description: description?.trim() || "",
      ...extra,
    });

    // Acil sebepler → kırmızı mail, diğerleri → turuncu
    const isUrgent = ["taciz", "nefret_soylemi", "uygunsuz_icerik"].includes(reason);

    try {
      await (copyright ? sendAdminMail : sendStaffMail)({
        subject:  `Yeni Şikayet: ${SEBEP_ETIKETLERI[reason]} — ${TARGET_LABELS[targetType] || targetType}`,
        urgency:  isUrgent ? "high" : "medium",
        html: `
          <h3>Yeni Şikayet Bildirimi</h3>
          <table style="border-collapse:collapse;width:100%">
            <tr><td style="padding:6px;font-weight:bold">Şikayet Eden</td><td>${req.user.id}</td></tr>
            <tr><td style="padding:6px;font-weight:bold">Hedef Tür</td><td>${TARGET_LABELS[targetType] || targetType}</td></tr>
            <tr><td style="padding:6px;font-weight:bold">Hedef ID</td><td>${targetId}</td></tr>
            <tr><td style="padding:6px;font-weight:bold">Sebep</td><td>${SEBEP_ETIKETLERI[reason]}</td></tr>
            <tr><td style="padding:6px;font-weight:bold">Açıklama</td><td>${String(description || "—").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</td></tr>
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
      sikayet: { id: sikayet._id, number: String(sikayet._id), status: sikayet.status, stage: sikayet.stage || "received" },
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
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
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const sikayetler = await Report.find({ reporter: req.user.id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * 50)
      .limit(50)
      .lean();

    return res.json({ sikayetler: sikayetler.map(r => publicReport(r, req.user.id)) });
  } catch (err) {
    console.error("GET /reports/mine hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.get('/decisions', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const rows = await Report.find({ targetOwner: req.user.id, 'decisions.0': { $exists: true } }).sort({ updatedAt: -1 }).skip((page - 1) * 50).limit(50).lean();
    res.json({ sikayetler: rows.map(r => publicReport(r, req.user.id)) });
  } catch { res.status(500).json({ message: 'Sunucu hatası.' }); }
});
router.get('/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Geçersiz ID.' });
    const r = await Report.findById(req.params.id).lean();
    if (!r) return res.status(404).json({ message: 'Başvuru bulunamadı.' });
    res.json({ report: publicReport(r, req.user.id) });
  } catch (e) { res.status(e.status || 500).json({ message: e.status ? e.message : 'Sunucu hatası.' }); }
});
router.post('/:id/:operation', async (req, res) => {
  try {
    if (!isValidId(req.params.id) || !['appeal', 'information'].includes(req.params.operation)) return res.status(400).json({ message: 'Geçersiz işlem.' });
    const r = await Report.findById(req.params.id).lean();
    if (!r || r.reason !== 'telif_ihlali') return res.status(404).json({ message: 'Telif başvurusu bulunamadı.' });
    publicReport(r, req.user.id);
    const result = await transition(r, req.user, req.params.operation, req.body);
    res.json({ report: publicReport(result, req.user.id) });
  } catch (e) { res.status(e.status || 500).json({ message: e.status ? e.message : 'Sunucu hatası.' }); }
});
export default router;
