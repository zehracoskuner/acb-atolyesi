// backend/routes/moderator.js
// server.js'e ekle:
//   import moderatorRouter from "./routes/moderator.js";
//   app.use("/api/moderator", ensureAuth, requireRole("admin", "moderator"), moderatorRouter);

import { Router }   from "express";
import mongoose     from "mongoose";
import Chapter      from "../models/Chapter.js";
import Comment      from "../models/Comment.js";
import Work         from "../models/Work.js";
import User         from "../models/User.js";
import Notification from "../models/Notification.js";
import { sendMail } from "../services/emailService.js";
import { notifyCommentRemoved } from "../services/notificationService.js";

const router = Router();

function isValidId(id) { return mongoose.Types.ObjectId.isValid(id); }

/* ══════════════════════════════════════════════
   1. KUYRUK İSTATİSTİKLERİ
   GET /api/moderator/stats
══════════════════════════════════════════════ */
router.get("/stats", async (req, res) => {
  try {
    const [bekleyenBolum, bekleyenYorum] = await Promise.all([
      Chapter.countDocuments({ status: "pending_review" }),
      Comment.countDocuments({ status: "pending_review" }),
    ]);

    return res.json({ bekleyenBolum, bekleyenYorum });
  } catch (err) {
    console.error("Moderatör /stats hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ══════════════════════════════════════════════
   2. BÖLÜM KUYRUĞU
   GET /api/moderator/chapters?sayfa=1&limit=15&neden=content_ban|ai_flag|all
══════════════════════════════════════════════ */
router.get("/chapters", async (req, res) => {
  try {
    const sayfa = Math.max(1, parseInt(req.query.sayfa) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 15);
    const neden = req.query.neden || "all"; // content_ban | ai_flag | all

    // reviewNote varsa AI flagledi, yoksa content_ban nedeniyle düştü
    const filtre = { status: "pending_review" };
    if (neden === "ai_flag")      filtre.reviewNote = { $ne: "" };
    if (neden === "content_ban")  filtre.reviewNote = "";

    const [bolumler, toplam] = await Promise.all([
      Chapter.find(filtre)
        .select("title content reviewNote status createdAt work")
        .populate({
          path:     "work",
          select:   "title user",
          populate: { path: "user", select: "kullaniciAdi email avatarUrl contentBanned" },
        })
        .sort({ createdAt: -1 })
        .skip((sayfa - 1) * limit)
        .limit(limit)
        .lean(),
      Chapter.countDocuments(filtre),
    ]);

    return res.json({
      bolumler,
      meta: { toplam, sayfa, limit, toplamSayfa: Math.ceil(toplam / limit) },
    });
  } catch (err) {
    console.error("Moderatör /chapters hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ──────────────────────────────────────────────
   Bölüm Onayla
   PUT /api/moderator/chapters/:id/approve
─────────────────────────────────────────────── */
router.put("/chapters/:id/approve", async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz bölüm ID." });

    const bolum = await Chapter.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status:     "published",
          reviewNote: "",
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
        },
      },
      { new: true }
    ).populate("work", "title user");

    if (!bolum) return res.status(404).json({ message: "Bölüm bulunamadı." });

    await Work.findByIdAndUpdate(bolum.work._id, {
      $addToSet: { publishedChapterIds: bolum._id },
    });
    await Work.findByIdAndUpdate(
      bolum.work._id,
      { $set: { status: "published" } },
      { runValidators: false }
    );

    try {
      await Notification.create({
        recipient: bolum.work.user,
        sender:    null,
        type:      "chapter_approved",
        work:      bolum.work._id,
        text:      `"${bolum.title}" bölümünüz onaylandı ve yayına alındı! ✓`,
        read:      false,
      });
    } catch (e) { console.error("Bildirim oluşturulamadı:", e.message); }

    try {
      const yazar = await User.findById(bolum.work.user).select("email kullaniciAdi").lean();
      if (yazar?.email) {
        await sendMail({
          to:      yazar.email,
          subject: `"${bolum.title}" bölümünüz onaylandı ✅`,
          html:    `<p>Merhaba ${yazar.kullaniciAdi || "yazar"},</p>
                    <p><strong>"${bolum.title}"</strong> bölümünüz incelendi ve yayına alındı.</p>
                    <p>ACB Atölyesi ekibi</p>`,
        });
      }
    } catch (e) { console.error("Onay maili gönderilemedi:", e.message); }

    return res.json({ message: "Bölüm onaylandı.", bolum });
  } catch (err) {
    console.error("Moderatör chapter approve hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ──────────────────────────────────────────────
   Bölüm Reddet
   PUT /api/moderator/chapters/:id/reject
   Body: { reviewNote: "Sebep..." }
─────────────────────────────────────────────── */
router.put("/chapters/:id/reject", async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz bölüm ID." });

    const { reviewNote } = req.body;
    if (!reviewNote?.trim())
      return res.status(400).json({ message: "Red sebebi zorunludur." });

    const bolum = await Chapter.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status:     "rejected",
          reviewNote: reviewNote.trim(),
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
        },
      },
      { new: true }
    ).populate("work", "title user");

    if (!bolum) return res.status(404).json({ message: "Bölüm bulunamadı." });

    await Work.findByIdAndUpdate(bolum.work._id, {
      $pull: { publishedChapterIds: bolum._id },
    });

    const work = await Work.findById(bolum.work._id).lean();
    if (work) {
      const newStatus = work.publishedChapterIds?.length > 0 ? "published" : "draft";
      if (work.status !== newStatus) {
        await Work.findByIdAndUpdate(
          bolum.work._id,
          { $set: { status: newStatus } },
          { runValidators: false }
        );
      }
    }

    try {
      await Notification.create({
        recipient: bolum.work.user,
        sender:    null,
        type:      "chapter_rejected",
        work:      bolum.work._id,
        text:      `"${bolum.title}" bölümünüz yayınlanamadı. Sebep: ${reviewNote}`,
        read:      false,
      });
    } catch (e) { console.error("Red bildirimi oluşturulamadı:", e.message); }

    try {
      const yazar = await User.findById(bolum.work.user).select("email kullaniciAdi").lean();
      if (yazar?.email) {
        await sendMail({
          to:      yazar.email,
          subject: `"${bolum.title}" bölümünüz reddedildi`,
          html:    `<p>Merhaba ${yazar.kullaniciAdi || "yazar"},</p>
                    <p><strong>"${bolum.title}"</strong> bölümünüz incelendi ancak yayınlanamaz.</p>
                    <p><strong>Sebep:</strong> ${reviewNote}</p>
                    <p>Bölümü düzenleyerek tekrar yayınlayabilirsiniz.</p>
                    <p>ACB Atölyesi ekibi</p>`,
        });
      }
    } catch (e) { console.error("Red maili gönderilemedi:", e.message); }

    return res.json({ message: "Bölüm reddedildi.", bolum });
  } catch (err) {
    console.error("Moderatör chapter reject hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ══════════════════════════════════════════════
   3. YORUM KUYRUĞU
   GET /api/moderator/comments?sayfa=1&limit=20
══════════════════════════════════════════════ */
router.get("/comments", async (req, res) => {
  try {
    const sayfa = Math.max(1, parseInt(req.query.sayfa) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);

    const [yorumlar, toplam] = await Promise.all([
      Comment.find({ status: "pending_review" })
        .populate("author", "kullaniciAdi email avatarUrl commentBanned")
        .populate("work", "title")
        .populate({
          path:   "chapter",
          select: "title work",
          populate: { path: "work", select: "title" },
        })
        .sort({ createdAt: -1 })
        .skip((sayfa - 1) * limit)
        .limit(limit)
        .lean(),
      Comment.countDocuments({ status: "pending_review" }),
    ]);

    return res.json({
      yorumlar,
      meta: { toplam, sayfa, limit, toplamSayfa: Math.ceil(toplam / limit) },
    });
  } catch (err) {
    console.error("Moderatör /comments hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ──────────────────────────────────────────────
   Yorum Onayla
   PUT /api/moderator/comments/:id/approve
─────────────────────────────────────────────── */
router.put("/comments/:id/approve", async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz yorum ID." });

    const yorum = await Comment.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status:     "published",
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
        },
      },
      { new: true }
    ).populate("author", "kullaniciAdi email");

    if (!yorum) return res.status(404).json({ message: "Yorum bulunamadı." });
    

    return res.json({ message: "Yorum yayına alındı.", yorum });
  } catch (err) {
    console.error("Moderatör comment approve hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ──────────────────────────────────────────────
   Yorum Reddet / Sil
   PUT /api/moderator/comments/:id/reject
   Body: { reason: "Sebep..." }
─────────────────────────────────────────────── */
router.put("/comments/:id/reject", async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz yorum ID." });

    const yorum = await Comment.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status:     "rejected",
          reviewNote: req.body.reason?.trim() || "",
          reviewedBy: req.user.id,
          reviewedAt: new Date(),
        },
      },
      { new: true }
    ).populate("author", "kullaniciAdi email");

    if (!yorum) return res.status(404).json({ message: "Yorum bulunamadı." });
    notifyCommentRemoved({ recipientId: yorum.author._id, workId: yorum.work })
  .catch((e) => console.error("notifyCommentRemoved:", e.message));

    return res.json({ message: "Yorum reddedildi.", yorum });
  } catch (err) {
    console.error("Moderatör comment reject hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ══════════════════════════════════════════════
   MODERATÖR SINIRI — BAN ATAMAZ
   Aşağıdaki işlemler sadece admin'e aittir,
   moderatör bu route'lara requireRole ile engellenir.
   Bu dosyada ban endpoint'i YOK.
══════════════════════════════════════════════ */

export default router;