// routes/quotes.js
import express from "express";
import Quote   from "../models/Quote.js";
import ensureAuth from "../middlewares/ensureAuth.js";

const router = express.Router();

/* ────────────────────────────────────────
   POST /api/quotes
   Yeni alıntı kaydet
──────────────────────────────────────── */
router.post("/", ensureAuth, async (req, res) => {
  try {
    const { workId, text, workTitle, authorName, genre, tags } = req.body;

    if (!workId || !text?.trim()) {
      return res.status(400).json({ error: "workId ve text zorunludur." });
    }
    if (text.trim().length < 10) {
      return res.status(400).json({ error: "Alıntı en az 10 karakter olmalıdır." });
    }
    if (text.trim().length > 500) {
      return res.status(400).json({ error: "Alıntı en fazla 500 karakter olabilir." });
    }

    const quote = await Quote.create({
      user:       req.user.id,
      work:       workId,
      text:       text.trim(),
      workTitle:  workTitle || "Bilinmeyen Eser",
      authorName: authorName || "Anonim",
      genre:      genre || "belirtilmemiş",
      tags:       Array.isArray(tags) ? tags.slice(0, 10) : [],
    });

    return res.status(201).json({ item: quote });

  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Bu alıntıyı zaten kaydetmişsin." });
    }
    console.error("Quote POST hatası:", err);
    return res.status(500).json({ error: "Alıntı kaydedilemedi." });
  }
});

/* ────────────────────────────────────────
   GET /api/quotes/my
   Giriş yapmış kullanıcının alıntıları (tümü)
   ?page=1&limit=20&genre=roman&tag=karakter
──────────────────────────────────────── */
router.get("/my", ensureAuth, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const filter = { user: req.user.id };
    if (req.query.genre) filter.genre = req.query.genre;
    if (req.query.tag)   filter.tags  = req.query.tag;

    const [items, total] = await Promise.all([
      Quote.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Quote.countDocuments(filter),
    ]);

    return res.json({
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });

  } catch (err) {
    console.error("Quote GET /my hatası:", err);
    return res.status(500).json({ error: "Alıntılar yüklenemedi." });
  }
});

/* ────────────────────────────────────────
   GET /api/quotes/user/:userId
   Başka bir kullanıcının PUBLIC alıntıları
   (giriş gerekmez; gizli alıntı konsepti
    şu an modelde yok, tümü public sayılır)
   ?page=1&limit=20&genre=roman
──────────────────────────────────────── */
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Geçerli bir ObjectId mi?
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: "Geçersiz kullanıcı ID." });
    }

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const filter = { user: userId };
    if (req.query.genre) filter.genre = req.query.genre;
    if (req.query.tag)   filter.tags  = req.query.tag;

    const [items, total] = await Promise.all([
      Quote.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Quote.countDocuments(filter),
    ]);

    return res.json({
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });

  } catch (err) {
    console.error("Quote GET /user/:userId hatası:", err);
    return res.status(500).json({ error: "Alıntılar yüklenemedi." });
  }
});

/* ────────────────────────────────────────
   PATCH /api/quotes/:id/tags
   Alıntıya etiket ekle / güncelle
──────────────────────────────────────── */
router.patch("/:id/tags", ensureAuth, async (req, res) => {
  try {
    const { tags } = req.body;
    if (!Array.isArray(tags)) {
      return res.status(400).json({ error: "tags bir dizi olmalıdır." });
    }

    const quote = await Quote.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { tags: tags.slice(0, 10) },
      { new: true, runValidators: true }
    );

    if (!quote) return res.status(404).json({ error: "Alıntı bulunamadı." });
    return res.json({ item: quote });

  } catch (err) {
    console.error("Quote PATCH tags hatası:", err);
    return res.status(500).json({ error: "Etiketler güncellenemedi." });
  }
});

/* ────────────────────────────────────────
   DELETE /api/quotes/:id
   Alıntıyı sil (sadece sahibi)
──────────────────────────────────────── */
router.delete("/:id", ensureAuth, async (req, res) => {
  try {
    const quote = await Quote.findOneAndDelete({
      _id:  req.params.id,
      user: req.user.id,
    });

    if (!quote) return res.status(404).json({ error: "Alıntı bulunamadı." });
    return res.json({ success: true });

  } catch (err) {
    console.error("Quote DELETE hatası:", err);
    return res.status(500).json({ error: "Alıntı silinemedi." });
  }
});

export default router;