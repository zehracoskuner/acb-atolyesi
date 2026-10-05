import readerAccess from "../middlewares/readerAccess.js";
// backend/routes/works.js
import express from "express";
import mongoose from "mongoose";
import ensureAuth from "../middlewares/ensureAuth.js";
import Work from "../models/Work.js";
import Chapter from "../models/Chapter.js";
import { withImageChange } from "../services/imageAssets.js";
import uploadOrigin from '../middlewares/uploadOrigin.js';
import { readBookSnapshot } from "../services/bookSnapshot.js";
import { BOOK_TYPES, createBookFile } from "../services/bookExport.js";

import { PUBLIC_WORK_FIELDS, serializePublicWorkCard, serializeWorkAuthor } from "../services/publicWork.js";
import { getPublishedChapterIdsByWork } from "../services/publishedChapters.js";

const router = express.Router();
router.use(readerAccess);
function coverOrigin(req, res, next) {
  if (req.body?.coverImage !== undefined) return uploadOrigin(req, res, next);
  next();
}

router.put("/:id/chapter-order", ensureAuth, (_req, res) => {
  res.status(403).json({ code: "CHAPTER_ORDER_DISABLED", message: "Bölüm sıralaması şu anda değiştirilemiyor." });
});

router.get("/:id/download", ensureAuth, async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ message: "Giriş yapmanız gerekiyor." });
    const format = req.query.format;
    if (!mongoose.isObjectIdOrHexString(req.params.id) || typeof format !== "string" || !Object.hasOwn(BOOK_TYPES, format)) {
      return res.status(400).json({ message: "Geçersiz eser veya dosya biçimi." });
    }
    const snapshot = await readBookSnapshot(req.params.id, userId);
    const file = await createBookFile(snapshot, format);
    if (!file?.length) throw new Error("Boş dosya üretildi.");
    // Fixed ASCII fallback plus RFC 5987 title; never write private books to disk.
    const title = snapshot.title.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "_").slice(0, 100) || "Kitabim";
    const filename = encodeURIComponent(title.toWellFormed()).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16)}`);
    res.set("Content-Type", BOOK_TYPES[format]);
    res.set("Content-Disposition", `attachment; filename="Kitabim.${format}"; filename*=UTF-8''${filename}.${format}`);
    res.set("X-Content-Type-Options", "nosniff");
    return res.send(file);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.status === 404 ? error.message : "Kitap hazırlanamadı. Hiçbir dosya indirilmedi; lütfen tekrar deneyin." });
  }
});

const ALL_GENRES = [
  "Fantastik", "Bilim Kurgu", "Distopya / Ütopya", "Tarihi Kurgu",
  "Mitolojik Kurgu", "Alternatif Tarih",
  "Polisiye", "Psikolojik Gerilim", "Suç Kurgu", "Korku & Karanlık",
  "Gotik", "Gizem",
  "Romantizm", "Aile & Nesil", "Büyüme Romanı", "Trajedi", "Dram",
  "Mizah & Yergi", "Dini", "Spritüel",
  "Lirik Şiir", "Epik Şiir", "Deneme", "Anı & Otobiyografi", "Günlük",
  "Macera", "Seyahat Yazını", "Destansı Fantezi", "Açık Dünya",
];

const USER_POPULATE = "_id username kullaniciAdi avatarUrl";

function serializeWork(work) {
  const obj = work.toObject ? work.toObject({ virtuals: false }) : work;

  if (obj.customChapterTitles instanceof Map) {
    obj.customChapterTitles = Object.fromEntries(obj.customChapterTitles);
  }

  const author = serializeWorkAuthor(obj);

  return {
    _id:                 obj._id,
    id:                  obj._id,
    title:               obj.title,
    description:         obj.description,
    status:              obj.status,
    genres:              obj.universe?.genres ?? [],
    universe:            obj.universe ?? { genres: [], tone: "", rules: "", themes: "" },
    language:            obj.language ?? "tr",
    tags:                obj.tags ?? [],
    color:               obj.color ?? "purple",
    preface:             obj.preface ?? "",
    isAnonymous:         obj.isAnonymous ?? false,
    contentWarning:      obj.contentWarning ?? false,
    coverImage:          obj.coverImage || "",
    publishedChapterIds: obj.publishedChapterIds ?? [],
    customChapterTitles: obj.customChapterTitles ?? {},
    likeCount:           obj.likeCount ?? 0,
    createdAt:           obj.createdAt,
    updatedAt:           obj.updatedAt,
    author,
  };
}

// ── POST /api/works ──────────────────────────────────────────────────────────
router.post("/", ensureAuth, coverOrigin, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ message: "Giriş yapılmamış." });

    const { title, genres, description, coverImage, isAnonymous } = req.body || {};
    if (isAnonymous !== undefined && isAnonymous !== false) {
      return res.status(400).json({ message: "Yeni eserler anonim oluşturulamaz." });
    }

    const sanitizedGenres = Array.isArray(genres)
      ? genres.filter((g) => ALL_GENRES.includes(g)).slice(0, 5)
      : [];

    const work = await withImageChange(userId, coverImage, "", async session => {
      const data = {
      user:        userId,
      title:       title?.trim() || "Yeni Çalışma",
      description: description || "",
      coverImage:  coverImage || "",
      status:      "draft",
      isAnonymous: false,
      universe:    { genres: sanitizedGenres },
      };
      return session ? (await Work.create([data], { session }))[0] : Work.create(data);
    });

    await work.populate("user", USER_POPULATE);
    return res.status(201).json({ item: serializeWork(work) });
  } catch (err) {
    console.error("POST /works error:", err);
    return res.status(err.status || 500).json({ message: err.status ? err.message : "Çalışma oluşturulamadı.", code: err.code, until: err.until });
  }
});

// ── GET /api/works (kullanıcının kendi eserleri) ─────────────────────────────
router.get("/", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ message: "Giriş yapılmamış." });

    const works = await Work.find({ user: userId })
      .populate("user", USER_POPULATE)
      .sort({ updatedAt: -1 });

    return res.json({ items: works.map(serializeWork) });
  } catch (err) {
    console.error("GET /works error:", err);
    return res.status(500).json({ message: "Çalışmalar yüklenemedi." });
  }
});

// ── GET /api/works/discover ──────────────────────────────────────────────────
router.get("/discover", async (req, res) => {
  try {
    const { genres: genresParam, q, page = 1, limit = 20, sort = "newest" } = req.query;

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));

    const filter = { status: "published" };

    if (genresParam) {
      const genreList = genresParam
        .split(",")
        .map((g) => g.trim())
        .filter((g) => ALL_GENRES.includes(g));
      if (genreList.length) filter["universe.genres"] = { $in: genreList };
    }

    if (q?.trim()) {
      const regex = new RegExp(q.trim(), "i");
      filter.$or = [{ title: regex }, { description: regex }];
    }

    const sortMap = {
      newest:  { createdAt: -1 },
      popular: { likeCount: -1, createdAt: -1 },
    };

    const [works, total] = await Promise.all([
      Work.find(filter)
        .sort(sortMap[sort] || sortMap.newest)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate("user", USER_POPULATE)
        .select(PUBLIC_WORK_FIELDS),
      Work.countDocuments(filter),
    ]);

    const publishedIds = await getPublishedChapterIdsByWork(works);
    return res.json({
      items: works.map(work => serializePublicWorkCard(work, publishedIds.get(String(work._id)))),
      pagination: {
        total,
        page:       pageNum,
        limit:      limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("GET /works/discover error:", err);
    return res.status(500).json({ message: "Keşif yüklenemedi." });
  }
});

// ── GET /api/works/genres ────────────────────────────────────────────────────
router.get("/genres", async (req, res) => {
  try {
    const counts = await Work.aggregate([
      { $match: { status: "published" } },
      { $unwind: "$universe.genres" },
      { $group: { _id: "$universe.genres", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, genre: "$_id", count: 1 } },
    ]);

    const countMap = Object.fromEntries(counts.map((c) => [c.genre, c.count]));
    const genres   = ALL_GENRES.map((g) => ({ genre: g, count: countMap[g] || 0 }));

    return res.json({ genres });
  } catch (err) {
    console.error("GET /works/genres error:", err);
    return res.status(500).json({ message: "Türler yüklenemedi." });
  }
});

// ── GET /api/works/:id ───────────────────────────────────────────────────────
// NOT: /discover ve /genres'ten SONRA gelmeli ki :id onları yutmasın.
router.get("/:id", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ message: "Giriş yapılmamış." });

    const work = await Work.findOne({ _id: req.params.id, user: userId })
      .populate("user", USER_POPULATE);
    if (!work) return res.status(404).json({ message: "Çalışma bulunamadı." });

    return res.json({ item: serializeWork(work) });
  } catch (err) {
    console.error("GET /works/:id error:", err);
    return res.status(500).json({ message: "Çalışma yüklenemedi." });
  }
});

// ── DELETE /api/works/:id ────────────────────────────────────────────────────
router.delete("/:id", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ message: "Giriş yapılmamış." });

    const work = await Work.findById(req.params.id);
    if (!work) return res.status(404).json({ message: "Çalışma bulunamadı." });

    if (work.user?.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Bu çalışmayı silme yetkiniz yok." });
    }

    await Chapter.deleteMany({ work: req.params.id });
    await work.deleteOne();

    return res.json({ message: "Çalışma ve bölümleri silindi." });
  } catch (err) {
    console.error("DELETE /works/:id error:", err);
    return res.status(500).json({ message: "Çalışma silinemedi." });
  }
});

// ── GET /api/works/:id/chapters (sahibi için — tüm statüler) ─────────────────
router.get("/:id/chapters", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ message: "Giriş yapılmamış." });

    const work = await Work.findOne({ _id: req.params.id, user: userId });
    if (!work) return res.status(404).json({ message: "Çalışma bulunamadı veya yetkiniz yok." });

    const chapters = await Chapter.find({ work: req.params.id }).select("_id title order status revision savedAt updatedAt reviewNote").sort({ order: 1 });

    return res.json({ items: chapters.map(ch => ({ _id: ch._id, title: ch.title, order: ch.order, status: ch.status, revision: ch.revision ?? 0, savedAt: ch.savedAt, updatedAt: ch.updatedAt, reviewNote: ch.reviewNote || "" })) });
  } catch (err) {
    console.error("GET /works/:id/chapters error:", err);
    return res.status(500).json({ message: "Bölümler yüklenemedi." });
  }
});

// ── PATCH /api/works/:id ─────────────────────────────────────────────────────
router.patch("/:id", ensureAuth, coverOrigin, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ message: "Giriş yapılmamış." });

    const work = await Work.findOne({ _id: req.params.id, user: userId });
    if (!work) return res.status(404).json({ message: "Çalışma bulunamadı veya yetkiniz yok." });

    const {
      title, description, genres, language, tags, color,
      preface, isAnonymous, contentWarning,
      coverImage, publishedChapterIds, customChapterTitles,
      // status: bilerek alınmıyor — aşağıda publishedChapterIds'ten türetilir
    } = req.body;

    if (isAnonymous !== undefined && typeof isAnonymous !== "boolean") {
      return res.status(400).json({ message: "Geçersiz anonimlik tercihi." });
    }
    if (isAnonymous === true && !work.isAnonymous) {
      return res.status(400).json({ message: "Anonim yayına geçiş artık desteklenmiyor." });
    }
    if (work.isAnonymous && isAnonymous === false && req.body.confirmAuthorDisclosure !== true) {
      return res.status(400).json({ message: "Kullanıcı adınızın eserde ve profilinizde görünmesi için açık onayınız gerekiyor." });
    }

    // Listeyi ve sahipliği, eserin herhangi bir alanını değiştirmeden doğrula.
    let validatedPublishedIds;
    if (publishedChapterIds !== undefined) {
      if (!Array.isArray(publishedChapterIds) || publishedChapterIds.some(
        (id) => typeof id !== "string" || !mongoose.isObjectIdOrHexString(id)
      )) {
        return res.status(400).json({ message: "Geçersiz yayın listesi." });
      }
      const requestedIds = [...new Set(publishedChapterIds.map((id) => id.toLowerCase()))];
      const chapters = await Chapter.find({
        _id: { $in: requestedIds }, work: work._id, status: "published",
      }).select("_id");
      const validIds = new Set(chapters.map((chapter) => chapter._id.toString()));
      if (requestedIds.some((id) => !validIds.has(id))) {
        return res.status(400).json({ message: "Yayın listesi yalnızca bu esere ait yayındaki bölümleri içerebilir." });
      }
      validatedPublishedIds = requestedIds;
    }

    if (title !== undefined)          work.title          = title.trim() || work.title;
    if (description !== undefined)    work.description    = description;
    if (preface !== undefined)        work.preface        = preface;
    if (isAnonymous !== undefined)    work.isAnonymous    = isAnonymous;
    if (contentWarning !== undefined && typeof contentWarning !== "boolean") return res.status(400).json({ message: "Geçersiz içerik tercihi." });
    if (contentWarning !== undefined) work.contentWarning = contentWarning;
    const oldCoverImage = work.coverImage;
    if (coverImage !== undefined) { work.coverImage = coverImage; work.removedCoverCase = ''; }
    if (language !== undefined)       work.language       = language;
    if (tags !== undefined)           work.tags           = Array.isArray(tags) ? tags : [];
    if (color !== undefined)          work.color          = color;

    if (genres !== undefined) {
      work.universe.genres = Array.isArray(genres)
        ? genres.filter((g) => ALL_GENRES.includes(g)).slice(0, 5)
        : [];
    }

    if (customChapterTitles !== undefined) {
      work.customChapterTitles = new Map(Object.entries(customChapterTitles));
    }

    if (validatedPublishedIds !== undefined) work.publishedChapterIds = validatedPublishedIds;

    // ── TEK KURAL: 0 published → draft, 1+ published → published ──────────
    // status frontend'den gelse bile yok sayılır, daima listeden türetilir.
    work.status = (work.publishedChapterIds?.length ?? 0) > 0 ? "published" : "draft";

    await withImageChange(userId, coverImage, oldCoverImage, session => work.save(session ? { session } : undefined));
    await work.populate("user", USER_POPULATE);

    return res.json({ message: "Çalışma güncellendi.", item: serializeWork(work) });
  } catch (err) {
    console.error("PATCH /works/:id error:", err);
    return res.status(err.status || 500).json({ message: err.status ? err.message : "Güncelleme sırasında bir hata oluştu." });
  }
});

// ── PUT /api/works/:id/unpublish-all ────────────────────────────────────────
router.put("/:id/unpublish-all", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const eser = await Work.findOne({ _id: req.params.id, user: userId });
    if (!eser) return res.status(404).json({ message: "Eser bulunamadı veya yetkiniz yok." });

    await Chapter.updateMany({ work: eser._id, status: { $in: ['pending_review', 'rejected'] } }, { $set: { moderationHold: true } });
    const bolumSonuc = await Chapter.updateMany(
      { work: eser._id, status: { $in: ["published", "pending_review", "rejected"] } },
      { $set: { status: "draft", reviewNote: "" } }
    );

    eser.publishedChapterIds = [];
    eser.status              = "draft"; // liste boş → kurala uygun
    await eser.save();

    return res.json({
      message:        "Hikaye ve tüm bölümler taslağa alındı.",
      etkilenenBolum: bolumSonuc.modifiedCount,
    });
  } catch (err) {
    console.error("PUT /works/:id/unpublish-all hatası:", err);
    return res.status(500).json({ message: "Sunucu hatası." });
  }
});

export default router;
