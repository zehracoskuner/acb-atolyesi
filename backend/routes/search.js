import readerAccess from "../middlewares/readerAccess.js";
// backend/routes/search.js
import { Router } from "express";
import User from "../models/User.js";

import { discoverWorks, searchText, literalRegex, listPage, writerCard } from "../services/discovery.js";

const router = Router();
router.use(readerAccess);

/* ═══════════════════════════════════════════
   GET /api/search/works?q=...&genre=...
═══════════════════════════════════════════ */
router.get("/works", async (req, res) => {
  try {
    if (searchText(req.query.q).length < 2) return res.json({ items: [], pagination: { page: 1, total: 0, totalPages: 0 } });
    return res.json(await discoverWorks(req.query));
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
    if (req.query.mentions === "1") {
      const query = req.query.q ?? "";
      if (typeof query !== "string" || !/^[A-Za-z0-9_]{0,30}$/.test(query))
        return res.status(400).json({ message: "Geçersiz kullanıcı araması." });
      const items = await User.find({ kullaniciAdi: { $regex: `^${query}[A-Za-z0-9_]*$`, $options: "i" } })
        .select("_id kullaniciAdi avatarUrl").sort({ kullaniciAdi: 1 }).limit(5).lean();
      return res.json({ items });
    }
    const term = searchText(req.query.q);
    if (term.length < 2) return res.json({ items: [], pagination: { page: 1, total: 0, totalPages: 0 } });
    const { page, limit } = listPage(req.query, 15);
    const regex = literalRegex(term);
    const filter = { $or: [{ kullaniciAdi: regex }, { bio: regex }] };
    const [users, total] = await Promise.all([
      User.find(filter).select("_id kullaniciAdi avatarUrl bio followers")
        .sort({ kullaniciAdi: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter),
    ]);
    return res.json({ items: users.map(u => writerCard(u, req.user?.id)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error("GET /search/users hatası:", err);
    return res.status(500).json({ message: "Arama başarısız." });
  }
});

export default router;
