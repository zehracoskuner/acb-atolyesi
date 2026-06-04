import { Router } from "express";
import auth from "../middlewares/ensureAuth.js";
import { writeLimiter } from "../middlewares/rateLimiter.js";
import * as ctrl from "../controllers/chapterLikesController.js";

const router = Router();
router.post("/:chapterId/like",      writeLimiter, auth, ctrl.toggleChapterLike);
router.get("/:chapterId/like/check", auth, ctrl.checkChapterLike);

export default router;