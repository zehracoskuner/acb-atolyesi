import { v2 as cloudinary } from "cloudinary";
import "dotenv/config";
import { imagePermission, registerImage } from "../services/imageAssets.js";
import { imageUpload } from "../middlewares/imageUpload.js";
import { uploadUserLimiter } from "../middlewares/rateLimiter.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Used after ensureAuth by avatar/banner routes; preserve req.file.path.
export default {
  single(field) {
    return [imagePermission, uploadUserLimiter, imageUpload(field, ["jpeg", "png", "webp"]),
      async (req, res, next) => {
        try {
          const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream({
              folder: "acb-atolye-covers", resource_type: "image",
              transformation: [{ width: 800, height: 1200, crop: "limit" }],
            }, (error, result) => error ? reject(error) : resolve(result));
            stream.on("error", reject);
            stream.end(req.file.buffer);
          });
          await registerImage(req.user.id, req.file, result);
          req.file.path = result.secure_url;
          next();
        } catch (error) {
          res.status(error.status || 500).json({ message: error.status ? error.message : "Resim yüklenemedi, lütfen tekrar deneyin.", code: error.code, until: error.until });
        }
      }];
  },
};
