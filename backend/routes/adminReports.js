import { Router } from "express";
import mongoose   from "mongoose";
import Report     from "../models/Report.js";
import Comment    from "../models/Comment.js";
import User       from "../models/User.js";
import { notifyWarning, notifyCommentRemoved } from "../services/notificationService.js";

const router = Router();
function isValidId(id) { return mongoose.Types.ObjectId.isValid(id); }
function getPageQuery(req) {
  return Math.max(1, parseInt(req.query.sayfa ?? req.query.page, 10) || 1);
}

/* ─────────────────────────────────────────────────────────────
   targetObj populate — targetType'a göre ilgili dökümanı doldur
───────────────────────────────────────────────────────────── */
async function populateTarget(report) {
  const r = { ...report };
  try {
    if (r.targetType === "comment") {
      // originalContent dahil — soft delete sonrası admin görebilmeli
      const comment = await Comment.findById(r.targetId)
        .select("content originalContent isDeleted deletedAt deletedBy deletedReason author work chapter")
        .populate("author",    "kullaniciAdi avatarUrl email")
        .populate("work",      "title _id")
        .populate("chapter",   "title order")
        .populate("deletedBy", "kullaniciAdi")
        .lean();
      r.targetObj = comment || null;

    } else if (r.targetType === "work") {
      const Work = (await import("../models/Work.js")).default;
      r.targetObj = await Work.findById(r.targetId)
        .select("title coverImage status")
        .populate("user", "kullaniciAdi email avatarUrl")
        .lean();

    } else if (r.targetType === "chapter") {
      const Chapter = (await import("../models/Chapter.js")).default;
      r.targetObj = await Chapter.findById(r.targetId)
        .select("title order")
        .populate({ path: "work", select: "title _id", populate: { path: "user", select: "kullaniciAdi email" } })
        .lean();

    } else if (r.targetType === "user") {
      r.targetObj = await User.findById(r.targetId)
        .select("kullaniciAdi email avatarUrl role commentBanned contentBanned")
        .lean();
    }
  } catch {
    r.targetObj = null;
  }
  return r;
}

/* ─────────────────────────────────────────────────────────────
   GET /api/admin/reports
───────────────────────────────────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const sayfa      = getPageQuery(req);
    const limit      = Math.min(50, parseInt(req.query.limit, 10) || 15);
    const status     = req.query.status     || "pending";
    const targetType = req.query.targetType || "all";
    const isModerator = req.user.role === "moderator";

    const filtre = {};
    if (status !== "all")     filtre.status     = status;
    if (targetType !== "all") filtre.targetType = targetType;
    if (isModerator)          filtre.targetType = "comment"; // moderatör sadece yorum şikayeti

    const [raporlar, toplam] = await Promise.all([
      Report.find(filtre)
        .sort({ createdAt: -1 })
        .skip((sayfa - 1) * limit)
        .limit(limit)
        .populate("reporter",   "kullaniciAdi email avatarUrl")
        .populate("resolvedBy", "kullaniciAdi")
        .lean(),
      Report.countDocuments(filtre),
    ]);

    const sikayetler = await Promise.all(raporlar.map(populateTarget));

    return res.json({
      sikayetler,
      meta: { toplam, sayfa, limit, toplamSayfa: Math.ceil(toplam / limit) },
    });
  } catch (err) {
    console.error("GET /admin/reports:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ─────────────────────────────────────────────────────────────
   PUT /api/admin/reports/:id/resolve
   PUT /api/admin/reports/:id/dismiss
───────────────────────────────────────────────────────────── */
router.put("/:id/resolve", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Geçersiz ID." });
    const rapor = await Report.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "resolved", resolvedBy: req.user.id, resolvedAt: new Date() } },
      { new: true }
    );
    if (!rapor) return res.status(404).json({ message: "Şikayet bulunamadı." });
    return res.json({ message: "Şikayet çözüldü.", rapor });
  } catch (err) {
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

router.put("/:id/dismiss", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Geçersiz ID." });
    const rapor = await Report.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "dismissed", resolvedBy: req.user.id, resolvedAt: new Date() } },
      { new: true }
    );
    if (!rapor) return res.status(404).json({ message: "Şikayet bulunamadı." });
    return res.json({ message: "Şikayet geçersiz sayıldı.", rapor });
  } catch (err) {
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ─────────────────────────────────────────────────────────────
   DELETE /api/admin/reports/:id/comment
   Şikayet edilen yorumu SOFT DELETE yap + şikayeti kapat
   Admin ve moderatör kullanabilir
───────────────────────────────────────────────────────────── */
router.delete("/:id/comment", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Geçersiz ID." });

    const rapor = await Report.findById(req.params.id);
    if (!rapor) return res.status(404).json({ message: "Şikayet bulunamadı." });
    if (rapor.targetType !== "comment")
      return res.status(400).json({ message: "Bu şikayet bir yorum şikayeti değil." });

    const comment = await Comment.findById(rapor.targetId);
    if (comment && !comment.isDeleted) {
      comment.isDeleted       = true;
      comment.deletedAt       = new Date();
      comment.deletedBy       = req.user.id;
      comment.deletedReason   = req.body.reason?.trim() || "Şikayet sonucu kaldırıldı";
      comment.originalContent = comment.content;  // saklıyoruz
      comment.content         = "";
      await comment.save();
      notifyCommentRemoved({ recipientId: comment.author, workId: comment.work })
        .catch((e) => console.error("notifyCommentRemoved:", e.message));
    }

    // Bu şikayeti ve aynı yoruma gelen diğer bekleyenleri kapat
    await Report.updateMany(
      { targetType: "comment", targetId: rapor.targetId, status: "pending" },
      { $set: { status: "resolved", resolvedBy: req.user.id, resolvedAt: new Date(), adminNote: "Yorum moderatör kararıyla kaldırıldı." } }
    );

    return res.json({ message: "Yorum kaldırıldı, ilgili şikayetler kapatıldı." });
  } catch (err) {
    console.error("DELETE comment:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ─────────────────────────────────────────────────────────────
   POST /api/admin/reports/:id/warn
   Kullanıcıya uyarı gönder (sadece admin)
   Body: { message: "Uyarı metni" }
───────────────────────────────────────────────────────────── */
router.post("/:id/warn", async (req, res) => {
  try {
    if (req.user.role !== "admin")
      return res.status(403).json({ message: "Sadece admin uyarı verebilir." });
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz ID." });

    const rapor = await Report.findById(req.params.id).lean();
    if (!rapor) return res.status(404).json({ message: "Şikayet bulunamadı." });

    // Şikayet edilen içeriğin sahibini bul
    // Şikayet edilen içeriğin sahibini + bağlamını bul
    let targetUserId = null;
    let context      = "davranışınız";   // user fallback
    let workId       = null;

    if (rapor.targetType === "comment") {
      const comment = await Comment.findById(rapor.targetId)
        .select("author content originalContent work").lean();
      targetUserId = comment?.author;
      workId       = comment?.work || null;
      const raw = (comment?.content || comment?.originalContent || "").trim();
      context = raw
        ? `yorumunuz ("${raw.slice(0, 60)}${raw.length > 60 ? "…" : ""}")`
        : "yorumunuz";
    } else if (rapor.targetType === "work") {
      const Work = (await import("../models/Work.js")).default;
      const work = await Work.findById(rapor.targetId).select("user title").lean();
      targetUserId = work?.user;
      workId       = rapor.targetId;
      context = work?.title ? `"${work.title}" adlı eseriniz` : "bir eseriniz";
    } else if (rapor.targetType === "chapter") {
      const Chapter = (await import("../models/Chapter.js")).default;
      const chapter = await Chapter.findById(rapor.targetId).select("title work").lean();
      workId  = chapter?.work || null;
      context = chapter?.title ? `"${chapter.title}" adlı bölümünüz` : "bir bölümünüz";
      if (chapter?.work) {
        const Work = (await import("../models/Work.js")).default;
        const work = await Work.findById(chapter.work).select("user").lean();
        targetUserId = work?.user;
      }
    } else if (rapor.targetType === "user") {
      targetUserId = rapor.targetId;
      context = "davranışınız";
    }

    if (!targetUserId)
      return res.status(404).json({ message: "Uyarılacak kullanıcı bulunamadı." });

    const warnMessage = req.body.message?.trim() || "İçeriğiniz topluluk kurallarımıza aykırı bulundu.";

    // 1) Audit kaydı — User.warnings (alanın şemada olması şart)
    await User.findByIdAndUpdate(targetUserId, {
      $push: {
        warnings: { message: warnMessage, issuedBy: req.user.id, issuedAt: new Date(), reportId: rapor._id },
      },
    });

    // 2) Kullanıcıya bildirim — merkezi servis üzerinden
    await notifyWarning({ recipientId: targetUserId, message: warnMessage, context, workId })
      .catch((e) => console.error("notifyWarning:", e.message));

    // 3) Raporu kapat
    await Report.findByIdAndUpdate(req.params.id, {
      $set: { status: "resolved", resolvedBy: req.user.id, resolvedAt: new Date(), adminNote: `Uyarı verildi: ${warnMessage}` },
    });

    return res.json({ message: "Uyarı gönderildi, şikayet kapatıldı." });
  } catch (err) {
    console.error("warn:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

export default router;
