import multer from "multer";
import sharp from "sharp";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 40_000_000; // Includes every frame of animated images.
const MIME = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

export function imageUpload(field, formats = Object.keys(MIME)) {
  const receive = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0, parts: 2 },
  }).single(field);

  return (req, res, next) => receive(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.code === "LIMIT_FILE_SIZE"
      ? "Dosya 5MB'dan büyük olamaz." : "Geçersiz dosya yükleme isteği." });
    if (!req.file) return res.status(400).json({ message: "Resim yüklenemedi." });
    try {
      const options = { failOn: "warning", limitInputPixels: MAX_PIXELS, animated: true };
      const meta = await sharp(req.file.buffer, options).metadata();
      if (!formats.includes(meta.format) || MIME[meta.format] !== req.file.mimetype ||
          !meta.width || !meta.height ||
          meta.width * (meta.pageHeight || meta.height) * (meta.pages || 1) > MAX_PIXELS ||
          (meta.pages || 1) > 200) throw new Error("Invalid image");
      // Decode all pixels/frames, strip metadata and trailing payloads, and encode
      // the same supported format. Metadata/signature checks alone are insufficient.
      const buffer = await sharp(req.file.buffer, options)
        .rotate().toFormat(meta.format).timeout({ seconds: 10 }).toBuffer();
      if (buffer.length > MAX_IMAGE_BYTES) throw new Error("Image too large");
      req.file.buffer = buffer;
      req.file.size = buffer.length;
      req.file.mimetype = MIME[meta.format];
    } catch {
      return res.status(400).json({ message: "Geçersiz, bozuk veya çok büyük görsel. Dosya türü içeriğiyle eşleşmelidir." });
    }
    next();
  });
}
