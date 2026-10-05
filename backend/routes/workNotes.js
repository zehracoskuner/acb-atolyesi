import express from "express";
import WorkNote from "../models/WorkNote.js";
import ensureAuth from "../middlewares/ensureAuth.js";
import ensureWorkOwner from "../middlewares/ensureWorkOwner.js";

const router = express.Router({ mergeParams: true });
router.use(ensureAuth, ensureWorkOwner(req => req.params.workId));

router.get("/", async (req, res) => {
  const { workId } = req.params;
  const items = await WorkNote.find({ workId }).sort({ updatedAt: -1 });
  res.json({ items });
});

router.post("/", async (req, res) => {
  const { workId } = req.params;
  const { title = "", body = "", content = "", source = "manual", meta = {} } = req.body || {};
  const item = await WorkNote.create({ workId, title, body: body || content, source, meta });
  res.status(201).json({ item });
});

router.put("/:noteId", async (req, res) => {
  const { workId, noteId } = req.params;
  const patch = Object.fromEntries(["title", "body", "source", "meta"]
    .filter(key => req.body[key] !== undefined).map(key => [key, req.body[key]]));
  const item = await WorkNote.findOneAndUpdate(
    { _id: noteId, workId },
    { $set: patch },
    { new: true }
  );
  if (!item) return res.status(404).json({ message: "Not bulunamadı" });
  res.json({ item });
});

router.delete("/:noteId", async (req, res) => {
  const { workId, noteId } = req.params;
  await WorkNote.deleteOne({ _id: noteId, workId });
  res.json({ ok: true });
});

export default router;
