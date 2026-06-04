import express from "express";
import User from "../models/User.js";

const router = express.Router();

// ─── KULLANICI PROFİLİNİ VE KÜTÜPHANESİNİ GETİR (GET /api/profile/:id) ───
router.get("/:id", async (req, res) => {
  try {
    const userDoc = await User.findById(req.params.id)
      .select("-password -email")
      .populate({
        path: "library",
        select: "title coverImage universe author",
        populate: { path: "author", select: "username" }
      });

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