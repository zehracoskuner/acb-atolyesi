import express      from "express";
import cors         from "cors";
import cookieParser from "cookie-parser";
import "dotenv/config";
import helmet       from "helmet";
import { connectDB } from "./config/db.js";
import passport      from "passport";
import "./config/passport.js";
import "./config/passport-google.js";
import ensureAuth from "./middlewares/ensureAuth.js";

// ── Rate limiters ──
import {
  generalLimiter,
  authLimiter,
  registerLimiter,
  writeLimiter,
  aiLimiter,
  uploadLimiter,
} from "./middlewares/rateLimiter.js";

// ── Routes ──
import authRoutes           from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import requireRole from "./middlewares/requireRole.js";
import userRoutes           from "./routes/user.js";
import profileRoutes        from "./routes/profile.js";
import worksRoutes          from "./routes/works.js";
import chapterRoutes        from "./routes/chapter.js";
import charactersRoutes     from "./routes/characters.js";
import relationshipsRoutes  from "./routes/relationships.js";
import plotsRoutes          from "./routes/plots.js";
import worldRouter          from "./routes/world.js";
import drawingRouter        from "./routes/drawing.js";
import beatsRoutes          from "./routes/beats.js";
import notesRoutes          from "./routes/notes.js";
import workNotesRoutes      from "./routes/workNotes.js";
import storyRoutes          from "./routes/stories.js";
import uploadRoutes         from "./routes/upload.js";
import publicRouter         from "./routes/public.js";
import libraryRouter        from "./routes/library.js";
import likesRouter          from "./routes/likes.js";
import commentsRouter       from "./routes/comments.js";
import notificationsRouter  from "./routes/notifications.js";
import chapterLikesRouter   from "./routes/chapterLikes.js";
import readingProgressRoutes from "./routes/readingProgress.js";
import logsRouter           from "./routes/log.js";
import feedRouter           from "./routes/feed.js";
import searchRouter         from "./routes/search.js";
import aiRoutes             from "./routes/ai.js";
import inlineCommentsRouter from "./routes/inlineComments.js";
import quotesRouter from "./routes/quotes.js";
import readingListsRoutes   from "./routes/readingLists.js";
import reportsRouter from "./routes/reports.js";
import moderatorRouter from "./routes/moderator.js";
import adminReportsRouter from "./routes/adminReports.js";

// ══════════════════════════════════════════
connectDB();

const app  = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === "production";
const adminPath = process.env.ADMIN_SECRET_PATH;
if (!adminPath) throw new Error("ADMIN_SECRET_PATH .env'de tanımlı değil");

app.set("trust proxy", 1);

// ── Güvenlik başlıkları ──
app.use(helmet());
app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true }));

// ── CORS ──
app.use(cors({
  origin:         process.env.CLIENT_URL || "http://localhost:5173",
  credentials:    true,
  methods:        ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));


// ── Body / Cookie ──
// Upload ve Drawing hariç tüm endpointler için küçük limit
app.use((req, res, next) => {
  if (req.path.startsWith("/api/upload")) return next();
  if (req.path.startsWith("/api/drawing")) return next(); // ← ekle
  express.json({ limit: "50mb" })(req, res, next);
});
app.use((req, res, next) => {
  if (req.path.startsWith("/api/upload")) return next();
  if (req.path.startsWith("/api/drawing")) return next(); // ← ekle
  express.urlencoded({ limit: "50mb", extended: true })(req, res, next);
});

// ── NoSQL injection koruması ──
// MongoDB injection sanitize — express-mongo-sanitize yerine
const sanitizeValue = (v) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return Object.fromEntries(
      Object.entries(v)
        .filter(([k]) => !k.startsWith('$'))
        .map(([k, val]) => [k, sanitizeValue(val)])
    );
  }
  return v;
};

app.use((req, res, next) => {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
});


// Upload için büyük limit
app.use("/api/upload", express.json({ limit: "50mb" }));
app.use("/api/upload", express.urlencoded({ limit: "50mb", extended: true }));

// Drawing için — tldraw snapshot büyük olabiliyor
app.use("/api/drawing", express.json({ limit: "50mb" })); // ← ekle
app.use("/api/drawing", express.urlencoded({ limit: "50mb", extended: true })); // ← ekle

app.use(cookieParser());

// ── Passport ──
app.use(passport.initialize());

// ── Health ──
app.get("/api/health", (_, res) =>
  res.json({ ok: true, msg: "ACB Atölyesi ayakta ✅" })
);

// ── Rate limit — auth (genel limiter'dan önce, daha kısıtlayıcı) ──
app.use("/api/auth/login",    authLimiter);
app.use("/api/auth/register", registerLimiter);
app.set("trust proxy", 1);

// ── Upload (limiterli, auth gerektirmez) ──
app.use("/api/upload", uploadLimiter);
app.use("/api/upload", uploadRoutes);

// ── Public (auth gerektirmez) ──
app.use("/api/public", publicRouter);

// ── Auth ──
app.use("/api/auth", authRoutes);
app.use(`/api/${adminPath}`, ensureAuth, requireRole("admin"), adminRoutes);

app.use("/api/moderator", ensureAuth, requireRole("admin", "moderator"), moderatorRouter);

// ── Genel API limiti — tüm /api/* için ──
app.use("/api", generalLimiter);

// ── Write limitli route'lar ──
app.use("/api/logs",     writeLimiter);
app.use("/api/comments", (req, res, next) => {
  if (["POST", "PATCH", "DELETE"].includes(req.method)) {
    return writeLimiter(req, res, next);
  }
  next();
});
app.use("/api/likes",    writeLimiter);
app.use("/api/inline-comments", (req, res, next) => {
  if (["POST", "PATCH", "DELETE"].includes(req.method)) return writeLimiter(req, res, next);
  next();
});
app.use("/api/quotes", (req, res, next) => {
  if (["POST", "DELETE"].includes(req.method)) return writeLimiter(req, res, next);
  next();
});

// ── AI (ayrı limiter) ──
app.use("/api/ai", aiLimiter);
app.use("/api/ai", aiRoutes);

// ── Kullanıcı & Profil ──
app.use("/api/user",    userRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/reading-lists", readingListsRoutes);

// ── Eser & İçerik ──
app.use("/api/works",         worksRoutes);
app.use("/api/chapters",      chapterRoutes);
app.use("/api/chapters",      chapterLikesRouter);
app.use("/api/characters",    charactersRoutes);
app.use("/api/relationships", relationshipsRoutes);
app.use("/api/stories",       storyRoutes);
app.use("/api/quotes", quotesRouter);

// ── Plot & Dünya ──
app.use("/api/plots",   plotsRoutes);
app.use("/api/world",   worldRouter);
app.use("/api/drawing", drawingRouter);

// ── Beats & Notlar ──
app.use("/api/beats",              beatsRoutes);
app.use("/api/notes",              notesRoutes);
app.use("/api/works/:workId/notes", workNotesRoutes);

// ── Sosyal ──
app.use("/api/library",          libraryRouter);
app.use("/api/likes",            likesRouter);
app.use("/api/comments",         commentsRouter);
app.use("/api/notifications",    notificationsRouter);
app.use("/api/reading-progress", readingProgressRoutes);
app.use("/api/inline-comments",  inlineCommentsRouter);

// ── Feed & Arama ──
app.use("/api/logs",   logsRouter);
app.use("/api/feed",   feedRouter);
app.use("/api/search", searchRouter);

// ---Reports----
app.use("/api/reports", ensureAuth, reportsRouter);
app.use("/api/admin/reports", ensureAuth, requireRole("admin", "moderator"), adminReportsRouter);

// ── 404 ──
app.use((req, res) =>
  res.status(404).json({ message: `${req.method} ${req.path} bulunamadı.` })
);

// ── Global hata yakalayıcı ──
// Production'da stack trace client'a gitmez, sadece sunucu loguna yazılır
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, err);
  res.status(err.status || 500).json({
    message: isProd ? "Beklenmeyen sunucu hatası." : err.message,
  });
});

app.listen(PORT, () =>
  console.log(`🚀 ACB Atölyesi ${PORT} portunda çalışıyor`)
);