import express from "express";
import ensureAuth from "../middlewares/ensureAuth.js";
import Library from "../models/Library.js";
import Work from "../models/Work.js";

const router = express.Router();


// GET /api/library — kullanıcının kütüphanesi
router.get("/", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;

    const entries = await Library.find({ user: userId })
      .populate({
        path: "work",
        select: "title coverImage status publishedChapterIds",
        populate: { path: "user", select: "_id username" },
      })
      .sort({ createdAt: -1 });

    // Sadece hâlâ yayında olan eserleri döndür
    const items = entries
      .filter((e) => e.work && e.work.status === "published")
      .map((e) => ({
        _id:          e.work._id,
        title:        e.work.title,
        coverImage:   e.work.coverImage || "",
        chapterCount: e.work.publishedChapterIds?.length ?? 0,
        author:       e.work.user ?? {},
        addedAt:      e.createdAt,
      }));

    return res.json({ items });
  } catch (err) {
    console.error("GET /library error:", err);
    return res.status(500).json({ message: "Kütüphane yüklenemedi." });
  }
});

// GET /api/library/check/:workId
router.get("/check/:workId", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const entry = await Library.findOne({ user: userId, work: req.params.workId });
    return res.json({ inLibrary: !!entry });
  } catch (err) {
    return res.status(500).json({ inLibrary: false });
  }
});

// POST /api/library — ekle
router.post("/", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { workId } = req.body;

    if (!workId) return res.status(400).json({ message: "workId gerekli." });

    // Eser var mı ve yayında mı?
    const work = await Work.findOne({ _id: workId, status: "published" });
    if (!work) return res.status(404).json({ message: "Eser bulunamadı veya yayında değil." });

    // Kendi eserini kütüphaneye ekleyemesin
    if (work.user.toString() === userId.toString()) {
      return res.status(400).json({ message: "Kendi eserini kütüphanene ekleyemezsin." });
    }

    // unique index sayesinde duplicate insert hata fırlatır — onu yakala
    await Library.create({ user: userId, work: workId });

    return res.status(201).json({ message: "Kütüphaneye eklendi." });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Bu eser zaten kütüphanende." });
    }
    console.error("POST /library error:", err);
    return res.status(500).json({ message: "Eklenemedi." });
  }
});

// DELETE /api/library/:workId — çıkar
router.delete("/:workId", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { workId } = req.params;

    const deleted = await Library.findOneAndDelete({ user: userId, work: workId });
    if (!deleted) return res.status(404).json({ message: "Kayıt bulunamadı." });

    return res.json({ message: "Kütüphaneden çıkarıldı." });
  } catch (err) {
    console.error("DELETE /library/:workId error:", err);
    return res.status(500).json({ message: "Çıkarılamadı." });
  }
});

export default router;