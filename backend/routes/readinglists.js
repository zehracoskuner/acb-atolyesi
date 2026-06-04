import express from "express";
import ensureAuth from "../middlewares/ensureAuth.js"; // JWT middleware'in (yolunu projene göre teyit et)
import ReadingList from "../models/ReadingList.js";
import Work from "../models/Work.js";

const router = express.Router();

/* ─── Yardımcı: liste populate ─── */
function populateList(query) {
  return query.populate({
    path: "works.work",
    select: "title coverImage author status stats chapterCount",
    populate: { path: "author", select: "kullaniciAdi username avatarUrl" },
  });
}

/* ════════════════════════
   KENDİ LİSTELERİM
════════════════════════ */

// GET /api/reading-lists  — sahibin tüm listeleri
router.get("/", ensureAuth, async (req, res) => {
  try {
    const lists = await populateList(
      ReadingList.find({ owner: req.user.id }).sort({ updatedAt: -1 })
    );
    res.json({ items: lists });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Listeler yüklenemedi." });
  }
});

// POST /api/reading-lists  — yeni liste oluştur
router.post("/", ensureAuth, async (req, res) => {
  const { name, description, isPrivate } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ message: "Liste adı zorunludur." });
  }

  try {
    const list = await ReadingList.create({
      owner: req.user.id,
      name: name.trim(),
      description: description?.trim() ?? "",
      isPrivate: !!isPrivate,
    });
    res.status(201).json({ list });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Bu isimde zaten bir listen var." });
    }
    console.error(err);
    res.status(500).json({ message: "Liste oluşturulamadı." });
  }
});

// GET /api/reading-lists/:id  — tek liste (sahip veya herkese açık)
router.get("/:id", async (req, res) => {
  try {
    const list = await populateList(ReadingList.findById(req.params.id));
    if (!list) return res.status(404).json({ message: "Liste bulunamadı." });

    // Gizliyse sadece sahibi görebilir
    const tokenUserId = req.user?.id; // auth opsiyonel, sonraki middleware'de set edilmemiş olabilir
    if (list.isPrivate && String(list.owner) !== String(tokenUserId)) {
      return res.status(403).json({ message: "Bu liste gizlidir." });
    }

    res.json({ list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Liste yüklenemedi." });
  }
});

// PATCH /api/reading-lists/:id  — isim/açıklama/gizlilik güncelle
router.patch("/:id", ensureAuth, async (req, res) => {
  try {
    const list = await ReadingList.findOne({ _id: req.params.id, owner: req.user.id });
    if (!list) return res.status(404).json({ message: "Liste bulunamadı." });

    const { name, description, isPrivate } = req.body;
    if (name !== undefined)        list.name        = name.trim();
    if (description !== undefined) list.description = description.trim();
    if (isPrivate !== undefined)   list.isPrivate   = !!isPrivate;

    await list.save();
    res.json({ list });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Bu isimde zaten bir listen var." });
    }
    console.error(err);
    res.status(500).json({ message: "Güncellenemedi." });
  }
});

// DELETE /api/reading-lists/:id  — listeyi sil
router.delete("/:id", ensureAuth, async (req, res) => {
  try {
    const result = await ReadingList.deleteOne({ _id: req.params.id, owner: req.user.id });
    if (result.deletedCount === 0) return res.status(404).json({ message: "Liste bulunamadı." });
    res.json({ message: "Liste silindi." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Silinemedi." });
  }
});

/* ════════════════════════
   LİSTEYE ESER EKLE / ÇIKAR
════════════════════════ */

// POST /api/reading-lists/:id/works  — eser ekle
router.post("/:id/works", ensureAuth, async (req, res) => {
  const { workId, note } = req.body;
  if (!workId) return res.status(400).json({ message: "workId zorunludur." });

  try {
    const list = await ReadingList.findOne({ _id: req.params.id, owner: req.user.id });
    if (!list) return res.status(404).json({ message: "Liste bulunamadı." });

    // Zaten eklenmiş mi?
    const already = list.works.some(w => String(w.work) === String(workId));
    if (already) return res.status(409).json({ message: "Bu eser zaten listede." });

    // Eser var mı?
    const work = await Work.findById(workId).select("_id");
    if (!work) return res.status(404).json({ message: "Eser bulunamadı." });

    list.works.push({ work: workId, note: note?.trim() ?? "" });
    await list.save();

    const populated = await populateList(ReadingList.findById(list._id));
    res.json({ list: populated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Eklenemedi." });
  }
});

// DELETE /api/reading-lists/:id/works/:workId  — eser çıkar
router.delete("/:id/works/:workId", ensureAuth, async (req, res) => {
  try {
    const list = await ReadingList.findOne({ _id: req.params.id, owner: req.user.id });
    if (!list) return res.status(404).json({ message: "Liste bulunamadı." });

    const before = list.works.length;
    list.works = list.works.filter(w => String(w.work) !== String(req.params.workId));
    if (list.works.length === before) {
      return res.status(404).json({ message: "Eser listede yok." });
    }

    await list.save();
    res.json({ message: "Eser listeden çıkarıldı." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Çıkarılamadı." });
  }
});

/* ════════════════════════
   BAŞKA BİR KULLANICININ LİSTELERİ (public)
════════════════════════ */

// GET /api/reading-lists/user/:userId  — başkasının herkese açık listeleri
router.get("/user/:userId", async (req, res) => {
  try {
    const lists = await populateList(
      ReadingList.find({ owner: req.params.userId, isPrivate: false }).sort({ updatedAt: -1 })
    );
    res.json({ items: lists });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Listeler yüklenemedi." });
  }
});

export default router;