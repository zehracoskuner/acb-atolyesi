import readerAccess from "../middlewares/readerAccess.js";
import express from "express";
import ensureAuth from "../middlewares/ensureAuth.js";
import {
  trackProgress,
  clearProgress,
  getMyProgress,
  getProgressByStory,
} from "../controllers/readingProgressController.js";

const router = express.Router();
router.use(readerAccess);

router.post("/",          ensureAuth, trackProgress);
router.get("/",           ensureAuth, getMyProgress);
router.get("/:storyId",   ensureAuth, getProgressByStory);

router.delete("/:storyId", ensureAuth, clearProgress);

export default router;