import express from "express";
import ensureAuth from "../middlewares/ensureAuth.js";
import Note from "../models/Note.js";

const router = express.Router();

// 1. TÜM NOTLARI GETİR
router.get("/", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const notes = await Note.find({ user: userId }).sort({ updatedAt: -1 });

    // Frontend'de kafa karışıklığı olmasın diye _id'yi id olarak dönüyoruz
    res.json({
      items: notes.map((n) => ({
        _id: n._id, // Frontend'de sel._id kullandığın için bunu koruyalım
        title: n.title,
        content: n.content,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: "Notlar alınamadı." });
  }
});

// 2. YENİ NOT OLUŞTUR
router.post("/", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { title, content } = req.body;

    const note = await Note.create({
      title: title || "(Başlıksız)",
      content: content || "",
      user: userId,
    });

    res.status(201).json({ item: { ...note._doc, _id: note._id } });
  } catch (err) {
    res.status(500).json({ message: "Not oluşturulamadı." });
  }
});

// 3. GÜNCELLE (Hem PATCH hem PUT desteklesin diye ikisini de yazabiliriz)
router.patch("/:id", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const { title, content } = req.body;

    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, user: userId },
      { $set: { ...(title !== undefined && { title }), ...(content !== undefined && { content }) } },
      { new: true }
    );

    if (!note) return res.status(404).json({ message: "Not bulunamadı." });
    res.json({ item: { ...note._doc, _id: note._id } });
  } catch (err) {
    res.status(500).json({ message: "Güncelleme başarısız." });
  }
});

// 4. SİL (İşte eksik olan buydu!)
router.delete("/:id", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const note = await Note.findOneAndDelete({ _id: req.params.id, user: userId });

    if (!note) return res.status(404).json({ message: "Not bulunamadı veya yetkiniz yok." });
    res.json({ message: "Not başarıyla silindi." });
  } catch (err) {
    res.status(500).json({ message: "Silme işlemi sırasında hata oluştu." });
  }
});

export default router;