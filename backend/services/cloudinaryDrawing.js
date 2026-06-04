// backend/services/cloudinaryDrawing.js
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

// Cloudinary config zaten cloudinary.js'de yapılıyor,
// ama burada da garantiye alalım
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Tldraw snapshot objesini Cloudinary'e JSON dosyası olarak yükler.
 * Aynı publicId varsa üzerine yazar (invalidate: true).
 *
 * @param {object} snapshot  - tldraw getSnapshot() çıktısı
 * @param {string} workId    - eser ID'si (dosya adı için)
 * @param {string|null} existingPublicId - varsa üzerine yaz
 * @returns {{ url: string, publicId: string }}
 */
export async function uploadDrawingSnapshot(snapshot, workId, existingPublicId = null) {
  const jsonString = JSON.stringify(snapshot);
  const buffer     = Buffer.from(jsonString, "utf-8");

  // public_id: aynı kalırsa Cloudinary üzerine yazar
  const publicId = existingPublicId || `acb-drawings/${workId}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id:     `acb-drawings/${workId}`,
        resource_type: "raw",        // JSON dosyası
        format:       "json",
        overwrite:    true,
        invalidate:   true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url:      result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    // Buffer'ı stream'e çevir ve pipe et
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
}

/**
 * Cloudinary'den drawing dosyasını siler.
 * @param {string} publicId
 */
export async function deleteDrawingSnapshot(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
  } catch (err) {
    console.warn("Cloudinary drawing silinemedi:", err.message);
  }
}