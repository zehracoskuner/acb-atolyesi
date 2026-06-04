import express from "express";
import ensureAuth from "../middlewares/ensureAuth.js";
import Character from "../models/Character.js";
import Work from "../models/Work.js";

const router = express.Router();

// DEBUG
router.get("/ping", (req, res) => {
  res.json({ ok: true, route: "characters" });
});

/* ═══════════════════════════════════════════
   GET /api/characters?workId=...
═══════════════════════════════════════════ */
router.get("/", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { workId } = req.query;

    if (!userId) return res.status(401).json({ message: "Giriş yapılmamış." });
    if (!workId) return res.status(400).json({ message: "workId gerekli." });

    const work = await Work.findOne({ _id: workId, user: userId });
    if (!work) return res.status(403).json({ message: "Bu çalışmaya erişim yok." });

    const items = await Character.find({ user: userId, work: workId }).sort({ updatedAt: -1 });
    res.json({ items });
  } catch (err) {
    console.error("GET /characters error:", err);
    res.status(500).json({ message: "Karakterler alınamadı." });
  }
});

/* ═══════════════════════════════════════════
   PATCH /api/characters/:id
   (name / role / color / notes / tagline / faction / location / status)
═══════════════════════════════════════════ */
router.patch("/:id", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { workId } = req.body;

    if (!userId) return res.status(401).json({ message: "Giriş yapılmamış." });
    if (!workId) return res.status(400).json({ message: "workId gerekli." });

    const work = await Work.findOne({ _id: workId, user: userId });
    if (!work) return res.status(403).json({ message: "Bu çalışmaya erişim yok." });

    const allowed = ["name", "role", "color", "notes", "tagline", "faction", "location", "status"];
    const patch = {};
    for (const k of allowed) {
      if (req.body?.[k] !== undefined) patch[k] = req.body[k];
    }

    if (typeof patch.name   === "string") patch.name  = patch.name.trim();
    if (typeof patch.role   === "string") patch.role  = patch.role.trim();
    if (typeof patch.color  === "string") patch.color = patch.color.trim();

    const item = await Character.findOneAndUpdate(
      { _id: id, user: userId, work: workId },
      { $set: patch },
      { new: true }
    );

    if (!item) return res.status(404).json({ message: "Karakter bulunamadı." });
    res.json({ item });
  } catch (err) {
    console.error("PATCH /characters/:id error:", err);
    res.status(500).json({ message: "Karakter güncellenemedi." });
  }
});

/* ═══════════════════════════════════════════
   PATCH /api/characters/:id/position
═══════════════════════════════════════════ */
router.patch("/:id/position", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { workId, x, y } = req.body;

    if (!userId) return res.status(401).json({ message: "Giriş yapılmamış." });
    if (!workId) return res.status(400).json({ message: "workId gerekli." });

    const work = await Work.findOne({ _id: workId, user: userId });
    if (!work) return res.status(403).json({ message: "Bu çalışmaya erişim yok." });

    const item = await Character.findOneAndUpdate(
      { _id: id, user: userId, work: workId },
      { $set: { x, y } },
      { new: true }
    );

    if (!item) return res.status(404).json({ message: "Karakter bulunamadı." });
    res.json({ item });
  } catch (err) {
    console.error("PATCH /characters/:id/position error:", err);
    res.status(500).json({ message: "Pozisyon güncellenemedi." });
  }
});

/* ═══════════════════════════════════════════
   POST /api/characters
═══════════════════════════════════════════ */
router.post("/", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { workId } = req.body;

    if (!userId) return res.status(401).json({ message: "Giriş yapılmamış." });
    if (!workId) return res.status(400).json({ message: "workId gerekli." });

    const work = await Work.findOne({ _id: workId, user: userId });
    if (!work) return res.status(403).json({ message: "Bu çalışmaya erişim yok." });

    const allowed = ["name", "role", "notes", "tagline", "x", "y", "color", "faction", "location"];
    const patch = {};
    for (const k of allowed) {
      if (req.body?.[k] !== undefined) patch[k] = req.body[k];
    }

    const item = await Character.create({
      user:     userId,
      work:     workId,
      name:     patch.name?.trim() || "Yeni Karakter",
      role:     patch.role    || "",
      x:        typeof patch.x === "number" ? patch.x : 240,
      y:        typeof patch.y === "number" ? patch.y : 200,
      color:    patch.color   || "#7dd3fc",
      tagline:  patch.tagline || "",
      notes:    patch.notes   || "",
      faction:  patch.faction || "",
      location: patch.location || "",
      traits:   [],
      status:   "active",
    });

    res.status(201).json({ item });
  } catch (err) {
    console.error("POST /characters error:", err);
    res.status(500).json({ message: "Karakter oluşturulamadı." });
  }
});

/* ═══════════════════════════════════════════
   DELETE /api/characters/:id?workId=...
═══════════════════════════════════════════ */
router.delete("/:id", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { workId } = req.query;

    if (!userId) return res.status(401).json({ message: "Giriş yapılmamış." });
    if (!workId) return res.status(400).json({ message: "workId gerekli." });

    const work = await Work.findOne({ _id: workId, user: userId });
    if (!work) return res.status(403).json({ message: "Bu çalışmaya erişim yok." });

    const item = await Character.findOneAndDelete({ _id: id, user: userId, work: workId });
    if (!item) return res.status(404).json({ message: "Karakter bulunamadı." });

    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /characters/:id error:", err);
    return res.status(500).json({ message: "Karakter silinemedi." });
  }
});

export default router;