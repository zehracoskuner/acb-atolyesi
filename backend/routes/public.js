import express from "express";
import mongoose from "mongoose";
import Work from "../models/Work.js";
import Chapter from "../models/Chapter.js";
import User from "../models/User.js";
import Log from "../models/Log.js";
import { notifyFollow } from "../services/notificationService.js";

const router = express.Router();

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/* ═══════════════════════════════════════════
   GET /api/public/explore
═══════════════════════════════════════════ */
router.get("/explore", async (req, res) => {
  try {
    const works = await Work.find({
      status: "published",
      publishedChapterIds: { $exists: true, $not: { $size: 0 } },
    })
      .populate("user", "_id kullaniciAdi avatarUrl")
      .sort({ updatedAt: -1 })
      .limit(50);

    const items = works.map((work) => {
      const safeUser = work.user ?? null;
      return {
        _id:          work._id,
        title:        work.title,
        description:  work.description,
        coverImage:   work.coverImage ?? null,
        isAnonymous:  work.isAnonymous ?? false,
        author: (work.isAnonymous || !safeUser)
          ? { _id: null, username: "Anonim" }
          : { _id: safeUser._id, username: safeUser.kullaniciAdi, avatarUrl: safeUser.avatarUrl },
        chapterCount: work.publishedChapterIds?.length ?? 0,
        genre:        work.universe?.genre ?? "Diğer",
        updatedAt:    work.updatedAt,
      };
    });

    return res.json({ items });
  } catch (err) {
    console.error("GET /explore hatası:", err);
    return res.status(500).json({ message: "Kütüphane yüklenemedi." });
  }
});

/* ═══════════════════════════════════════════
   GET /api/public/works/:id
═══════════════════════════════════════════ */
router.get("/works/:id", async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz eser ID." });

    const work = await Work.findOne({ _id: req.params.id, status: "published" })
      .populate("user", "_id kullaniciAdi avatarUrl");

    if (!work) return res.status(404).json({ message: "Eser bulunamadı." });

    const safeUser = work.user ?? null;
    let customTitles = work.customChapterTitles;
    if (customTitles instanceof Map) customTitles = Object.fromEntries(customTitles);

    return res.json({
      item: {
        _id:                 work._id,
        title:               work.title,
        description:         work.description,
        preface:             work.preface ?? "",
        coverImage:          work.coverImage ?? null,
        isAnonymous:         work.isAnonymous ?? false,
        author: (work.isAnonymous || !safeUser)
          ? { _id: null, username: "Anonim" }
          : { _id: safeUser._id, username: safeUser.kullaniciAdi, avatarUrl: safeUser.avatarUrl },
        universe:            work.universe ?? {},
        publishedChapterIds: work.publishedChapterIds ?? [],
        customChapterTitles: customTitles ?? {},
        updatedAt:           work.updatedAt,
      },
    });
  } catch (err) {
    console.error("GET /works/:id hatası:", err);
    return res.status(500).json({ message: "Eser detayları alınamadı." });
  }
});

/* ═══════════════════════════════════════════
   GET /api/public/works/:id/chapters
═══════════════════════════════════════════ */
router.get("/works/:id/chapters", async (req, res) => {
  try {
    if (!isValidId(req.params.id))
      return res.status(400).json({ message: "Geçersiz eser ID." });

    const work = await Work.findById(req.params.id);
    if (!work) return res.status(404).json({ message: "Eser bulunamadı." });

    // Sadece yayında eserler okunabilir
    if (work.status !== "published") return res.json({ items: [] });

    const publishedIds = work.publishedChapterIds ?? [];
    if (publishedIds.length === 0) return res.json({ items: [] });

    // publishedChapterIds'e güvenme — chapter.status da "published" olmalı.
    // Sıra: narrative order (chapter.order), publish sırası değil.
    const chapters = await Chapter.find({
      _id: { $in: publishedIds }, status: "published",
    }).sort({ order: 1 });

    return res.json({ items: chapters });
  } catch (err) {
    console.error("GET /works/:id/chapters hatası:", err);
    return res.status(500).json({ message: "Bölümler yüklenemedi." });
  }
});

/* ═══════════════════════════════════════════
   GET /api/public/profile/:id
═══════════════════════════════════════════ */
router.get("/profile/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const query = isValidId(id)
      ? { _id: id }
      : { kullaniciAdi: { $regex: new RegExp(`^${id}$`, "i") } };

    const user = await User.findOne(query).select(
      "_id kullaniciAdi bio location website avatarUrl bannerImage followers following createdAt"
    );

    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı." });

    let isFollowedByMe = false;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const { default: jwt } = await import("jsonwebtoken");
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "atolye-secret-key");
        const requesterId = decoded.id;
        if (requesterId) {
          isFollowedByMe = user.followers?.some(
            (fId) => fId.toString() === String(requesterId)
          ) ?? false;
        }
      }
    } catch (err) {
      console.error("Token decode hatası:", err.message);
    }

    return res.json({
      user: {
        _id:            user._id,
        username:       user.kullaniciAdi,
        kullaniciAdi:   user.kullaniciAdi,
        bio:            user.bio          ?? "",
        location:       user.location     ?? "",
        website:        user.website      ?? "",
        avatarUrl:      user.avatarUrl    ?? "",
        bannerImage:    user.bannerImage  ?? "",
        followerCount:  user.followers?.length  ?? 0,
        followingCount: user.following?.length  ?? 0,
        followers:      user.followers    ?? [],
        following:      user.following    ?? [],
        createdAt:      user.createdAt,
        isFollowedByMe,
      },
    });
  } catch (err) {
    console.error("GET /profile/:id hatası:", err);
    return res.status(500).json({ message: "Profil yüklenemedi." });
  }
});

/* ═══════════════════════════════════════════
   GET /api/public/profile/:id/works
═══════════════════════════════════════════ */
router.get("/profile/:id/works", async (req, res) => {
  try {
    const { id } = req.params;
    const query = isValidId(id)
      ? { _id: id }
      : { kullaniciAdi: { $regex: new RegExp(`^${id}$`, "i") } };

    const user = await User.findOne(query).select("_id");
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı." });

    const works = await Work.find({ user: user._id, status: "published" })
      .select("_id title coverImage status publishedChapterIds universe updatedAt totalWords stats")
      .sort({ updatedAt: -1 });

    const items = works.map((w) => ({
      _id:          w._id,
      title:        w.title,
      coverImage:   w.coverImage ?? null,
      status:       w.status,
      chapterCount: w.publishedChapterIds?.length ?? 0,
      totalWords:   w.totalWords || w.stats?.totalWords || 0,
      genre:        w.universe?.genre ?? "",
      updatedAt:    w.updatedAt,
    }));

    return res.json({ items });
  } catch (err) {
    console.error("GET /profile/:id/works hatası:", err);
    return res.status(500).json({ message: "Eserler yüklenemedi." });
  }
});

/* ═══════════════════════════════════════════
   POST /api/public/profile/:id/follow
═══════════════════════════════════════════ */
router.post("/profile/:id/follow", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer "))
      return res.status(401).json({ message: "Giriş yapmalısın." });

    const token = authHeader.split(" ")[1];
    const { default: jwt } = await import("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "atolye-secret-key");
    const requesterId = decoded.id;

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ message: "Kullanıcı bulunamadı." });

    if (targetUser._id.toString() === String(requesterId))
      return res.status(400).json({ message: "Kendinizi takip edemezsiniz." });

    const requester = await User.findById(requesterId);
    if (!requester) return res.status(404).json({ message: "Kullanıcı bulunamadı." });

    const alreadyFollowing = requester.following?.some(
      (id) => id.toString() === targetUser._id.toString()
    );

    if (alreadyFollowing) {
      await User.findByIdAndUpdate(requesterId, { $pull: { following: targetUser._id } });
      const updated = await User.findByIdAndUpdate(
        targetUser._id,
        { $pull: { followers: requesterId } },
        { new: true }
      ).select("followers");

      return res.json({ following: false, followerCount: updated.followers.length });
    } else {
      await User.findByIdAndUpdate(requesterId, { $addToSet: { following: targetUser._id } });
      const updated = await User.findByIdAndUpdate(
        targetUser._id,
        { $addToSet: { followers: requesterId } },
        { new: true }
      ).select("followers");

      notifyFollow({
        senderId: requesterId,
        receiverId: targetUser._id.toString(),
      }).catch(console.error);

      return res.json({ following: true, followerCount: updated.followers.length });
    }
  } catch (err) {
    console.error("POST /profile/:id/follow hatası:", err);
    return res.status(500).json({ message: "İşlem başarısız." });
  }
});

/* ═══════════════════════════════════════════
   GET /api/public/profile/:userId/logs
   Bir kullanıcının public günlük girdileri
   (followers/private görünürlüklü girdiler hariç)
═══════════════════════════════════════════ */
router.get("/profile/:userId/logs", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidId(userId))
      return res.status(400).json({ message: "Geçersiz kullanıcı ID." });

    const limit = Math.min(30, parseInt(req.query.limit) || 20);
    const page  = Math.max(1,  parseInt(req.query.page)  || 1);
    const skip  = (page - 1) * limit;

    const logs = await Log.find({ author: userId, visibility: "public" })
      .populate("relatedWork", "_id title coverImage")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const items = logs.map((l) => ({
      _id:       l._id,
      content:   l.content,
      likeCount: l.likes?.length ?? 0,
      likedByMe: false,
      relatedWork: l.relatedWork
        ? { _id: l.relatedWork._id, title: l.relatedWork.title }
        : null,
      createdAt: l.createdAt,
    }));

    return res.json({ items });
  } catch (err) {
    console.error("GET /public/profile/:userId/logs hatası:", err);
    return res.status(500).json({ message: "Günlükler yüklenemedi." });
  }
});

export default router;