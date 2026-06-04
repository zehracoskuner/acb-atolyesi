// backend/routes/upload.js
import express              from "express";
import multer               from "multer";
import { v2 as cloudinary } from "cloudinary";
import streamifier          from "streamifier";
import { moderateCover }    from "../utils/aiModerator.js";

const router = express.Router();

const memStorage = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.mimetype))
      return cb(new Error("Sadece JPEG, PNG, WEBP veya GIF yüklenebilir."));
    cb(null, true);
  },
});

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "acb-covers" },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

router.post("/", (req, res) => {
  memStorage.single("file")(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE")
        return res.status(400).json({ message: "Dosya 5MB'dan büyük olamaz." });
      return res.status(400).json({ message: err.message });
    }
    if (err)        return res.status(400).json({ message: err.message });
    if (!req.file)  return res.status(400).json({ message: "Resim yüklenemedi." });

    // moderateCover { severity, violations, reason } döndürür — "safe" YOK
    try {
      const modResult = await moderateCover(req.file.buffer, req.file.mimetype);
      if (modResult.severity === "reject") {
        return res.status(400).json({
          message:  `Kapak fotoğrafı uygun değil: ${modResult.reason || "Uygunsuz içerik tespit edildi."}`,
          rejected: true,
        });
      }
      // clean + review geçer (kapak prompt'u şüphede asla reject yapmıyor)
    } catch (aiErr) {
      console.error("Kapak AI kontrolü hatası:", aiErr.message);
      // AI hatası yüklemeyi engellemesin
    }

    try {
      const result = await uploadToCloudinary(req.file.buffer);
      return res.json({ url: result.secure_url, message: "Resim başarıyla yüklendi!" });
    } catch (uploadErr) {
      console.error("Cloudinary yükleme hatası:", uploadErr.message);
      return res.status(500).json({ message: "Resim yüklenemedi, lütfen tekrar deneyin." });
    }
  });
});

export default router;