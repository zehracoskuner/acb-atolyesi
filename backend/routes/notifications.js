import readerAccess from "../middlewares/readerAccess.js";
// routes/notifications.js
import { Router } from "express";
import auth from "../middlewares/ensureAuth.js";
import * as ctrl from "../controllers/notificationsController.js";
import webPush from './webPush.js';

const router = Router();
router.use(readerAccess);
router.use('/push', webPush);

router.get("/",           auth, ctrl.getNotifications);
router.patch("/read-all", auth, ctrl.markAllRead);
router.patch("/:id/read", auth, ctrl.markRead);

export default router;
