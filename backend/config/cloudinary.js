// backend/config/cloudinary.js

import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

// Cloudinary bağlantı ayarları
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Depolama ayarları (Hangi klasöre, hangi formatta kaydedilecek)
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "acb-atolye-covers", // Cloudinary'de bu isimde klasör açar
    allowed_formats: ["jpg", "png", "jpeg", "webp"], // İzin verilen formatlar
    transformation: [{ width: 800, height: 1200, crop: "limit" }], // Otomatik boyutlandırma (opsiyonel)
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const izinliTipler = ["image/jpeg", "image/png", "image/webp"];
    if (!izinliTipler.includes(file.mimetype)) {
      return cb(new Error("Sadece JPG, PNG ve WebP yüklenebilir."));
    }
    cb(null, true);
  },
});
export default upload;