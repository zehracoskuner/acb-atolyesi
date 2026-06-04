// routes/user.js
import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Work from "../models/Work.js";
import ReadingList from "../models/ReadingList.js";
import ensureAuth from "../middlewares/ensureAuth.js";
import upload from "../config/cloudinary.js";

const router = express.Router();

// Tüm rotalar giriş gerektirir
router.use(ensureAuth);

/* ─── 1. Profil Bilgilerini Getir ─── */
// GET /api/user/profile
router.get("/profile", async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-sifreHash -password");
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı." });

    const works = await Work.find({ user: req.user.id });
    const stats = {
      totalWorks: works.length,
      totalWords: works.reduce((sum, w) => sum + (w.totalWords || 0), 0),
      totalViews: works.reduce((sum, w) => sum + (w.stats?.views || 0), 0),
      totalLikes: 0,
    };

    const userObj = user.toObject();
    userObj.followerCount  = user.followers?.length  ?? 0;
    userObj.followingCount = user.following?.length  ?? 0;

    res.json({ user: userObj, stats });
  } catch (err) {
    console.error("Profil Getirme Hatası:", err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ─── 2. Profil Güncelle ─── */
// PATCH /api/user/profile
//
// FIX: Frontend hem "kullaniciAdi" hem "username" gönderebilir.
//      User modelinde field adı "kullaniciAdi" — ikisi de kabul ediliyor.
//      Kullanıcı adı değişiyorsa benzersizlik kontrolü yapılıyor.
router.patch("/profile", async (req, res) => {
  try {
    const {
      kullaniciAdi,
      username,        // frontend uyumluluk için alternatif alan adı
      bio,
      location,
      website,
    } = req.body;

    // Kullanıcı adı: kullaniciAdi veya username'den birini al
    const newUsername = (kullaniciAdi || username || "").trim();

    const updates = {};

    if (newUsername) {
      // Geçerlilik kontrolü
      if (newUsername.length < 3) {
        return res.status(400).json({ message: "Kullanıcı adı en az 3 karakter olmalıdır." });
      }
      if (newUsername.length > 30) {
        return res.status(400).json({ message: "Kullanıcı adı en fazla 30 karakter olabilir." });
      }
      if (/[^a-zA-Z0-9_çÇğĞıİöÖşŞüÜ]/.test(newUsername)) {
        return res.status(400).json({ message: "Kullanıcı adında geçersiz karakter var." });
      }

      // Benzersizlik kontrolü (kendisi hariç)
      const existing = await User.findOne({
        kullaniciAdi: newUsername,
        _id: { $ne: req.user.id },
      });
      if (existing) {
        return res.status(409).json({ message: "Bu kullanıcı adı zaten kullanılıyor." });
      }

      updates.kullaniciAdi = newUsername;
    }

    // Diğer alanlar — undefined gelirse güncelleme
    if (bio      !== undefined) updates.bio      = bio.trim();
    if (location !== undefined) updates.location = location.trim();
    if (website  !== undefined) updates.website  = website.trim();

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "Güncellenecek alan bulunamadı." });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-sifreHash -password");

    if (!updatedUser) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }

    res.json({ user: updatedUser, message: "Profil güncellendi." });
  } catch (err) {
    // Mongoose unique index ihlali
    if (err.code === 11000) {
      return res.status(409).json({ message: "Bu kullanıcı adı zaten kullanılıyor." });
    }
    console.error("Profil Güncelleme Hatası:", err);
    res.status(500).json({ message: "Güncelleme başarısız." });
  }
});

/* ─── 3. Şifre Değiştir ─── */
// PATCH /api/user/password
router.patch("/password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Mevcut ve yeni şifre gereklidir." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Yeni şifre en az 6 karakter olmalıdır." });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı." });

    const isMatch = await bcrypt.compare(currentPassword, user.sifreHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Mevcut şifre yanlış." });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(
      req.user.id,
      { $set: { sifreHash: hashed } },
      { runValidators: false }
    );

    res.json({ message: "Şifre başarıyla değiştirildi." });
  } catch (err) {
    console.error("Şifre Değiştirme Hatası:", err);
    res.status(500).json({ message: "Şifre değiştirilemedi." });
  }
});

/* ─── 4. E-posta Değiştir ─── */
// PATCH /api/user/change-email
router.patch("/change-email", async (req, res) => {
  try {
    const { newEmail, currentPassword } = req.body;

    if (!newEmail || !newEmail.trim()) {
      return res.status(400).json({ message: "Yeni e-posta adresi gereklidir." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail.trim())) {
      return res.status(400).json({ message: "Geçerli bir e-posta adresi girin." });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı." });

    // Şifresi olan hesaplarda mevcut şifre zorunlu
    if (user.sifreHash) {
      if (!currentPassword) {
        return res.status(400).json({ message: "E-posta değiştirmek için mevcut şifrenizi girin." });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.sifreHash);
      if (!isMatch) {
        return res.status(400).json({ message: "Mevcut şifre yanlış." });
      }
    }

    // Başka bir hesapta kullanılıyor mu?
    const existing = await User.findOne({
      email: newEmail.trim().toLowerCase(),
      _id: { $ne: req.user.id },
    });
    if (existing) {
      return res.status(409).json({ message: "Bu e-posta adresi zaten kullanılıyor." });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { email: newEmail.trim().toLowerCase() } },
      { new: true, runValidators: true }
    ).select("-sifreHash -password");

    res.json({ user: updatedUser, message: "E-posta adresi güncellendi." });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Bu e-posta adresi zaten kullanılıyor." });
    }
    console.error("E-posta Değiştirme Hatası:", err);
    res.status(500).json({ message: "E-posta değiştirilemedi." });
  }
});

/* ─── 5. İlk Şifre Belirle (Google ile kayıt olanlar) ─── */
// PATCH /api/user/set-password
router.patch("/set-password", async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: "Şifre en az 6 karakter olmalı." });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı." });

    if (user.sifreHash && user.authProvider !== "google") {
      return res.status(400).json({
        message: "Zaten şifreniz var. Değiştirmek için mevcut şifrenizi girin.",
      });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(
      req.user.id,
      { $set: { sifreHash: hashed, authProvider: "both" } },
      { runValidators: false }
    );

    res.json({ message: "Şifre belirlendi." });
  } catch (err) {
    console.error("set-password hatası:", err);
    res.status(500).json({ message: "Sunucu hatası.", detail: err.message });
  }
});

/* ─── 6. Okuma Listelerini Getir ─── */
// GET /api/user/reading-lists
router.get("/reading-lists", async (req, res) => {
  try {
    const lists = await ReadingList.find({ owner: req.user.id })
      .populate({
        path:   "works.work",
        select: "title coverImage genres author",
        populate: { path: "author", select: "kullaniciAdi" },
      })
      .sort({ updatedAt: -1 });

    res.json({ items: lists });
  } catch (err) {
    console.error("Okuma Listesi Getirme Hatası:", err);
    res.status(500).json({ message: "Okuma listeleri yüklenemedi." });
  }
});

/* ─── 7. Kullanıcının Eserlerini Getir ─── */
// GET /api/user/works
//
// FIX: status hesaplaması düzeltildi.
//      Eski kod publishedChapterIds.length > 0 ise "published" sayıyordu —
//      bu Work modelindeki gerçek status field'ını yok sayıyordu.
router.get("/works", async (req, res) => {
  try {
    const works = await Work.find({ user: req.user.id }).sort({ updatedAt: -1 });

    const cleanWorks = works.map(w => ({
      _id:         w._id,
      id:          w._id,           // frontend w.id || w._id kullanıyor
      title:       w.title,
      description: w.description,
      coverImage:  w.coverImage,
      color:       w.color,
      genres:      w.genres,
      status:      w.status || "draft",   // modeldeki gerçek status
      totalWords:  w.totalWords || 0,
      chapterCount: w.publishedChapterIds?.length || 0,
      stats: {
        chapterCount: w.publishedChapterIds?.length || 0,
        totalWords:   w.totalWords || 0,
        views:        w.stats?.views || 0,
      },
      updatedAt: w.updatedAt,
      createdAt: w.createdAt,
    }));

    res.json({ items: cleanWorks });
  } catch (err) {
    console.error("Kullanıcı Eserleri Hatası:", err);
    res.status(500).json({ message: "Eserler yüklenemedi." });
  }
});

/* ─── 8. Avatar Yükle ─── */
// POST /api/user/avatar
router.post("/avatar", upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Dosya seçilmedi." });

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { avatarUrl: req.file.path },
      { new: true }
    ).select("-sifreHash -password");

    res.json({ message: "Avatar güncellendi.", avatarUrl: updatedUser.avatarUrl });
  } catch (err) {
    console.error("Avatar Upload Hatası:", err);
    res.status(500).json({ message: "Avatar yüklenirken hata oluştu." });
  }
});

/* ─── 9. Banner Yükle ─── */
// POST /api/user/banner
router.post("/banner", upload.single("banner"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Dosya seçilmedi." });

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { bannerImage: req.file.path },
      { new: true }
    ).select("-sifreHash -password");

    res.json({ message: "Banner güncellendi.", bannerImage: updatedUser.bannerImage });
  } catch (err) {
    console.error("Banner Upload Hatası:", err);
    res.status(500).json({ message: "Banner yüklenirken hata oluştu." });
  }
});

/* ─── 10. Avatar Sil ─── */
// DELETE /api/user/avatar
router.delete("/avatar", async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $set: { avatarUrl: "" } });
    res.json({ message: "Profil resmi kaldırıldı." });
  } catch (err) {
    console.error("Avatar silme hatası:", err);
    res.status(500).json({ message: "İşlem başarısız." });
  }
});

/* ─── 11. Banner Sil ─── */
// DELETE /api/user/banner
router.delete("/banner", async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { $set: { bannerImage: "" } });
    res.json({ message: "Kapak resmi kaldırıldı." });
  } catch (err) {
    console.error("Banner silme hatası:", err);
    res.status(500).json({ message: "İşlem başarısız." });
  }
});

/* ─── 12. Hesap Sil ─── */
// DELETE /api/user/account
router.delete("/account", async (req, res) => {
  try {
    // İlgili tüm verileri de temizle
    await Promise.all([
      Work.deleteMany({ user: req.user.id }),
      ReadingList.deleteMany({ owner: req.user.id }),
      User.findByIdAndDelete(req.user.id),
    ]);
    res.json({ message: "Hesap ve tüm veriler silindi." });
  } catch (err) {
    console.error("Hesap Silme Hatası:", err);
    res.status(500).json({ message: "Silinemedi." });
  }
});

export default router;