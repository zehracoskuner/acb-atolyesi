// backend/routes/upload.js
import express              from "express";
import ensureAuth from "../middlewares/ensureAuth.js";
import uploadOrigin from "../middlewares/uploadOrigin.js";
import { imageUpload } from "../middlewares/imageUpload.js";
import { uploadLimiter, uploadUserLimiter } from "../middlewares/rateLimiter.js";
import { v2 as cloudinary } from "cloudinary";
import streamifier          from "streamifier";
import { imagePermission, registerImage } from "../services/imageAssets.js";

const router = express.Router();

// Keep the IP quota and add an account quota before parsing any upload body.
router.use(uploadLimiter, uploadOrigin, ensureAuth, imagePermission, uploadUserLimiter);
router.use(express.json({ limit: "50mb" }));
router.use(express.urlencoded({ limit: "50mb", extended: true }));

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "acb-covers", resource_type: "image" },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.on("error", reject);
    streamifier.createReadStream(buffer).on("error", reject).pipe(stream);
  });
}

router.post("/", imageUpload("file"), async (req, res) => {
    try {
      const result = await uploadToCloudinary(req.file.buffer);
      const asset = await registerImage(req.user.id, req.file, result);
      return res.json({ assetId: asset._id, url: result.secure_url, message: "Resim başarıyla yüklendi!" });
    } catch (uploadErr) {
      console.error("Cloudinary yükleme hatası:", uploadErr.message);
      return res.status(uploadErr.status || 500).json({ message: uploadErr.status ? uploadErr.message : "Resim yüklenemedi, lütfen tekrar deneyin.", code: uploadErr.code, until: uploadErr.until });
    }
});

export default router;
