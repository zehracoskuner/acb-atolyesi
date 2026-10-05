import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { validateDrawing } from "../../shared/drawingProtocol.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadDrawingSnapshot(snapshot, workId) {
  validateDrawing(snapshot);
  const buffer = Buffer.from(JSON.stringify(snapshot), "utf8");
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      public_id: `acb-drawings/${workId}/${randomUUID()}`,
      resource_type: "raw", format: "json", overwrite: false,
    }, (error, result) => error ? reject(error) : resolve({ url: result.secure_url, publicId: result.public_id }));
    stream.on("error", reject);
    Readable.from(buffer).pipe(stream);
  });
}

export async function deleteDrawingSnapshot(publicId) {
  if (!publicId) return;
  try { await cloudinary.uploader.destroy(publicId, { resource_type: "raw" }); }
  catch (error) { console.warn("Çizim dosyası temizlenemedi:", error.message); }
}
