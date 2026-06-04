// backend/routes/works.js
import express from "express";
import ensureAuth from "../middlewares/ensureAuth.js";
import Work from "../models/Work.js";
import Chapter from "../models/Chapter.js";

const router = express.Router();

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

  const isPopulated = obj.user && typeof obj.user === "object" && obj.user._id;

  const author = obj.isAnonymous
    ? {
        _id:          isPopulated ? obj.user._id : obj.user,
        kullaniciAdi: "Anonim Yazar",
        username:     "anonim",
        avatarUrl:    null,
      }
    : isPopulated
      ? obj.user
      : { _id: obj.user };

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
router.post("/", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ message: "Giriş yapılmamış." });

    const { title, genres, description, coverImage } = req.body || {};

    const sanitizedGenres = Array.isArray(genres)
      ? genres.filter((g) => ALL_GENRES.includes(g)).slice(0, 5)
      : [];

    const work = await Work.create({
      user:        userId,
      title:       title?.trim() || "Yeni Çalışma",
      description: description || "",
      coverImage:  coverImage || "",
      status:      "draft",
      universe:    { genres: sanitizedGenres },
    });

    await work.populate("user", USER_POPULATE);
    return res.status(201).json({ item: serializeWork(work) });
  } catch (err) {
    console.error("POST /works error:", err);
    return res.status(500).json({ message: "Çalışma oluşturulamadı." });
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
        .select("title description coverImage universe status likeCount user isAnonymous createdAt"),
      Work.countDocuments(filter),
    ]);

    return res.json({
      items: works.map(serializeWork),
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

    const chapters = await Chapter.find({ work: req.params.id }).sort({ order: 1 });

    return res.json({ items: chapters });
  } catch (err) {
    console.error("GET /works/:id/chapters error:", err);
    return res.status(500).json({ message: "Bölümler yüklenemedi." });
  }
});

// ── PATCH /api/works/:id ─────────────────────────────────────────────────────
router.patch("/:id", ensureAuth, async (req, res) => {
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

    if (title !== undefined)          work.title          = title.trim() || work.title;
    if (description !== undefined)    work.description    = description;
    if (preface !== undefined)        work.preface        = preface;
    if (isAnonymous !== undefined)    work.isAnonymous    = isAnonymous;
    if (contentWarning !== undefined) work.contentWarning = contentWarning;
    if (coverImage !== undefined)     work.coverImage     = coverImage;
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

    // ── GÜVENLİK: yayın listesine asla körü körüne güvenme ─────────────────
    // Yalnızca bu esere ait + status:"published" (moderasyondan geçmiş)
    // bölümlerin ID'leri listeye girebilir. Böylece modal'dan taslak/reddedilmiş
    // bölüm ID'si eklenerek moderasyon atlatılamaz.
    if (publishedChapterIds !== undefined) {
      const istenen = (Array.isArray(publishedChapterIds) ? publishedChapterIds : []).map(String);
      const gecerli = await Chapter.find({
        _id: { $in: istenen }, work: work._id, status: "published",
      }).select("_id");
      const gecerliSet = new Set(gecerli.map((c) => c._id.toString()));
      work.publishedChapterIds = istenen.filter((id) => gecerliSet.has(id)); // sıra korunur
    }

    // ── TEK KURAL: 0 published → draft, 1+ published → published ──────────
    // status frontend'den gelse bile yok sayılır, daima listeden türetilir.
    work.status = (work.publishedChapterIds?.length ?? 0) > 0 ? "published" : "draft";

    await work.save();
    await work.populate("user", USER_POPULATE);

    return res.json({ message: "Çalışma güncellendi.", item: serializeWork(work) });
  } catch (err) {
    console.error("PATCH /works/:id error:", err);
    return res.status(500).json({ message: "Güncelleme sırasında bir hata oluştu." });
  }
});

// ── PUT /api/works/:id/unpublish-all ────────────────────────────────────────
router.put("/:id/unpublish-all", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    const eser = await Work.findOne({ _id: req.params.id, user: userId });
    if (!eser) return res.status(404).json({ message: "Eser bulunamadı veya yetkiniz yok." });

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