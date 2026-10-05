import readerAccess from "../middlewares/readerAccess.js";
import express from "express";
import User from "../models/User.js";

const router = express.Router();
router.use(readerAccess);

// ─── KULLANICI PROFİLİNİ VE KÜTÜPHANESİNİ GETİR (GET /api/profile/:id) ───
router.get("/:id", async (req, res) => {
  try {
    const userDoc = await User.findById(req.params.id)
      .select("_id kullaniciAdi avatarUrl bannerImage bio location website followers following createdAt");

    if (!userDoc) {
      return res.status(404).json({ message: "Kullanıcı bulunamadı." });
    }

    // ÖNEMLİ NOKTA: Mongoose dökümanını normal bir JavaScript objesine çeviriyoruz
    const profileData = userDoc.toObject();

    // Frontend yorulmasın (ve hata yapmasın) diye takipçi/takip sayılarını biz hesaplayıp objeye ekliyoruz
    profileData.followerCount = profileData.followers ? profileData.followers.length : 0;
    profileData.followingCount = profileData.following ? profileData.following.length : 0;

    // Artık frontend doğrudan profile.followerCount değerini ekrana basabilecek!
    res.status(200).json({ profile: profileData });
    
  } catch (err) {
    console.error("Profil getirme hatası:", err);
    res.status(500).json({ message: "Sunucu hatası." });
  }
});

export default router;
