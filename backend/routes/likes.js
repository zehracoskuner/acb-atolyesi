import readerAccess from "../middlewares/readerAccess.js";
// routes/likes.js
import { Router } from "express";
import auth from "../middlewares/ensureAuth.js";
import * as ctrl from "../controllers/likesController.js";

const router = Router();
router.use(readerAccess);

router.post("/",             auth, ctrl.toggleLike);
router.get("/check/:workId", auth, ctrl.checkLike);
router.delete("/:workId",    auth, ctrl.unlike);

export default router;