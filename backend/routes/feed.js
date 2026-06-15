// backend/routes/feed.js
import { Router } from "express";
import User       from "../models/User.js";
import Work       from "../models/Work.js";
import Chapter    from "../models/Chapter.js";
import Log        from "../models/Log.js";
import ensureAuth from "../middlewares/ensureAuth.js";

const router = Router();

/* ═══════════════════════════════════════════
   GET /api/feed
═══════════════════════════════════════════ */
router.get("/", ensureAuth, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 15;
    const skip  = (page - 1) * limit;

    const me = await User.findById(req.user.id).select("following").lean();
    const followingIds = me?.following || [];

    const logQuery = followingIds.length > 0
      ? { $or: [
          { visibility: "public" },
          { author: { $in: followingIds }, visibility: { $in: ["public", "followers"] } },
        ] }
      : { visibility: "public" };

    const logsPromise = Log.find(logQuery)
      .populate("author",      "_id kullaniciAdi avatarUrl")
      .populate("relatedWork", "_id title coverImage")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const followedWorks = await Work.find({
      user:   { $in: followingIds },
      status: "published",
    }).select("_id user").lean();

    const followedWorkIds = followedWorks.map(w => w._id);
    const workUserMap = Object.fromEntries(followedWorks.map(w => [String(w._id), String(w.user)]));

    const chaptersPromise = Chapter.find({
      work:      { $in: followedWorkIds },
      status:    "published",
      createdAt: { $gt: thirtyDaysAgo },
    })
      .populate("work", "_id title coverImage user")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const [logs, chapters] = await Promise.all([logsPromise, chaptersPromise]);

    const uniqueAuthorIds = [...new Set(
      chapters.filter(c => c.work?.user).map(c => String(c.work.user))
    )];
    const chapterAuthors = await User.find({ _id: { $in: uniqueAuthorIds } })
      .select("_id kullaniciAdi avatarUrl").lean();
    const authorMap = Object.fromEntries(chapterAuthors.map(a => [String(a._id), a]));

    const chapterItems = chapters
      .filter(c => c.work)
      .map(c => {
        const authorData = authorMap[String(c.work.user)] || {};
        return {
          _id:       c._id,
          type:      "chapter",
          createdAt: c.createdAt,
          author: {
            _id:          c.work.user,
            kullaniciAdi: authorData.kullaniciAdi || null,
            avatarUrl:    authorData.avatarUrl    || null,
          },
          chapter: { _id: c._id, title: c.title, order: c.order },
          work:    { _id: c.work._id, title: c.work.title, coverImage: c.work.coverImage },
        };
      });

    const logItems = logs.map(l => ({
      _id:         l._id,
      type:        "log",
      createdAt:   l.createdAt,
      author:      l.author,
      content:     l.content,
      visibility:  l.visibility,
      relatedWork: l.relatedWork,
      likeCount:   l.likes?.length ?? 0,
      likedByMe:   l.likes?.some(id => id.toString() === String(req.user.id)) ?? false,
    }));

    const merged    = [...logItems, ...chapterItems].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const paginated = merged.slice(skip, skip + limit);

    return res.json({
      items:   paginated,
      hasMore: skip + paginated.length < merged.length,
      total:   merged.length,
      isEmpty: merged.length === 0,
    });
  } catch (err) {
    console.error("GET /feed hatası:", err);
    return res.status(500).json({ message: "Feed yüklenemedi." });
  }
});

/* ═══════════════════════════════════════════
   GET /api/feed/discover
   ?genres=Fantastik,Gotik  → $in filtresi
═══════════════════════════════════════════ */
router.get("/discover", async (req, res) => {
  try {
    const { genres: genresParam } = req.query;

    // Tür filtresi
    const workFilter = {
      status:              "published",
      publishedChapterIds: { $exists: true, $not: { $size: 0 } },
    };

    if (genresParam) {
      const genreList = genresParam
        .split(",")
        .map(g => g.trim())
        .filter(Boolean);
      if (genreList.length) {
        workFilter["universe.genres"] = { $in: genreList };
      }
    }

    const worksPromise = Work.find(workFilter)
      .populate("user", "_id kullaniciAdi avatarUrl")
      .sort({ updatedAt: -1 })
      .limit(6)
      .lean();

    const recentLogAuthors = await Log.find({ visibility: "public" })
      .sort({ createdAt: -1 })
      .limit(20)
      .distinct("author");

    const activeWritersPromise = User.find({
      _id: { $in: recentLogAuthors.slice(0, 5) },
    })
      .select("_id kullaniciAdi avatarUrl bio followers")
      .lean();

    const [works, activeWriters] = await Promise.all([worksPromise, activeWritersPromise]);

    return res.json({
      works: works.map(w => {
        // FIX: anonim eserde gerçek yazar kimliğini hiç gönderme (devtools sızıntısı)
        const anon = !!w.isAnonymous;
        return {
          _id:          w._id,
          title:        w.title,
          coverImage:   w.coverImage ?? null,
          chapterCount: w.publishedChapterIds?.length ?? 0,
          universe:     { genres: w.universe?.genres ?? [] },  // ← array olarak gönder
          isAnonymous:  anon,
          author: anon ? null : (w.user ? {
            _id:          w.user._id,
            kullaniciAdi: w.user.kullaniciAdi,
            avatarUrl:    w.user.avatarUrl,
          } : null),
          updatedAt: w.updatedAt,
        };
      }),
      writers: activeWriters.map(u => ({
        _id:           u._id,
        kullaniciAdi:  u.kullaniciAdi,
        avatarUrl:     u.avatarUrl,
        bio:           u.bio || "",
        followerCount: u.followers?.length ?? 0,
      })),
    });
  } catch (err) {
    console.error("GET /feed/discover hatası:", err);
    return res.status(500).json({ message: "Keşfet yüklenemedi." });
  }
});

/* ═══════════════════════════════════════════
   GET /api/feed/top-logs
═══════════════════════════════════════════ */
router.get("/top-logs", async (req, res) => {
  try {
    const LogComment = (await import("../models/LogComment.js")).default;

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const logs = await Log.find({
      visibility: "public",
      createdAt:  { $gt: since },
    })
      .populate("author",      "_id kullaniciAdi avatarUrl")
      .populate("relatedWork", "_id title")
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

    const works = await Work.find({
      status:              "published",
      updatedAt:           { $gt: sevenDays },
      publishedChapterIds: { $exists: true, $not: { $size: 0 } },
    })
      .populate("user", "_id kullaniciAdi avatarUrl")
      // FIX: isAnonymous'u da seç — yoksa lean doc'ta gelmez, anonim sızar
      .select("_id title coverImage user universe updatedAt publishedChapterIds isAnonymous")
      .limit(30)
      .lean();

    if (works.length === 0) return res.json({ items: [] });

    const workIds       = works.map(w => w._id);
    const commentCounts = await Comment.aggregate([
      { $match: { work: { $in: workIds } } },
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
        chapterCount: w.publishedChapterIds?.length ?? 0,
        commentCount: commentMap[w._id.toString()] ?? 0,
        updatedAt:    w.updatedAt,
        isAnonymous:  anon,
        author: anon ? null : (w.user ? {
          _id:          w.user._id,
          kullaniciAdi: w.user.kullaniciAdi,
          avatarUrl:    w.user.avatarUrl,
        } : null),
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