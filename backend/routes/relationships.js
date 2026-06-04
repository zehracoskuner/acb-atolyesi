// backend/routes/relationships.js
import express      from "express";
import ensureAuth   from "../middlewares/ensureAuth.js";
import Relationship from "../models/Relationship.js";
import Character    from "../models/Character.js";
import Work         from "../models/Work.js";

const router = express.Router();

// DEBUG
router.get("/ping", (req, res) => res.json({ ok: true, route: "relationships" }));

/* ═══════════════════════════════════════════
   GET /api/relationships?workId=...
═══════════════════════════════════════════ */
router.get("/", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { workId } = req.query;

    if (!userId) return res.status(401).json({ message: "Giriş yapılmamış." });
    if (!workId) return res.status(400).json({ message: "workId gerekli." });

    const work = await Work.findOne({ _id: workId, user: userId });
    if (!work) return res.status(403).json({ message: "Bu çalışmaya erişim yok." });

    const items = await Relationship.find({ user: userId, work: workId, status: "active" })
      .sort({ createdAt: -1 });

    return res.json({ items });
  } catch (err) {
    console.error("GET /relationships error:", err);
    return res.status(500).json({ message: "İlişkiler alınamadı." });
  }
});

/* ═══════════════════════════════════════════
   POST /api/relationships
═══════════════════════════════════════════ */
router.post("/", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const {
      workId,
      from,
      to,
      type,
      label    = "",
      strength = 3,
      directed = true,
      color    = "",
    } = req.body;

    if (!userId) return res.status(401).json({ message: "Giriş yapılmamış." });
    if (!workId) return res.status(400).json({ message: "workId gerekli." });
    if (!from || !to || !type) {
      return res.status(400).json({ message: "from/to/type zorunlu.", code: "REL_BAD_REQUEST" });
    }
    if (String(from) === String(to)) {
      return res.status(400).json({ message: "Karakter kendine bağlanamaz.", code: "REL_SELF" });
    }

    // type temizle — XSS koruması, max 80 karakter
    const cleanType = String(type).trim().slice(0, 80);
    if (!cleanType) return res.status(400).json({ message: "Geçersiz ilişki türü." });

    const work = await Work.findOne({ _id: workId, user: userId });
    if (!work) return res.status(403).json({ message: "Bu çalışmaya erişim yok." });

    // Karakterler bu work'e ait mi?
    const [a, b] = await Promise.all([
      Character.findOne({ _id: from, user: userId, work: workId }),
      Character.findOne({ _id: to,   user: userId, work: workId }),
    ]);
    if (!a || !b) {
      return res.status(400).json({
        message: "Karakter(ler) bu çalışmaya ait değil.",
        code: "REL_BAD_CHAR",
      });
    }

    const item = await Relationship.create({
      user:     userId,
      work:     workId,
      from,
      to,
      type:     cleanType,
      label:    String(label).trim().slice(0, 200),
      strength: Math.min(5, Math.max(1, Number(strength) || 3)),
      directed: Boolean(directed),
      color:    String(color).trim().slice(0, 20),
      status:   "active",
    });

    return res.status(201).json({ item });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Bu bağ zaten var.", code: "REL_DUPLICATE" });
    }
    if (err?.message === "REL_SELF") {
      return res.status(400).json({ message: "Karakter kendine bağlanamaz.", code: "REL_SELF" });
    }
    console.error("POST /relationships error:", err);
    return res.status(500).json({ message: "İlişki oluşturulamadı." });
  }
});

/* ═══════════════════════════════════════════
   DELETE /api/relationships/:id?workId=...
═══════════════════════════════════════════ */
router.delete("/:id", ensureAuth, async (req, res) => {
  try {
    const userId  = req.user?.id;
    const { workId } = req.query;
    const { id }  = req.params;

    if (!userId) return res.status(401).json({ message: "Giriş yapılmamış." });
    if (!workId) return res.status(400).json({ message: "workId gerekli." });

    const work = await Work.findOne({ _id: workId, user: userId });
    if (!work) return res.status(403).json({ message: "Bu çalışmaya erişim yok." });

    const item = await Relationship.findOne({ _id: id, user: userId, work: workId });
    if (!item) return res.status(404).json({ message: "İlişki bulunamadı.", code: "REL_NOT_FOUND" });

    await Relationship.deleteOne({ _id: id });
    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /relationships error:", err);
    return res.status(500).json({ message: "İlişki silinemedi." });
  }
});

export default router;