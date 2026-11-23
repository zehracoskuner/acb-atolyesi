import readerAccess from "../middlewares/readerAccess.js";
// backend/routes/feed.js
import { Router } from "express";
import Work       from "../models/Work.js";
import Log        from "../models/Log.js";
import ensureAuth from "../middlewares/ensureAuth.js";
import { serializeWorkAuthor } from "../services/publicWork.js";
import { getPublishedChapterIdsByWork } from "../services/publishedChapters.js";
import { discoverWorks, discoverWriters } from "../services/discovery.js";
import { readSpotlight } from "../services/spotlight.js";
import { parseFeedQuery, readFeed, readLatestWork } from "../services/feed.js";
import { logWorkPopulation } from '../services/logAccess.js';

const router = Router();
router.use(readerAccess);

router.get("/spotlight", async (_req, res) => {
  res.set("Cache-Control", "no-store");
  try { return res.json(await readSpotlight()); }
  catch (error) {
    console.error("Spotlight:", error.message);
    return res.status(503).json({ message: "Keşif sırası şu an yüklenemedi." });
  }
});

/* ═══════════════════════════════════════════
   GET /api/feed
═══════════════════════════════════════════ */
router.get("/", ensureAuth, async (req, res) => {
  try {
    return res.json(await readFeed({ ...parseFeedQuery(req.query), viewerId: req.user.id }));
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ message: err.message });
    console.error("GET /feed hatası:", err);
    return res.status(500).json({ message: "Akış yüklenemedi." });
  }
});

router.get("/atelier", ensureAuth, async (req, res) => {
  try { return res.json({ work: await readLatestWork(req.user.id) }); }
  catch (err) {
    console.error("GET /feed/atelier hatası:", err);
    return res.status(500).json({ message: "Son çalışman yüklenemedi." });
  }
});


/* ═══════════════════════════════════════════
   GET /api/feed/discover
   ?genres=Fantastik,Gotik  → $in filtresi
═══════════════════════════════════════════ */
router.get("/discover", async (req, res) => {
  try {
    const [catalog, writers] = await Promise.all([
      discoverWorks({ ...req.query, sort: "updated" }, 6), discoverWriters(req.user?.id),
    ]);
    return res.json({ works: catalog.items, writers, pagination: catalog.pagination });
  } catch (err) {
    console.error("GET /feed/discover hatası:", err);
    return res.status(500).json({ message: "Keşfet yüklenemedi." });
  }
});

/* ═══════════════════════════════════════════
   GET /api/feed/top-logs
═══════════════════════════════════════════ */
// Independent resource: author-service errors do not hide the book shelf.
router.get("/writers", async (req, res) => {
  try { res.json({ items: await discoverWriters(req.user?.id) }); }
  catch { res.status(500).json({ message: "Yazarlar yüklenemedi." }); }
});

router.get("/top-logs", async (req, res) => {
  try {
    const LogComment = (await import("../models/LogComment.js")).default;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const logs = await Log.find({
      visibility: "public",
      createdAt:  { $gt: since },
    })
      .populate("author",      "_id kullaniciAdi avatarUrl")
      .populate(logWorkPopulation(null))
      .lean();

    const logIds        = logs.map(l => l._id);
    const commentCounts = await LogComment.aggregate([
      { $match: { log: { $in: logIds } } },
      { $group: { _id: "$log", count: { $sum: 1 } } },
    ]);
    const commentMap = Object.fromEntries(
      commentCounts.map(c => [c._id.toString(), c.count])
    );

    const scored = logs
      .map(l => ({
        ...l,
        likeCount:    l.likes?.length ?? 0,
        likedByMe: !!req.user && (l.likes || []).some(id => String(id) === String(req.user.id)),
        commentCount: commentMap[l._id.toString()] ?? 0,
        score:        (l.likes?.length ?? 0) * 2 + (commentMap[l._id.toString()] ?? 0) * 3,
        likes:        undefined,
      }))
      .filter(l => l.score > 0 || logs.length <= 3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const items = scored.length > 0 ? scored : logs.slice(0, 3).map(l => ({
      ...l,
      likeCount:    l.likes?.length ?? 0,
      likedByMe: !!req.user && (l.likes || []).some(id => String(id) === String(req.user.id)),
      commentCount: commentMap[l._id.toString()] ?? 0,
      likes:        undefined,
    }));

    return res.json({ items });
  } catch (err) {
    console.error("GET /feed/top-logs hatası:", err);
    return res.status(500).json({ message: "Günlükler yüklenemedi." });
  }
});

/* ═══════════════════════════════════════════
   GET /api/feed/needs-review
═══════════════════════════════════════════ */
router.get("/needs-review", async (req, res) => {
  try {
    const Comment    = (await import("../models/Comment.js")).default;
    const sevenDays  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000);
    const thirtyDays = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const candidatesWithIds = await Work.find({
      status:              "published",
      updatedAt:           { $gt: sevenDays },
      publishedChapterIds: { $exists: true, $not: { $size: 0 } },
    })
      .populate("user", "_id kullaniciAdi avatarUrl")
      // FIX: isAnonymous'u da seç — yoksa lean doc'ta gelmez, anonim sızar
      .select("_id title coverImage user universe updatedAt publishedChapterIds isAnonymous")
      .sort({ updatedAt: -1, _id: -1 })
      .limit(30)
      .lean();

    const publishedIds = await getPublishedChapterIdsByWork(candidatesWithIds);
    const works = candidatesWithIds.filter(w => publishedIds.get(String(w._id))?.length);

    if (works.length === 0) return res.json({ items: [] });

    const workIds       = works.map(w => w._id);
    const commentCounts = await Comment.aggregate([
      { $match: { work: { $in: workIds }, status: "published", isDeleted: { $ne: true } } },
      { $group: { _id: "$work", count: { $sum: 1 } } },
    ]);
    const commentMap = Object.fromEntries(
      commentCounts.map(c => [c._id.toString(), c.count])
    );

    const authorIds     = [...new Set(works.map(w => w.user?._id?.toString()).filter(Boolean))];
    const activeAuthors = await Log.find({
      author:     { $in: authorIds },
      createdAt:  { $gt: thirtyDays },
      visibility: "public",
    }).distinct("author");
    const activeSet = new Set(activeAuthors.map(id => id.toString()));

    const mapWork = w => {
      // FIX: anonim eserde yazar kimliğini gönderme
      const anon = !!w.isAnonymous;
      return {
        _id:          w._id,
        title:        w.title,
        coverImage:   w.coverImage ?? null,
        universe:     { genres: w.universe?.genres ?? [] },  // ← array
        chapterCount: publishedIds.get(String(w._id))?.length ?? 0,
        commentCount: commentMap[w._id.toString()] ?? 0,
        updatedAt:    w.updatedAt,
        isAnonymous:  anon,
        author: serializeWorkAuthor(w),
      };
    };

    const candidates = works
      .filter(w => (commentMap[w._id.toString()] ?? 0) <= 2 && activeSet.has(w.user?._id?.toString()))
      .slice(0, 4)
      .map(mapWork);

    if (candidates.length < 2) {
      const fallback = works
        .filter(w => (commentMap[w._id.toString()] ?? 0) <= 1)
        .slice(0, 4)
        .map(mapWork);
      return res.json({ items: fallback });
    }

    return res.json({ items: candidates });
  } catch (err) {
    console.error("GET /feed/needs-review hatası:", err);
    return res.status(500).json({ message: "Yüklenemedi." });
  }
});

export default router;
