// backend/routes/comments.js
import express     from "express";
import {
  getComments,
  createComment,
  updateComment,
  deleteComment,
  likeComment,
  reportComment,
  getModerationQueue,
  moderateComment,
} from "../controllers/commentController.js";
import ensureAuth  from "../middlewares/ensureAuth.js";
import requireRole from "../middlewares/requireRole.js";

const router = express.Router();

/* ═══════════════════════════════════════════
   PUBLIC — Yorumları getir
   GET /api/comments/chapter/:chapterId
   GET /api/comments/work/:workId
   GET /api/comments/:id          ← frontend apiGet(`/comments/${id}`) için
═══════════════════════════════════════════ */
router.get("/chapter/:chapterId", getComments);
router.get("/work/:workId",       getComments);

/* ═══════════════════════════════════════════
   MODERATİF — sabit path'ler dinamiklerden önce gelmeli
═══════════════════════════════════════════ */
router.get(
  "/moderation/queue",
  ensureAuth, requireRole("admin", "moderator"),
  getModerationQueue
);
router.patch(
  "/:commentId/moderate",
  ensureAuth, requireRole("admin", "moderator"),
  moderateComment
);

/* ═══════════════════════════════════════════
   AUTH GEREKTİREN — Yorum oluştur
   POST /api/comments/chapter/:chapterId  ← bölüm yorumu (ReadPage)
   POST /api/comments/work/:workId        ← eser yorumu (StoryDetailsPage)
   POST /api/comments/:id                 ← genel (frontend hangi id gönderirse)
═══════════════════════════════════════════ */
router.post("/chapter/:chapterId", ensureAuth, createComment);
router.post("/work/:workId",       ensureAuth, createComment);

/* ═══════════════════════════════════════════
   AUTH GEREKTİREN — Yorum işlemleri
═══════════════════════════════════════════ */
router.patch("/:commentId",       ensureAuth, updateComment);
router.delete("/:commentId",      ensureAuth, deleteComment);
router.post("/:commentId/like",   ensureAuth, likeComment);
router.post("/:commentId/report", ensureAuth, reportComment);

/* ═══════════════════════════════════════════
   GENELLEŞTİRİLMİŞ — En sona koyulmalı
   Frontend apiGet(`/comments/${workIdOrChapterId}`) → workId veya chapterId olabilir
   Controller içinde hangisi olduğunu çözüyoruz
═══════════════════════════════════════════ */
router.get("/:id",  getComments);   // GET  /api/comments/:id
router.post("/:id", ensureAuth, createComment);  // POST /api/comments/:id

export default router;