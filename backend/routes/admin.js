// backend/routes/admin.js
// server.js'de: app.use("/api/admin", ensureAuth, requireRole("admin"), adminRouter);

import { Router }   from "express";
import mongoose     from "mongoose";
import User         from "../models/User.js";
import Work         from "../models/Work.js";
import Chapter      from "../models/Chapter.js";
import Report       from "../models/Report.js";
import { sendMail } from "../services/emailService.js";
import Notification from "../models/Notification.js";

const router = Router();

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;

/* ══════════════════════════════════════════════
   1. KULLANICI YÖNETİMİ
══════════════════════════════════════════════ */

// GET /api/admin/users?sayfa=1&limit=20&ara=zehra
router.get("/users", async (req, res) => {
  try {
    const sayfa = Math.max(1, parseInt(req.query.sayfa) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const ara   = req.query.ara?.trim();

    const filtre = ara
      ? { $or: [
          { kullaniciAdi: { $regex: ara, $options: "i" } },
          { email:        { $regex: ara, $options: "i" } },
        ]}
      : {};

    const [kullanicilar, toplam] = await Promise.all([
      User.find(filtre)
        .select("-sifreHash -emailVerifyToken -emailVerifyExpires -passwordResetToken -passwordResetExpires")
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
      .select("-sifreHash -emailVerifyToken -emailVerifyExpires -passwordResetToken -passwordResetExpires")
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
    ).select("-sifreHash");

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
    await Report.deleteMany({ targetId: req.params.id, targetType: "work" });

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
    const sayfa = Math.max(1, parseInt(req.query.sayfa) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);

    const [bolumler, toplam] = await Promise.all([
      Chapter.find({ status: "pending_review" })
        .select("title content reviewNote status createdAt work")
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
router.put("/review/:id/approve", async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz bölüm ID." });

    const bolum = await Chapter.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "published", reviewNote: "", reviewedBy: req.user.id, reviewedAt: new Date() } },
      { new: true }
    ).populate("work", "title user");

    if (!bolum) return res.status(404).json({ message: "Bölüm bulunamadı." });

    await Work.findByIdAndUpdate(bolum.work._id, { $addToSet: { publishedChapterIds: bolum._id } });
    await Work.findByIdAndUpdate(bolum.work._id, { $set: { status: "published" } }, { runValidators: false });

    const yazarId = bolum.work.user;

    try {
      await Notification.create({
        recipient: yazarId, sender: null, type: "chapter_approved",
        work: bolum.work._id,
        text: `"${bolum.title}" bölümünüz onaylandı ve yayına alındı! ✓`,
        read: false,
      });
    } catch (e) { console.error("Bildirim oluşturulamadı:", e.message); }

    try {
      const yazar = await User.findById(yazarId).select("email kullaniciAdi").lean();
      if (yazar?.email) {
        await sendMail({
          to: yazar.email,
          subject: `"${bolum.title}" bölümünüz onaylandı ✅`,
          html: `<p>Merhaba ${yazar.kullaniciAdi || "yazar"},</p>
                 <p><strong>"${bolum.title}"</strong> bölümünüz incelendi ve yayına alındı.</p>
                 <p>ACB Atölyesi ekibi</p>`,
        });
      }
    } catch (e) { console.error("Onay maili gönderilemedi:", e.message); }

    return res.json({ message: "Bölüm onaylandı ve yayına alındı.", bolum });
  } catch (err) {
    console.error("Admin approve hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

// PUT /api/admin/review/:id/reject
router.put("/review/:id/reject", async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz bölüm ID." });

    const { reviewNote } = req.body;
    if (!reviewNote?.trim())
      return res.status(400).json({ message: "Red sebebi zorunludur." });

    const bolum = await Chapter.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "rejected", reviewNote: reviewNote.trim(), reviewedBy: req.user.id, reviewedAt: new Date() } },
      { new: true }
    ).populate("work", "title user");

    if (!bolum) return res.status(404).json({ message: "Bölüm bulunamadı." });

    await Work.findByIdAndUpdate(bolum.work._id, { $pull: { publishedChapterIds: bolum._id } });

    const work = await Work.findById(bolum.work._id).lean();
    if (work) {
      const newStatus = work.publishedChapterIds?.length > 0 ? "published" : "draft";
      if (work.status !== newStatus) {
        await Work.findByIdAndUpdate(bolum.work._id, { $set: { status: newStatus } }, { runValidators: false });
      }
    }

    try {
      await Notification.create({
        recipient: bolum.work.user, sender: null, type: "chapter_rejected",
        work: bolum.work._id,
        text: `"${bolum.title}" bölümünüz yayınlanamadı. Sebep: ${reviewNote}`,
        read: false,
      });
    } catch (e) { console.error("Red bildirimi oluşturulamadı:", e.message); }

    try {
      const yazar = await User.findById(bolum.work.user).select("email kullaniciAdi").lean();
      if (yazar?.email) {
        await sendMail({
          to: yazar.email,
          subject: `"${bolum.title}" bölümünüz reddedildi`,
          html: `<p>Merhaba ${yazar.kullaniciAdi || "yazar"},</p>
                 <p><strong>"${bolum.title}"</strong> başlıklı bölümünüz incelendi ancak yayınlanamaz.</p>
                 <p><strong>Sebep:</strong> ${reviewNote}</p>
                 <p>Bölümü düzenleyerek tekrar yayınlayabilirsiniz.</p>
                 <p>ACB Atölyesi ekibi</p>`,
        });
      }
    } catch (e) { console.error("Red maili gönderilemedi:", e.message); }

    return res.json({ message: "Bölüm reddedildi.", bolum });
  } catch (err) {
    console.error("Admin reject hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ══════════════════════════════════════════════
   4. ŞİKAYET YÖNETİMİ
══════════════════════════════════════════════ */

// GET /api/admin/reports?sayfa=1&limit=20&status=pending&targetType=all
router.get("/reports", async (req, res) => {
  try {
    const sayfa      = Math.max(1, parseInt(req.query.sayfa) || 1);
    const limit      = Math.min(50, parseInt(req.query.limit) || 20);
    const status     = req.query.status     || "pending";
    const targetType = req.query.targetType || "all";

    const filtre = {
      ...(status     !== "all" ? { status }     : {}),
      ...(targetType !== "all" ? { targetType } : {}),
    };

    const [sikayetler, toplam] = await Promise.all([
      Report.find(filtre)
        .populate("reporter", "kullaniciAdi email avatarUrl")
        .sort({ createdAt: -1 })
        .skip((sayfa - 1) * limit)
        .limit(limit)
        .lean(),
      Report.countDocuments(filtre),
    ]);

    // targetId populate — User veya Work'e göre
    const populated = await Promise.all(
      sikayetler.map(async (s) => {
        try {
          if (s.targetType === "user") {
            const u = await User.findById(s.targetId)
              .select("kullaniciAdi email avatarUrl createdAt role")
              .lean();
            return { ...s, targetObj: u || null };
          }
          if (s.targetType === "work") {
            const w = await Work.findById(s.targetId)
              .populate("user", "kullaniciAdi email")
              .select("title status coverImage user")
              .lean();
            return { ...s, targetObj: w || null };
          }
        } catch { /* targetObj null kalır */ }
        return { ...s, targetObj: null };
      })
    );

    return res.json({
      sikayetler: populated,
      meta: { toplam, sayfa, limit, toplamSayfa: Math.ceil(toplam / limit) },
    });
  } catch (err) {
    console.error("Admin /reports hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

// PUT /api/admin/reports/:id/resolve
router.put("/reports/:id/resolve", async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz şikayet ID." });

    const sikayet = await Report.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "resolved", resolvedBy: req.user.id, resolvedAt: new Date(), adminNote: req.body.adminNote?.trim() || "" } },
      { new: true }
    );

    if (!sikayet)
      return res.status(404).json({ message: "Şikayet bulunamadı." });

    return res.json({ message: "Şikayet çözüldü olarak işaretlendi.", sikayet });
  } catch (err) {
    console.error("Admin resolve report hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

// PUT /api/admin/reports/:id/dismiss
router.put("/reports/:id/dismiss", async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz şikayet ID." });

    const sikayet = await Report.findByIdAndUpdate(
      req.params.id,
      { $set: { status: "dismissed", resolvedBy: req.user.id, resolvedAt: new Date(), adminNote: req.body.adminNote?.trim() || "" } },
      { new: true }
    );

    if (!sikayet)
      return res.status(404).json({ message: "Şikayet bulunamadı." });

    return res.json({ message: "Şikayet geçersiz sayıldı.", sikayet });
  } catch (err) {
    console.error("Admin dismiss report hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ══════════════════════════════════════════════
   5. ESERİ TASLAĞA ALMA
══════════════════════════════════════════════ */

// PUT /api/admin/works/:id/unpublish
router.put("/works/:id/unpublish", async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz eser ID." });

    const eser = await Work.findById(req.params.id);
    if (!eser)
      return res.status(404).json({ message: "Eser bulunamadı." });

    const bolumSonuc = await Chapter.updateMany(
      { work: req.params.id, status: { $in: ["published", "pending_review", "rejected"] } },
      { $set: { status: "draft", reviewNote: "" } }
    );

    await Work.findByIdAndUpdate(req.params.id, { $set: { status: "draft" } });

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
      toplamEser, toplamBolum, bekleyenReview, bekleyenSikayet,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ emailVerified: true }),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "banned" }),
      Work.countDocuments(),
      Chapter.countDocuments(),
      Chapter.countDocuments({ status: "pending_review" }),
      Report.countDocuments({ status: "pending" }),
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
      bekleyen: { reviewQueue: bekleyenReview, sikayetler: bekleyenSikayet },
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
    const sayfa = Math.max(1, parseInt(req.query.sayfa) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const ara   = req.query.ara?.trim();

    const statusParam    = req.query.status;
    const izinliStatusler = ["published", "archived", "draft", "pending_review", "rejected"];

    const filtre = {
      ...(statusParam && statusParam !== "all" && izinliStatusler.includes(statusParam)
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
      { $set: { status: "draft", reviewNote: "" } }
    );

    await Work.findByIdAndUpdate(req.params.id, { $set: { status: "draft" } });

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