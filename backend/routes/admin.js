import { chapterReview } from "../services/chapterReview.js";
import adminReportsRouter from "./adminReports.js";
// backend/routes/admin.js
// server.js'de: app.use("/api/admin", ensureAuth, requireRole("admin"), adminRouter);

import { Router }   from "express";
import mongoose     from "mongoose";
import User         from "../models/User.js";
import Work         from "../models/Work.js";
import Chapter      from "../models/Chapter.js";
import Report       from "../models/Report.js";
import Feedback from "../models/Feedback.js";
import { reportCategoryFilter } from '../services/reportCategories.js';
import { sendMail } from "../services/emailService.js";
import Notification from "../models/Notification.js";
import Comment      from "../models/Comment.js";

const router = Router();

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;

function getPageQuery(req) {
  return Math.max(1, parseInt(req.query.sayfa ?? req.query.page, 10) || 1);
}

/* ══════════════════════════════════════════════
   1. KULLANICI YÖNETİMİ
══════════════════════════════════════════════ */

// GET /api/admin/users?sayfa=1&limit=20&ara=zehra
router.get("/users", async (req, res) => {
  try {
    const sayfa = getPageQuery(req);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
    const ara   = req.query.ara?.trim();

    const filtre = ara
      ? { $or: [
          { kullaniciAdi: { $regex: ara, $options: "i" } },
          { email:        { $regex: ara, $options: "i" } },
        ]}
      : {};

    const [kullanicilar, toplam] = await Promise.all([
      User.find(filtre)
        .select("-sifreHash -password -emailVerifyToken -emailVerifyExpires -emailVerifyOtp -emailVerifyOtpExpires -passwordResetToken -passwordResetExpires -passwordResetOtp -passwordResetOtpExpires")
        .sort({ createdAt: -1 })
        .skip((sayfa - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filtre),
    ]);

    return res.json({
      kullanicilar,
      meta: { toplam, sayfa, limit, toplamSayfa: Math.ceil(toplam / limit) },
    });
  } catch (err) {
    console.error("Admin /users hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

// GET /api/admin/users/:id
router.get("/users/:id", async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz kullanıcı ID." });

    const kullanici = await User.findById(req.params.id)
      .select("-sifreHash -password -emailVerifyToken -emailVerifyExpires -emailVerifyOtp -emailVerifyOtpExpires -passwordResetToken -passwordResetExpires -passwordResetOtp -passwordResetOtpExpires")
      .lean();

    if (!kullanici)
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });

    return res.json({ kullanici });
  } catch (err) {
    console.error("Admin /users/:id hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz kullanıcı ID." });

    if (req.params.id === req.user.id)
      return res.status(400).json({ message: "Kendinizi silemezsiniz." });

    const kullanici = await User.findById(req.params.id);
    if (!kullanici)
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });

    await User.findByIdAndDelete(req.params.id);
    return res.json({ message: `${kullanici.kullaniciAdi || kullanici.email} silindi.` });
  } catch (err) {
    console.error("Admin DELETE /users/:id hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

// PATCH /api/admin/users/:id/rol
router.patch("/users/:id/rol", async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz kullanıcı ID." });

    if (req.params.id === req.user.id)
      return res.status(400).json({ message: "Kendi rolünüzü değiştiremezsiniz." });

    const { rol } = req.body;
    const gecerliRoller = ["user", "admin", "moderator","banned"];
    if (!gecerliRoller.includes(rol))
      return res.status(400).json({ message: `Geçersiz rol. Geçerli değerler: ${gecerliRoller.join(", ")}` });

    const kullanici = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { role: rol } },
      { new: true, runValidators: false }
    ).select("-sifreHash -password -emailVerifyToken -emailVerifyExpires -emailVerifyOtp -emailVerifyOtpExpires -passwordResetToken -passwordResetExpires -passwordResetOtp -passwordResetOtpExpires");

    if (!kullanici)
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });

    return res.json({
      message: `Rol güncellendi: ${kullanici.kullaniciAdi || kullanici.email} → ${rol}`,
      kullanici,
    });
  } catch (err) {
    console.error("Admin PATCH /users/:id/rol hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

// GET /api/admin/users/:id/ban-status
router.get("/users/:id/ban-status", async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz kullanıcı ID." });

    const userId = req.params.id;
    const userReports    = await Report.countDocuments({ targetType: "user",    targetId: userId });
    const workIds        = await Work.distinct("_id", { user: userId });
    const workReports    = await Report.countDocuments({ targetType: "work",    targetId: { $in: workIds } });
    const commentIds     = await Comment.distinct("_id", { author: userId });
    const commentReports = await Report.countDocuments({ targetType: "comment", targetId: { $in: commentIds } });

    const content = workReports + commentReports;
    return res.json({ sikayet: { toplam: userReports + content, user: userReports, content } });
  } catch (err) {
    console.error("Admin ban-status hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

// PATCH /api/admin/users/:id/ban
router.patch("/users/:id/ban", async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz kullanıcı ID." });
    if (req.params.id === req.user.id)
      return res.status(400).json({ message: "Kendinizi banlayamazsınız." });

    const { type, reason } = req.body;
    if (!["comment", "content", "full"].includes(type))
      return res.status(400).json({ message: "Geçersiz ban türü." });
    if (!reason?.trim())
      return res.status(400).json({ message: "Ban sebebi zorunludur." });

    const hedef = await User.findById(req.params.id);
    if (!hedef) return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    if (hedef.role === "admin")
      return res.status(400).json({ message: "Admin kullanıcısı banlanamaz." });

    const now = new Date();
    if (type === "comment") {
      hedef.commentBanned = true;
      hedef.banMeta.commentBannedAt  = now;
      hedef.banMeta.commentBannedBy  = req.user.id;
      hedef.banMeta.commentBanReason = reason.trim();
    } else if (type === "content") {
      hedef.contentBanned = true;
      hedef.banMeta.contentBannedAt  = now;
      hedef.banMeta.contentBannedBy  = req.user.id;
      hedef.banMeta.contentBanReason = reason.trim();
    } else {
      hedef.role = "banned";
      hedef.commentBanned = true;
      hedef.contentBanned = true;
      hedef.banMeta.fullBannedAt  = now;
      hedef.banMeta.fullBannedBy  = req.user.id;
      hedef.banMeta.fullBanReason = reason.trim();
    }
    hedef.markModified("banMeta");
    await hedef.save();

    const typeLabel = type === "comment" ? "Yorum Kısıtlaması" : type === "content" ? "İçerik Kısıtlaması" : "Tam Ban";
    try {
      await Notification.create({
        recipient: hedef._id, sender: null, type: "warning",
        text: `${typeLabel} uygulandı. Sebep: ${reason.trim()}`,
        read: false,
      });
    } catch (e) { console.error("Ban bildirimi oluşturulamadı:", e.message); }

    return res.json({ message: `${typeLabel} uygulandı.`, type });
  } catch (err) {
    console.error("Admin ban hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

// PATCH /api/admin/users/:id/unban
router.patch("/users/:id/unban", async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz kullanıcı ID." });

    const { type } = req.body;
    if (!["comment", "content", "full"].includes(type))
      return res.status(400).json({ message: "Geçersiz ban türü." });

    const hedef = await User.findById(req.params.id);
    if (!hedef) return res.status(404).json({ message: "Kullanıcı bulunamadı." });

    if (type === "comment") {
      hedef.commentBanned = false;
      hedef.banMeta.commentBannedAt  = null;
      hedef.banMeta.commentBannedBy  = null;
      hedef.banMeta.commentBanReason = "";
    } else if (type === "content") {
      hedef.contentBanned = false;
      hedef.banMeta.contentBannedAt  = null;
      hedef.banMeta.contentBannedBy  = null;
      hedef.banMeta.contentBanReason = "";
    } else {
      hedef.role = "user";
      hedef.commentBanned = false;
      hedef.contentBanned = false;
      hedef.banMeta.fullBannedAt     = null; hedef.banMeta.fullBannedBy     = null; hedef.banMeta.fullBanReason    = "";
      hedef.banMeta.commentBannedAt  = null; hedef.banMeta.commentBannedBy  = null; hedef.banMeta.commentBanReason = "";
      hedef.banMeta.contentBannedAt  = null; hedef.banMeta.contentBannedBy  = null; hedef.banMeta.contentBanReason = "";
    }
    hedef.markModified("banMeta");
    await hedef.save();

    const typeLabel = type === "comment" ? "Yorum Kısıtlaması" : type === "content" ? "İçerik Kısıtlaması" : "Tam Ban";
    return res.json({ message: `${typeLabel} kaldırıldı.`, type });
  } catch (err) {
    console.error("Admin unban hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ══════════════════════════════════════════════
   2. İÇERİK MODERASYONu
══════════════════════════════════════════════ */

// DELETE /api/admin/works/:id
router.delete("/works/:id", async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz eser ID." });

    const eser = await Work.findByIdAndDelete(req.params.id);
    if (!eser)
      return res.status(404).json({ message: "Eser bulunamadı." });

    await Chapter.deleteMany({ work: req.params.id });
    // Retain report evidence and appeal history when a work is removed.

    return res.json({ message: `"${eser.title || eser._id}" silindi.` });
  } catch (err) {
    console.error("Admin DELETE /works/:id hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

// DELETE /api/admin/chapters/:id
router.delete("/chapters/:id", async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz bölüm ID." });

    const bolum = await Chapter.findByIdAndDelete(req.params.id);
    if (!bolum)
      return res.status(404).json({ message: "Bölüm bulunamadı." });

    return res.json({ message: "Bölüm silindi." });
  } catch (err) {
    console.error("Admin DELETE /chapters/:id hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ══════════════════════════════════════════════
   3. REVIEW QUEUE
══════════════════════════════════════════════ */

// GET /api/admin/review-queue
router.get("/review-queue", async (req, res) => {
  try {
    const sayfa = getPageQuery(req);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);

    const [bolumler, toplam] = await Promise.all([
      Chapter.find({ status: "pending_review" })
        .select("title content revision reviewNote status createdAt work")
        .populate("work", "title user")
        .populate({ path: "work", populate: { path: "user", select: "kullaniciAdi email avatarUrl" } })
        .sort({ createdAt: -1 })
        .skip((sayfa - 1) * limit)
        .limit(limit)
        .lean(),
      Chapter.countDocuments({ status: "pending_review" }),
    ]);

    return res.json({
      bolumler,
      meta: { toplam, sayfa, limit, toplamSayfa: Math.ceil(toplam / limit) },
    });
  } catch (err) {
    console.error("Admin /review-queue hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

// PUT /api/admin/review/:id/approve
router.put("/review/:id/approve", chapterReview('approve'));
router.put("/review/:id/reject", chapterReview('reject'));


// PUT /api/admin/review/:id/reject


/* ══════════════════════════════════════════════
   4. ŞİKAYET YÖNETİMİ
══════════════════════════════════════════════ */

router.use("/reports", adminReportsRouter);

router.put("/works/:id/unpublish", async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz eser ID." });

    const eser = await Work.findById(req.params.id);
    if (!eser)
      return res.status(404).json({ message: "Eser bulunamadı." });

    const bolumSonuc = await Chapter.updateMany(
      { work: req.params.id, status: { $in: ["published", "pending_review", "rejected"] } },
      { $set: { status: "draft", reviewNote: "", moderationHold: true } }
    );

    await Work.findByIdAndUpdate(req.params.id, { $set: { status: "draft", publishedChapterIds: [] } });

    return res.json({
      message: `"${eser.title}" taslağa alındı.`,
      etkilenenBolum: bolumSonuc.modifiedCount,
    });
  } catch (err) {
    console.error("Admin unpublish work hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ══════════════════════════════════════════════
   6. İSTATİSTİKLER
══════════════════════════════════════════════ */

// GET /api/admin/stats
router.get("/stats", async (req, res) => {
  try {
    const [
      toplamKullanici, dogrulanmisKullanici, adminSayisi, banlananSayisi,
        toplamEser, toplamBolum, bekleyenReview, bekleyenSikayet, copyright, inappropriate, otherReports, feedback,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ emailVerified: true }),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "banned" }),
      Work.countDocuments(),
      Chapter.countDocuments(),
      Chapter.countDocuments({ status: "pending_review" }),
      Report.countDocuments({ status: "pending" }),
        Report.countDocuments({ status: 'pending', ...reportCategoryFilter('copyright') }),
        Report.countDocuments({ status: 'pending', ...reportCategoryFilter('inappropriate') }),
        Report.countDocuments({ status: 'pending', ...reportCategoryFilter('other') }),
        Feedback.countDocuments({ status: 'new' }),
    ]);

    const otuzGunOnce  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const yeniKullanici = await User.countDocuments({ createdAt: { $gte: otuzGunOnce } });

    return res.json({
      kullanicilar: {
        toplam: toplamKullanici,
        dogrulanmis: dogrulanmisKullanici,
        dogrulanmamis: toplamKullanici - dogrulanmisKullanici,
        admin: adminSayisi,
        banlanan: banlananSayisi,
        son30Gun: yeniKullanici,
      },
      icerik: { toplamEser, toplamBolum },
        bekleyen: { reviewQueue: bekleyenReview, sikayetler: bekleyenSikayet, copyright, inappropriate, otherReports, feedback },
    });
  } catch (err) {
    console.error("Admin /stats hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

// GET /api/admin/stats/detail
router.get("/stats/detail", async (req, res) => {
  try {
    const enCokBegenilenEserler = await Work.find({ status: "published" })
      .populate("user", "kullaniciAdi")
      .select("title likeCount user")
      .sort({ likeCount: -1 })
      .limit(5)
      .lean();

    const aktifYazarlar = await Work.aggregate([
      { $group: { _id: "$user", eserSayisi: { $sum: 1 } } },
      { $sort:  { eserSayisi: -1 } },
      { $limit: 5 },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $project: { eserSayisi: 1, "user.kullaniciAdi": 1, "user.email": 1, "user.avatarUrl": 1 } },
    ]);

    const yediGunOnce = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const gunlukKayit = await User.aggregate([
      { $match: { createdAt: { $gte: yediGunOnce } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, sayi: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const gunlukYayin = await Work.aggregate([
      { $match: { status: "published", updatedAt: { $gte: yediGunOnce } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } }, sayi: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    return res.json({ enCokBegenilenEserler, aktifYazarlar, gunlukKayit, gunlukYayin });
  } catch (err) {
    console.error("Admin /stats/detail hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ══════════════════════════════════════════════
   7. HİKAYE YÖNETİMİ
══════════════════════════════════════════════ */

// GET /api/admin/stories
router.get("/stories", async (req, res) => {
  try {
    const sayfa = getPageQuery(req);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const ara   = req.query.ara?.trim();

    const statusParam    = req.query.status;
    const izinliStatusler = ["published", "archived", "draft", "pending_review", "rejected"];

    const filtre = {
      ...(statusParam === "all"
        ? { status: { $ne: "draft" } }
        : statusParam && izinliStatusler.includes(statusParam)
          ? { status: statusParam }
          : { status: { $in: ["published", "archived"] } }),
      ...(ara ? { title: { $regex: ara, $options: "i" } } : {}),
    };

    const [eserler, toplam] = await Promise.all([
      Work.find(filtre)
        .populate("user", "kullaniciAdi email")
        .select("title status coverImage likeCount createdAt updatedAt user")
        .sort({ createdAt: -1 })
        .skip((sayfa - 1) * limit)
        .limit(limit)
        .lean(),
      Work.countDocuments(filtre),
    ]);

    const workIds = eserler.map(e => e._id);
    const bolumSayilari = await Chapter.aggregate([
      { $match: { work: { $in: workIds } } },
      { $group: { _id: "$work", sayi: { $sum: 1 } } },
    ]);
    const bolumMap = Object.fromEntries(bolumSayilari.map(b => [b._id.toString(), b.sayi]));

    return res.json({
      eserler: eserler.map(e => ({ ...e, bolumSayisi: bolumMap[e._id.toString()] || 0 })),
      meta: { toplam, sayfa, limit, toplamSayfa: Math.ceil(toplam / limit) },
    });
  } catch (err) {
    console.error("Admin /stories hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

// PUT /api/admin/stories/:id/feature
router.put("/stories/:id/feature", async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz eser ID." });

    const { featured } = req.body;
    const eser = await Work.findByIdAndUpdate(
      req.params.id,
      { $set: { featured: Boolean(featured) } },
      { new: true }
    ).select("title featured");

    if (!eser) return res.status(404).json({ message: "Eser bulunamadı." });

    return res.json({
      message: featured ? `"${eser.title}" öne çıkarıldı.` : `"${eser.title}" öne çıkarma kaldırıldı.`,
      eser,
    });
  } catch (err) {
    console.error("Admin feature story hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

// PUT /api/admin/stories/:id/unpublish
router.put("/stories/:id/unpublish", async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz eser ID." });

    const eser = await Work.findById(req.params.id);
    if (!eser) return res.status(404).json({ message: "Eser bulunamadı." });

    const bolumSonuc = await Chapter.updateMany(
      { work: req.params.id, status: { $in: ["published", "pending_review"] } },
      { $set: { status: "draft", reviewNote: "", moderationHold: true } }
    );

    await Work.findByIdAndUpdate(req.params.id, { $set: { status: "draft", publishedChapterIds: [] } });

    return res.json({
      message: `"${eser.title}" yayından kaldırıldı.`,
      etkilenenBolum: bolumSonuc.modifiedCount,
    });
  } catch (err) {
    console.error("Admin unpublish story hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

export default router;
