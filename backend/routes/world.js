// backend/routes/world.js
import { Router } from "express";
import World      from "../models/World.js";
import ensureAuth from "../middlewares/ensureAuth.js";

const router     = Router();
const CATEGORIES = ["locations", "timeline", "rules", "notes"];

async function isOwner(workId, userId) {
  const Work = (await import("../models/Work.js")).default;
  const work = await Work.findById(workId).select("user").lean();
  return work?.user?.toString() === String(userId);
}

/* ═══════════════════════════════════════════
   GET /api/world/:workId
═══════════════════════════════════════════ */
router.get("/:workId", ensureAuth, async (req, res) => {
  try {
    const { workId } = req.params;

    if (!await isOwner(workId, req.user.id))
      return res.status(403).json({ message: "Erişim yok." });

    let world = await World.findOne({ work: workId }).lean();
    if (!world) {
      const created = await World.create({ work: workId });
      world = created.toObject();
    }

    // null girişleri temizle
    const clean = arr => (arr || []).filter(Boolean);
    world = {
      ...world,
      locations: clean(world.locations),
      timeline:  clean(world.timeline),
      rules:     clean(world.rules),
      notes:     clean(world.notes),
    };

    return res.json({ world });
  } catch (err) {
    console.error("GET /world/:workId:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});


/* ═══════════════════════════════════════════
   PATCH /api/world/:workId
   Body: { title?, structure? }
   — Başlık veya yapı güncelle
═══════════════════════════════════════════ */
router.patch("/:workId", ensureAuth, async (req, res) => {
  try {
    const { workId } = req.params;
    const { title, structure } = req.body;

    if (!await isOwner(workId, req.user.id))
      return res.status(403).json({ message: "Yetki yok." });

    const update = {};
    if (title !== undefined)     update.title     = title;
    if (structure !== undefined) update.structure = structure;

    if (!Object.keys(update).length)
      return res.status(400).json({ message: "Güncellenecek alan yok." });

    const world = await World.findOneAndUpdate(
      { work: workId },
      { $set: update },
      { upsert: true, new: true }
    );

    return res.json({ world });
  } catch (err) {
    console.error("PATCH /world/:workId:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ═══════════════════════════════════════════
   POST /api/world/:workId/entries
   Body: { category, name, description?, notes?, scenes? }
═══════════════════════════════════════════ */
router.post("/:workId/entries", ensureAuth, async (req, res) => {
  try {
    const { workId } = req.params;
    const { category, name, description, notes, scenes } = req.body;

    if (!await isOwner(workId, req.user.id))
      return res.status(403).json({ message: "Yetki yok." });

    if (!CATEGORIES.includes(category))
      return res.status(400).json({ message: "Geçersiz kategori." });

    if (!name?.trim())
      return res.status(400).json({ message: "İsim gerekli." });

    let world = await World.findOne({ work: workId });
    if (!world) world = await World.create({ work: workId });

    const newEntry = {
      name:        name.trim(),
      description: description?.trim() || "",
      notes:       notes?.trim() || "",
      scenes:      (scenes || []).filter(s => s?.sceneId),
      order:       world[category].length,
    };

    world[category].push(newEntry);
    await world.save();

    const saved = world[category][world[category].length - 1];
    return res.status(201).json({ entry: saved, category });
  } catch (err) {
    console.error("POST /world/:workId/entries:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ═══════════════════════════════════════════
   PATCH /api/world/:workId/entries/:entryId
   Body: { category?, name?, description?, notes?, scenes? }
═══════════════════════════════════════════ */
router.patch("/:workId/entries/:entryId", ensureAuth, async (req, res) => {
  try {
    const { workId, entryId } = req.params;
    const { category, name, description, notes, scenes } = req.body;

    if (!await isOwner(workId, req.user.id))
      return res.status(403).json({ message: "Yetki yok." });

    const world = await World.findOne({ work: workId });
    if (!world) return res.status(404).json({ message: "Dünya bulunamadı." });

    let entry = null;
    let foundCat = category;

    if (foundCat && CATEGORIES.includes(foundCat)) {
      entry = world[foundCat]?.id(entryId);
    } else {
      for (const cat of CATEGORIES) {
        entry = world[cat]?.id(entryId);
        if (entry) { foundCat = cat; break; }
      }
    }

    if (!entry) return res.status(404).json({ message: "Giriş bulunamadı." });

    if (name?.trim())              entry.name        = name.trim();
    if (description !== undefined) entry.description = description?.trim() || "";
    if (notes !== undefined)       entry.notes       = notes?.trim() || "";
    if (scenes !== undefined)      entry.scenes      = (scenes || []).filter(s => s?.sceneId);

    await world.save();
    return res.json({ entry, category: foundCat });
  } catch (err) {
    console.error("PATCH /world/:workId/entries/:entryId:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ═══════════════════════════════════════════
   DELETE /api/world/:workId/entries/:entryId
═══════════════════════════════════════════ */
router.delete("/:workId/entries/:entryId", ensureAuth, async (req, res) => {
  try {
    const { workId, entryId } = req.params;

    if (!await isOwner(workId, req.user.id))
      return res.status(403).json({ message: "Yetki yok." });

    const world = await World.findOne({ work: workId });
    if (!world) return res.status(404).json({ message: "Dünya bulunamadı." });

    let deleted = false;
    for (const cat of CATEGORIES) {
      const entry = world[cat]?.id(entryId);
      if (entry) {
        world[cat].pull(entryId);
        deleted = true;
        break;
      }
    }

    if (!deleted) return res.status(404).json({ message: "Giriş bulunamadı." });

    await world.save();
    return res.json({ message: "Silindi." });
  } catch (err) {
    console.error("DELETE /world/:workId/entries/:entryId:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

export default router;