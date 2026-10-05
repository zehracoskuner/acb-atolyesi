import readerAccess from "../middlewares/readerAccess.js";
// backend/routes/search.js
import { Router } from "express";
import Work from "../models/Work.js";
import User from "../models/User.js";

import { PUBLIC_WORK_FIELDS, serializePublicWorkCard } from "../services/publicWork.js";
import { getPublishedChapterIdsByWork } from "../services/publishedChapters.js";

const router = Router();
router.use(readerAccess);

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
      .select(PUBLIC_WORK_FIELDS)
      .populate("user", "_id kullaniciAdi avatarUrl")
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    const publishedIds = await getPublishedChapterIdsByWork(works);
    const items = works.map(work => serializePublicWorkCard(work, publishedIds.get(String(work._id))));

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