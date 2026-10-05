import mongoose from "mongoose";
import Work from "../models/Work.js";

export default function ensureWorkOwner(getWorkId) {
  return async (req, res, next) => {
    try {
      const workId = await getWorkId(req);
      if (typeof workId !== "string" || !mongoose.isObjectIdOrHexString(workId))
        return res.status(400).json({ message: "Geçersiz eser ID." });
      const work = await Work.findOne({ _id: workId, user: req.user.id }).select("_id");
      if (!work) return res.status(404).json({ message: "Eser bulunamadı veya yetkiniz yok." });
      return next();
    } catch (err) { return next(err); }
  };
}
