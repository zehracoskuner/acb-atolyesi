import { Router } from "express";
import mongoose from "mongoose";
import Drawing from "../models/Drawing.js";
import Work from "../models/Work.js";
import ensureAuth from "../middlewares/ensureAuth.js";
import { uploadDrawingSnapshot, deleteDrawingSnapshot } from "../services/cloudinaryDrawing.js";
import { validateDrawing } from "../../shared/drawingProtocol.js";

const router = Router();
router.use("/:workId", ensureAuth, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.workId)) return res.status(400).json({ message: "Geçersiz eser." });
    const work = await Work.findById(req.params.workId).select("user").lean();
    if (String(work?.user) !== String(req.user.id)) return res.status(403).json({ message: "Erişim yok." });
    next();
  } catch (error) { next(error); }
});
router.get("/:workId", async (req, res, next) => {
  try {
    const drawing = await Drawing.findOne({ work: req.params.workId }).lean();
    res.set("Cache-Control", "no-store").json({
      userId: String(req.user.id), snapshotUrl: drawing?.snapshotUrl || null,
      revision: drawing?.revision || 0, mutationId: drawing?.mutationId || null,
    });
  } catch (error) { next(error); }
});

async function save(req, res) {
  let uploaded;
  try {
    const { workId } = req.params;
    const { snapshot, expectedRevision, mutationId } = req.body || {};
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || typeof mutationId !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(mutationId)) {
      return res.status(400).json({ message: "Çizim sürümü gerekli. Sayfayı yenileyin." });
    }
    if (req.method !== "DELETE") validateDrawing(snapshot);
    const current = await Drawing.findOne({ work: workId }).lean();
    if (current?.mutationId === mutationId) return res.json({ ok: true, workId, revision: current.revision, mutationId });
    if ((current?.revision || 0) !== expectedRevision) return res.status(409).json({ message: "Çizim başka bir yerde değişti. Sayfayı yenileyip yerel taslağı inceleyin." });
    if (req.method !== "DELETE") uploaded = await uploadDrawingSnapshot(snapshot, workId);
    const fields = { snapshotUrl: uploaded?.url || null, snapshotPublicId: uploaded?.publicId || null, revision: expectedRevision + 1, mutationId };
    let drawing;
    if (!current) {
      drawing = await Drawing.create({ work: workId, ...fields });
    } else {
      const revisionFilter = expectedRevision === 0 ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] } : { revision: expectedRevision };
      drawing = await Drawing.findOneAndUpdate({ _id: current._id, ...revisionFilter }, { $set: fields }, { new: true });
    }
    if (!drawing) throw Object.assign(new Error("Çizim başka bir yerde değişti. Sayfayı yenileyin; yerel taslağınız korunuyor."), { status: 409 });
    // Only remove the previous immutable file after the database commit.
    await deleteDrawingSnapshot(current?.snapshotPublicId);
    return res.json({ ok: true, workId, revision: drawing.revision, mutationId });
  } catch (error) {
    // A database connection failure may have committed: retain its file in that case.
    if (uploaded && (error.status === 409 || error.code === 11000)) await deleteDrawingSnapshot(uploaded.publicId);
    return res.status(error.code === 11000 ? 409 : error.status || 500).json({ message: error.code === 11000 ? "Çizim başka bir yerde değişti. Sayfayı yenileyin." : error.status ? error.message : "Çizim kaydedilemedi. Bağlantıyı kontrol edip tekrar deneyin." });
  }
}
router.patch("/:workId", save);
router.delete("/:workId", save);
export default router;
