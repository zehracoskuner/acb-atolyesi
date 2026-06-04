import express from "express";
import ensureAuth from "../middlewares/ensureAuth.js";
import {
  trackProgress,
  getMyProgress,
  getProgressByStory,
} from "../controllers/readingProgressController.js";

const router = express.Router();

router.post("/",          ensureAuth, trackProgress);
router.get("/",           ensureAuth, getMyProgress);
router.get("/:storyId",   ensureAuth, getProgressByStory);

export default router;