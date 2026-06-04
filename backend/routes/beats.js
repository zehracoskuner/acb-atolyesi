// backend/routes/beats.js
import { Router } from "express";
import Beat from "../models/Beat.js";

const router = Router();

// GET /api/beats?workId=...&plotId=...
router.get("/", async (req, res) => {
  try {
    const { workId, plotId } = req.query;
    if (!workId || !plotId) {
      return res.status(400).json({ ok: false, message: "workId ve plotId gerekli." });
    }

    const items = await Beat.find({ workId, plotId }).sort({ order: 1, createdAt: 1 });
    res.json({ ok: true, items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: "Beat'ler alınamadı." });
  }
});

// POST /api/beats
router.post("/", async (req, res) => {
  try {
    const { workId, plotId } = req.body;
    if (!workId || !plotId) {
      return res.status(400).json({ ok: false, message: "workId ve plotId gerekli." });
    }

    const last = await Beat.findOne({ workId, plotId }).sort({ order: -1 });
    const nextOrder = last ? last.order + 1 : 1;

    const item = await Beat.create({
      workId,
      plotId,
      order: nextOrder,
      title: req.body.title ?? "Yeni Beat",
      summary: req.body.summary ?? "",
      goal: req.body.goal ?? "",
      conflict: req.body.conflict ?? "",
      outcome: req.body.outcome ?? "mixed",
      povCharacterId: req.body.povCharacterId ?? "",
      locationId: req.body.locationId ?? "",
      timeHint: req.body.timeHint ?? "",
      tension: req.body.tension ?? 3,
      tags: Array.isArray(req.body.tags) ? req.body.tags : [],
      notes: req.body.notes ?? "",
    });

    res.json({ ok: true, item });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: "Beat eklenemedi." });
  }
});

// PUT /api/beats/:beatId
router.put("/:beatId", async (req, res) => {
  try {
    const { beatId } = req.params;

    const allowed = [
      "title","summary","goal","conflict","outcome",
      "povCharacterId","locationId","timeHint","tension","tags","notes",
    ];

    const patch = {};
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];

    const item = await Beat.findByIdAndUpdate(beatId, patch, { new: true });
    if (!item) return res.status(404).json({ ok: false, message: "Beat bulunamadı." });

    res.json({ ok: true, item });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: "Beat güncellenemedi." });
  }
});

// DELETE /api/beats/:beatId
router.delete("/:beatId", async (req, res) => {
  try {
    const { beatId } = req.params;
    const gone = await Beat.findByIdAndDelete(beatId);
    if (!gone) return res.status(404).json({ ok: false, message: "Beat bulunamadı." });

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: "Beat silinemedi." });
  }
});

// PUT /api/beats/reorder
// body: { workId, plotId, orderedIds: [...] }
router.put("/reorder", async (req, res) => {
  try {
    const { workId, plotId, orderedIds } = req.body;
    if (!workId || !plotId || !Array.isArray(orderedIds)) {
      return res.status(400).json({ ok: false, message: "workId, plotId, orderedIds gerekli." });
    }

    // 1..N order yaz
    const ops = orderedIds.map((id, i) => ({
      updateOne: {
        filter: { _id: id, workId, plotId },
        update: { $set: { order: i + 1 } },
      },
    }));

    if (ops.length) await Beat.bulkWrite(ops);

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, message: "Reorder başarısız." });
  }
});

export default router;
