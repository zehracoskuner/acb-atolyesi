import express from "express";
import ensureAuth from "../middlewares/ensureAuth.js";
import Story from "../models/Story.js";
import Chapter from "../models/Chapter.js";

const router = express.Router();

// 1. YENİ PROJE OLUŞTUR (Mevcut kodun - Değişmedi)
router.post("/", ensureAuth, async (req, res) => {
  try {
    const { title } = req.body;
    const newStory = await Story.create({
      title: title || "İsimsiz Proje",
      author: req.user.id
    });

    const firstChapter = await Chapter.create({
      story: newStory._id,
      title: "Bölüm 1",
      content: "", 
      order: 1
    });

    res.status(201).json({
      message: "Proje ve ilk bölüm oluşturuldu!",
      story: newStory,
      firstChapterId: firstChapter._id 
    });
  } catch (err) {
    console.error("Story Create Error:", err);
    res.status(500).json({ message: "Proje oluşturulamadı." });
  }
});

// 2. KULLANICININ TÜM PROJELERİNİ LİSTELE (Mevcut kodun - Değişmedi)
router.get("/my-projects", ensureAuth, async (req, res) => { // Çakışma olmaması için ismini netleştirdik
    try {
        const stories = await Story.find({ author: req.user.id }).sort({ updatedAt: -1 });
        res.json({ items: stories });
    } catch (err) {
        res.status(500).json({ message: "Projeler yüklenemedi" });
    }
});

// ==========================================
// YENİ EKLENEN KISIMLAR (OKUMA MODU & YAYINLAMA)
// ==========================================

// 3. GENEL AKIŞ (Okuma Modu İçin - Herkes görebilir, ensureAuth YOK)
router.get("/feed", async (req, res) => {
  try {
    // Sadece yayınlanmış hikayeleri getir, yazar ismini de ekle
    const publishedStories = await Story.find({ isPublished: true })
      .populate("author", "username") 
      .sort({ publishedAt: -1 });

    res.json(publishedStories);
  } catch (err) {
    res.status(500).json({ message: "Hikayeler yüklenirken hata oluştu." });
  }
});

// 4. HİKAYEYİ YAYINLA (isPublished durumunu güncelle)
router.patch("/:id/publish", ensureAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { tag, excerpt, color } = req.body; // Yayınlarken ek bilgiler alabiliriz

    const story = await Story.findOne({ _id: id, author: req.user.id });

    if (!story) return res.status(404).json({ message: "Proje bulunamadı." });

    story.isPublished = true;
    story.publishedAt = new Date();
    if (tag) story.tag = tag;
    if (excerpt) story.excerpt = excerpt;
    if (color) story.color = color;

    await story.save();
    res.json({ message: "Hikayen artık Okuma Modu'nda yayında!", story });
  } catch (err) {
    res.status(500).json({ message: "Yayınlama işlemi başarısız." });
  }
});

export default router;