// backend/routes/search.js
import { Router } from "express";
import Work from "../models/Work.js";
import User from "../models/User.js";

const router = Router();

/* ═══════════════════════════════════════════
   GET /api/search/works?q=...&genre=...
═══════════════════════════════════════════ */
router.get("/works", async (req, res) => {
  try {
    const { q, genre } = req.query;
    if (!q || q.trim().length < 2)
      return res.json({ items: [] });

    const regex = new RegExp(q.trim(), "i");

    const filter = {
      status: "published",
      publishedChapterIds: { $exists: true, $not: { $size: 0 } },
      $or: [
        { title:       regex },
        { description: regex },
      ],
    };

    if (genre && genre !== "all") {
      filter["universe.genre"] = genre;
    }

    const works = await Work.find(filter)
      .populate("user", "_id kullaniciAdi avatarUrl")
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    const items = works.map(w => ({
      _id:          w._id,
      title:        w.title,
      description:  w.description,
      coverImage:   w.coverImage ?? null,
      chapterCount: w.publishedChapterIds?.length ?? 0,
      genre:        w.universe?.genre ?? "",
      author:       w.user ? {
        _id:          w.user._id,
        kullaniciAdi: w.user.kullaniciAdi,
        avatarUrl:    w.user.avatarUrl,
      } : null,
      updatedAt: w.updatedAt,
    }));

    return res.json({ items });
  } catch (err) {
    console.error("GET /search/works hatası:", err);
    return res.status(500).json({ message: "Arama başarısız." });
  }
});

/* ═══════════════════════════════════════════
   GET /api/search/users?q=...
═══════════════════════════════════════════ */
router.get("/users", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2)
      return res.json({ items: [] });

    const regex = new RegExp(q.trim(), "i");

    const users = await User.find({
      $or: [
        { kullaniciAdi: regex },
        { bio:          regex },
      ],
    })
      .select("_id kullaniciAdi avatarUrl bio followers")
      .limit(15)
      .lean();

    const items = users.map(u => ({
      _id:           u._id,
      kullaniciAdi:  u.kullaniciAdi,
      avatarUrl:     u.avatarUrl ?? "",
      bio:           u.bio       ?? "",
      followerCount: u.followers?.length ?? 0,
    }));

    return res.json({ items });
  } catch (err) {
    console.error("GET /search/users hatası:", err);
    return res.status(500).json({ message: "Arama başarısız." });
  }
});

export default router;