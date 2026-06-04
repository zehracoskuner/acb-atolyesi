import express from "express";
import WorkNote from "../models/WorkNote.js";

const router = express.Router({ mergeParams: true });

router.get("/", async (req, res) => {
  const { workId } = req.params;
  const items = await WorkNote.find({ workId }).sort({ updatedAt: -1 });
  res.json({ items });
});

router.post("/", async (req, res) => {
  const { workId } = req.params;
  const { title = "", body = "" } = req.body || {};
  const finalBody = body || content; 
  const item = await WorkNote.create({ workId, title, body });
  res.status(201).json({ item });
});

router.put("/:noteId", async (req, res) => {
  const { workId, noteId } = req.params;
  const item = await WorkNote.findOneAndUpdate(
    { _id: noteId, workId },
    req.body,
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
