import { normalizeChapterMedia } from "../../shared/chapterMedia.js";
import { assertImageAllowed, ownedImage } from "./imageAssets.js";

export async function validateChapterMedia(media, userId, session, current = []) {
  let normalized;
  try { normalized = normalizeChapterMedia(media); }
  catch (error) { throw Object.assign(error, { status: 400 }); }
  const images = normalized.filter(item => item.type === "image");
  if (images.some(item => !current.some(old => old.type === "image" && old.url === item.url)))
    await assertImageAllowed(userId, session);
  for (const item of images) await ownedImage(item.url, userId, session);
  return normalized;
}
