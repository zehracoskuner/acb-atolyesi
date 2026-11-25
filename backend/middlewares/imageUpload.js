import multer from "multer";
import sharp from "sharp";
import { optimizePortrait } from "../services/characterPortraits.js";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 40_000_000; // Includes every frame of animated images.
const MIME = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

export function imageUpload(field, formats = Object.keys(MIME), { maxBytes = MAX_IMAGE_BYTES, portrait = false } = {}) {
  const receive = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes + (portrait ? 1 : 0), files: 1, fields: 0, parts: 2 },
  }).single(field);

  return (req, res, next) => receive(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.code === "LIMIT_FILE_SIZE"
      ? `Dosya ${maxBytes / 1024 / 1024} MB'dan büyük olamaz.` : "Geçersiz dosya yükleme isteği." });
    if (!req.file) return res.status(400).json({ message: "Resim yüklenemedi." });
    if (req.file.size > maxBytes) return res.status(400).json({ message: `Dosya ${maxBytes / 1024 / 1024} MB'dan büyük olamaz.` });
    try {
      const options = { failOn: "warning", limitInputPixels: MAX_PIXELS, animated: true };
      const meta = await sharp(req.file.buffer, options).metadata();
      if (!formats.includes(meta.format) || MIME[meta.format] !== req.file.mimetype ||
          !meta.width || !meta.height ||
          meta.width * (meta.pageHeight || meta.height) * (meta.pages || 1) > MAX_PIXELS ||
          (meta.pages || 1) > (portrait ? 1 : 200)) throw new Error("Invalid image");
      // Decode all pixels/frames, strip metadata and trailing payloads, and encode
      // the same supported format. Metadata/signature checks alone are insufficient.
      const format = portrait ? "webp" : meta.format;
      const buffer = portrait ? await optimizePortrait(req.file.buffer) :
        await sharp(req.file.buffer, options).rotate().timeout({ seconds: 10 }).toFormat(format).toBuffer();
      if (buffer.length > maxBytes) throw new Error("Image too large");
      req.file.buffer = buffer;
      req.file.size = buffer.length;
      req.file.mimetype = MIME[format];
    } catch {
      return res.status(400).json({ message: "Geçersiz, bozuk veya çok büyük görsel. Dosya türü içeriğiyle eşleşmelidir." });
    }
    next();
  });
}
