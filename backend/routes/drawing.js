// backend/routes/drawing.js
import { Router } from "express";
import Drawing    from "../models/Drawing.js";
import ensureAuth from "../middlewares/ensureAuth.js";
import {
  uploadDrawingSnapshot,
  deleteDrawingSnapshot,
} from "../services/cloudinaryDrawing.js";

const router = Router();

async function isOwner(workId, userId) {
  const Work = (await import("../models/Work.js")).default;
  const work = await Work.findById(workId).select("user").lean();
  return work?.user?.toString() === String(userId);
}

/* ═══════════════════════════════════════════
   GET /api/drawing/:workId
   — snapshotUrl döndür, frontend fetch eder
═══════════════════════════════════════════ */
router.get("/:workId", ensureAuth, async (req, res) => {
  try {
    const { workId } = req.params;

    if (!await isOwner(workId, req.user.id))
      return res.status(403).json({ message: "Erişim yok." });

    const drawing = await Drawing.findOne({ work: workId }).lean();

    if (!drawing?.snapshotUrl)
      return res.json({ snapshotUrl: null });

    return res.json({ snapshotUrl: drawing.snapshotUrl });
  } catch (err) {
    console.error("GET /drawing/:workId:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

/* ═══════════════════════════════════════════
   PATCH /api/drawing/:workId
   Body: { snapshot }  ← tldraw getSnapshot() çıktısı
   — Cloudinary'e yükle, URL'yi MongoDB'ye yaz
═══════════════════════════════════════════ */
router.patch("/:workId", ensureAuth, async (req, res) => {
  try {
    const { workId } = req.params;
    const { snapshot } = req.body;

    if (!await isOwner(workId, req.user.id))
      return res.status(403).json({ message: "Erişim yok." });

    if (!snapshot)
      return res.status(400).json({ message: "Snapshot verisi gerekli." });

    // Cloudinary'e yükle
    const { url, publicId } = await uploadDrawingSnapshot(
      snapshot,
      workId,
    );

    // MongoDB'ye sadece URL + publicId kaydet
    const drawing = await Drawing.findOneAndUpdate(
      { work: workId },
      { $set: { snapshotUrl: url, snapshotPublicId: publicId } },
      { upsert: true, new: true }
    );

    return res.json({ ok: true, snapshotUrl: url, updatedAt: drawing.updatedAt });
  } catch (err) {
    console.error("PATCH /drawing/:workId:", err);
    return res.status(500).json({ message: "Çizim kaydedilemedi." });
  }
});

/* ═══════════════════════════════════════════
   DELETE /api/drawing/:workId
   — Cloudinary'den sil, kaydı temizle
═══════════════════════════════════════════ */
router.delete("/:workId", ensureAuth, async (req, res) => {
  try {
    const { workId } = req.params;

    if (!await isOwner(workId, req.user.id))
      return res.status(403).json({ message: "Erişim yok." });

    const drawing = await Drawing.findOne({ work: workId }).lean();

    // Cloudinary'den sil
    if (drawing?.snapshotPublicId)
      await deleteDrawingSnapshot(drawing.snapshotPublicId);

    await Drawing.findOneAndUpdate(
      { work: workId },
      { $set: { snapshotUrl: null, snapshotPublicId: null } }
    );

    return res.json({ ok: true, message: "Çizim sıfırlandı." });
  } catch (err) {
    console.error("DELETE /drawing/:workId:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

export default router;