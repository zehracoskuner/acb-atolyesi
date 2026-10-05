import readerAccess from "../middlewares/readerAccess.js";
import express from "express";
import mongoose from "mongoose";
import Work from "../models/Work.js";
import Chapter from "../models/Chapter.js";
import User from "../models/User.js";
import Log from "../models/Log.js";
import { notifyFollow } from "../services/notificationService.js";
import { getPublishedChapterIdsByWork } from "../services/publishedChapters.js";
import { PUBLIC_WORK_FIELDS, serializePublicWork, serializePublicWorkCard } from "../services/publicWork.js";
import ensureAuth, { optionalAuth } from "../middlewares/ensureAuth.js";

const router = express.Router();
router.use(readerAccess);

// The viewer identity comes from authentication, never from the request body.
router.post("/works/:id/mature-acknowledgement", ensureAuth, async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Geçersiz eser ID." });
    const work = await Work.findOne({ _id: req.params.id, status: "published" }).select("contentWarning");
    if (!work) return res.status(404).json({ message: "Eser bulunamadı." });
    if (work.contentWarning) await User.updateOne({ _id: req.user.id }, { $addToSet: { matureAcknowledgements: work._id } });
    return res.json({ acknowledged: true });
  } catch (err) { next(err); }
});

router.get("/works/:id/reading-access", ensureAuth, async (req, res, next) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: "Geçersiz eser ID." });
    const work = await Work.findOne({ _id: req.params.id, status: "published" }).select("contentWarning");
    if (!work) return res.status(404).json({ message: "Eser bulunamadı." });
    if (work.contentWarning && !req.user.matureAcknowledgements.some(id => String(id) === String(work._id))) {
      return res.status(428).json({ code: "MATURE_ACKNOWLEDGEMENT_REQUIRED", workId: String(work._id) });
    }
    return res.json({ allowed: true });
  } catch (err) { next(err); }
});

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
      .select(PUBLIC_WORK_FIELDS)
      .populate("user", "_id kullaniciAdi avatarUrl")
      .sort({ updatedAt: -1 })
      .limit(50);

    const publishedIdsByWork = await getPublishedChapterIdsByWork(works);
    const items = works.map(work => serializePublicWorkCard(work, publishedIdsByWork.get(String(work._id))));

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
      .select(PUBLIC_WORK_FIELDS)
      .populate("user", "_id kullaniciAdi avatarUrl");

    if (!work) return res.status(404).json({ message: "Eser bulunamadı." });

    const publishedIdsByWork = await getPublishedChapterIdsByWork([work]);
    return res.json({ item: {
      ...serializePublicWork(work, publishedIdsByWork.get(String(work._id))),
      isOwner: !!req.user && String(work.user?._id || work.user) === String(req.user.id),
    } });
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

    const work = await Work.findById(req.params.id).select("_id status publishedChapterIds");
    if (!work) return res.status(404).json({ message: "Eser bulunamadı." });

    // Sadece yayında eserler okunabilir
    if (work.status !== "published") return res.json({ items: [] });

    const publishedIds = work.publishedChapterIds ?? [];
    if (publishedIds.length === 0) return res.json({ items: [] });

    // Liste tek başına yeterli değil: bölüm bu esere ait ve yayında olmalı.
    // Sıra: narrative order (chapter.order), publish sırası değil.
    const chapters = await Chapter.find({
      _id: { $in: publishedIds }, work: work._id, status: "published",
    }).select("_id title order").sort({ order: 1 });

    return res.json({ items: chapters.map(ch => ({ _id: ch._id, title: ch.title, order: ch.order })) });
  } catch (err) {
    console.error("GET /works/:id/chapters hatası:", err);
    return res.status(500).json({ message: "Bölümler yüklenemedi." });
  }
});

// Full text is fetched one chapter at a time after authentication.
router.get("/works/:id/chapters/:chapterId", ensureAuth, async (req, res) => {
  try {
    const { id, chapterId } = req.params;
    if (!isValidId(id) || !isValidId(chapterId))
      return res.status(400).json({ message: "Geçersiz eser veya bölüm ID." });
    const work = await Work.findOne({ _id: id, status: "published" })
      .select("_id publishedChapterIds contentWarning");
    if (!work || !work.publishedChapterIds?.some(value => String(value) === chapterId.toLowerCase()))
      return res.status(404).json({ message: "Bölüm bulunamadı." });
    if (work.contentWarning && !req.user.matureAcknowledgements.some(id => String(id) === String(work._id))) {
      return res.status(428).json({ code: "MATURE_ACKNOWLEDGEMENT_REQUIRED", workId: String(work._id) });
    }
    const chapter = await Chapter.findOne({ _id: chapterId, work: work._id, status: "published" })
      .select("_id title order content");
    if (!chapter) return res.status(404).json({ message: "Bölüm bulunamadı." });
    return res.json({ item: { _id: chapter._id, title: chapter.title, order: chapter.order, content: chapter.content } });
  } catch {
    return res.status(500).json({ message: "Bölüm yüklenemedi." });
  }
});

/* ═══════════════════════════════════════════
   GET /api/public/profile/:id
═══════════════════════════════════════════ */
router.get("/profile/:id", optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const query = isValidId(id)
      ? { _id: id }
      : { kullaniciAdi: { $regex: new RegExp(`^${id}$`, "i") } };

    const user = await User.findOne(query).select(
      "_id kullaniciAdi bio location website avatarUrl bannerImage followers following createdAt"
    );

    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı." });

    const isFollowedByMe = !!req.user && (user.followers?.some(
      (id) => String(id) === req.user.id
    ) ?? false);

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

    // Anonim eseri yazarın profilinde listelemek bile kimliğini açığa çıkarır.
    const works = await Work.find({ user: user._id, status: "published", isAnonymous: { $ne: true } })
      .select(PUBLIC_WORK_FIELDS)
      .populate("user", "_id kullaniciAdi avatarUrl")
      .sort({ updatedAt: -1 });

    const publishedIdsByWork = await getPublishedChapterIdsByWork(works);
    const items = works.map(work => serializePublicWorkCard(work, publishedIdsByWork.get(String(work._id))));

    return res.json({ items });
  } catch (err) {
    console.error("GET /profile/:id/works hatası:", err);
    return res.status(500).json({ message: "Eserler yüklenemedi." });
  }
});

/* ═══════════════════════════════════════════
   POST /api/public/profile/:id/follow
═══════════════════════════════════════════ */
router.post("/profile/:id/follow", ensureAuth, async (req, res) => {
  try {
    const requesterId = req.user.id;

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
