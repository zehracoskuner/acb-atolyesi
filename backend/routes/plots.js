// backend/routes/plots.js
import { Router } from "express";
import Plot       from "../models/Plot.js";
import ensureAuth from "../middlewares/ensureAuth.js";

const router   = Router();
const STATUSES = ["idea", "drafting", "writing", "done"];

/* ── Yardımcı: eserin sahibi mi? ── */
async function isOwner(workId, userId) {
  const Work = (await import("../models/Work.js")).default;
  const work = await Work.findById(workId).select("user").lean();
  return work?.user?.toString() === String(userId);
}

/* ── Yardımcı: sahnede bir sahneyi bul ── */
function findScene(plot, sceneId) {
  return plot.scenes?.id(sceneId) || null;
}

/* ── Yardımcı: eski ObjectId bağlantılarını yeni formata çevir ── */
function migrateConnections(plot) {
  plot.scenes.forEach(scene => {
    scene.connections = (scene.connections || [])
      .filter(c => c !== null && c !== undefined)
      .map(c => {
        if (c && c.target) return c; // zaten yeni format
        const id = c?._id || c;
        if (!id || String(id) === "undefined") return null;
        return { target: id, edgeType: "sonuc" };
      })
      .filter(Boolean);
  });
}

/* ── Yardımcı: eski nested acts → flat scenes migration ── */
function migrateActs(plot) {
  if (!plot.acts || plot.scenes?.length > 0) return;

  const ACT_MAP = {
    beginning: "giris",
    middle:    "gelisme",
    end:       "sonuc",
  };

  const flatScenes = [];
  for (const [actKey, scenes] of Object.entries(plot.acts)) {
    if (!Array.isArray(scenes)) continue;
    const actId = ACT_MAP[actKey] || actKey;
    scenes.forEach(s => {
      flatScenes.push({ ...s.toObject ? s.toObject() : s, act: actId, _id: s._id });
    });
  }

  if (flatScenes.length > 0) {
    plot.scenes = flatScenes;
  }
}

/* ═══════════════════════════════════════════
   GET /api/plots/:workId
═══════════════════════════════════════════ */
router.get("/:workId", ensureAuth, async (req, res) => {
  try {
    const { workId } = req.params;

    if (!await isOwner(workId, req.user.id))
      return res.status(403).json({ message: "Erişim yetkiniz yok." });

    let plot = await Plot.findOne({ work: workId });

    if (!plot) {
      plot = await Plot.create({ work: workId, scenes: [] });
    } else if (plot.acts && (!plot.scenes || plot.scenes.length === 0)) {
      migrateActs(plot);
      migrateConnections(plot);
      plot.acts = undefined; 
      await plot.save();
    }

    await plot.populate("scenes.characters", "_id name role color");

    const scenesFlat = (plot.scenes || []).map(s => s.toObject ? s.toObject() : s);

    const actsGrouped = {};
    scenesFlat.forEach(s => {
      const act = s.act || "giris";
      if (!actsGrouped[act]) actsGrouped[act] = [];
      actsGrouped[act].push(s);
    });

    const Chapter = (await import("../models/Chapter.js")).default;
    const chapters = await Chapter.find({ work: workId })
      .select("_id title order").sort({ order: 1 }).lean();

    return res.json({
      plot: {
        ...plot.toObject(),
        scenes: scenesFlat,
        acts:   actsGrouped,
      },
      chapters,
    });
  } catch (err) {
    console.error("GET /plots/:workId:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ═══════════════════════════════════════════
   POST /api/plots/:workId/scenes
═══════════════════════════════════════════ */
router.post("/:workId/scenes", ensureAuth, async (req, res) => {
  try {
    const { workId } = req.params;
    const {
      act, title, goal, volume, isAlternative,
      description, status, characters,
    } = req.body;

    if (!await isOwner(workId, req.user.id))
      return res.status(403).json({ message: "Yetki yok." });

    if (!title?.trim())
      return res.status(400).json({ message: "Sahne başlığı gerekli." });

    if (!act || typeof act !== "string")
      return res.status(400).json({ message: "Perde (act) gerekli." });

    let plot = await Plot.findOne({ work: workId });
    if (!plot) plot = await Plot.create({ work: workId, scenes: [] });

    if (plot.acts && (!plot.scenes || plot.scenes.length === 0)) {
      migrateActs(plot);
    }

    const sameActCount = (plot.scenes || []).filter(s => s.act === act).length;

    plot.scenes.push({
      act:           act.trim(),
      title:         title.trim(),
      goal:          goal?.trim()        || "",
      volume:        ["short","medium","long"].includes(volume) ? volume : "",
      isAlternative: !!isAlternative,
      description:   description?.trim() || "",
      status:        STATUSES.includes(status) ? status : "idea",
      characters:    Array.isArray(characters) ? characters : [],
      order:         sameActCount,
      position:      { x: 0, y: 0 },
    });

    migrateConnections(plot);
    await plot.save();
    await plot.populate("scenes.characters", "_id name role color");

    const added = plot.scenes[plot.scenes.length - 1];
    return res.status(201).json({ scene: added.toObject(), act: added.act });
  } catch (err) {
    console.error("POST /plots/:workId/scenes:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ═══════════════════════════════════════════
   PATCH /api/plots/:workId/scenes/:sceneId
═══════════════════════════════════════════ */
router.patch("/:workId/scenes/:sceneId", ensureAuth, async (req, res) => {
  try {
    const { workId, sceneId } = req.params;
    const {
      title, description, goal, volume, isAlternative,
      status, position, act: newAct, draftText, characters,
    } = req.body;

    if (!await isOwner(workId, req.user.id))
      return res.status(403).json({ message: "Yetki yok." });

    const plot = await Plot.findOne({ work: workId });
    if (!plot) return res.status(404).json({ message: "Olay örgüsü bulunamadı." });

    const scene = findScene(plot, sceneId);
    if (!scene) return res.status(404).json({ message: "Sahne bulunamadı." });

    if (title?.trim())               scene.title         = title.trim();
    if (description !== undefined)   scene.description   = description?.trim() || "";
    if (goal !== undefined)          scene.goal          = goal?.trim() || "";
    if (volume !== undefined)        scene.volume        = ["short","medium","long"].includes(volume) ? volume : "";
    if (isAlternative !== undefined) scene.isAlternative = !!isAlternative;
    if (STATUSES.includes(status))   scene.status        = status;
    if (draftText !== undefined)     scene.draftText     = draftText || "";
    if (Array.isArray(characters))   scene.characters    = characters;
    if (position?.x !== undefined && position?.y !== undefined)
      scene.position = { x: Math.round(position.x), y: Math.round(position.y) };
    if (newAct && typeof newAct === "string")
      scene.act = newAct.trim();

    await plot.save();
    await plot.populate("scenes.characters", "_id name role color");

    const updated = findScene(plot, sceneId);
    return res.json({ scene: updated.toObject(), act: updated.act });
  } catch (err) {
    console.error("PATCH /plots/:workId/scenes/:sceneId:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ═══════════════════════════════════════════
   DELETE /api/plots/:workId/scenes/:sceneId
═══════════════════════════════════════════ */
router.delete("/:workId/scenes/:sceneId", ensureAuth, async (req, res) => {
  try {
    const { workId, sceneId } = req.params;

    if (!await isOwner(workId, req.user.id))
      return res.status(403).json({ message: "Yetki yok." });

    const plot = await Plot.findOne({ work: workId });
    if (!plot) return res.status(404).json({ message: "Olay örgüsü bulunamadı." });

    const scene = findScene(plot, sceneId);
    if (!scene) return res.status(404).json({ message: "Sahne bulunamadı." });

    // Hem eski hem yeni format — bu sahneye gelen bağlantıları temizle
    plot.scenes.forEach(s => {
      s.connections = (s.connections || []).filter(c => {
        const tid = c?.target ? c.target.toString() : c?.toString?.();
        return tid !== sceneId;
      });
    });

    plot.scenes.pull(sceneId);
    await plot.save();

    return res.json({ message: "Sahne silindi." });
  } catch (err) {
    console.error("DELETE /plots/:workId/scenes/:sceneId:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ═══════════════════════════════════════════
   PATCH /api/plots/:workId/scenes/:sceneId/connect
═══════════════════════════════════════════ */
router.patch("/:workId/scenes/:sceneId/connect", ensureAuth, async (req, res) => {
  try {
    const { workId, sceneId } = req.params;
    const { targetId, edgeType = "sonuc" } = req.body;

    if (!targetId)
      return res.status(400).json({ message: "targetId gerekli." });

    if (!await isOwner(workId, req.user.id))
      return res.status(403).json({ message: "Yetki yok." });

    const plot = await Plot.findOne({ work: workId });
    if (!plot) return res.status(404).json({ message: "Plot bulunamadı." });

    const scene = findScene(plot, sceneId);
    if (!scene) return res.status(404).json({ message: "Sahne bulunamadı." });

    // Önce eski formatları migrate et
    migrateConnections(plot);

    const already = scene.connections.some(c => {
      const tid = c?.target ? c.target.toString() : c?.toString?.();
      return tid === String(targetId);
    });

    if (!already) scene.connections.push({ target: targetId, edgeType });

    await plot.save();
    return res.json({ message: "Bağlantı eklendi.", connections: scene.connections });
  } catch (err) {
    console.error("PATCH connect:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ═══════════════════════════════════════════
   PATCH /api/plots/:workId/scenes/:sceneId/disconnect
═══════════════════════════════════════════ */
router.patch("/:workId/scenes/:sceneId/disconnect", ensureAuth, async (req, res) => {
  try {
    const { workId, sceneId } = req.params;
    const { targetId } = req.body;

    if (!await isOwner(workId, req.user.id))
      return res.status(403).json({ message: "Yetki yok." });

    const plot = await Plot.findOne({ work: workId });
    if (!plot) return res.status(404).json({ message: "Plot bulunamadı." });

    const scene = findScene(plot, sceneId);
    if (!scene) return res.status(404).json({ message: "Sahne bulunamadı." });

    migrateConnections(plot);

    scene.connections = scene.connections.filter(c => {
      const tid = c?.target ? c.target.toString() : c?.toString?.();
      return tid !== String(targetId);
    });

    await plot.save();
    return res.json({ message: "Bağlantı kaldırıldı.", connections: scene.connections });
  } catch (err) {
    console.error("PATCH disconnect:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

export default router;