// UTF-8 JSON snapshot limit; leaves room for request metadata below the 10 MiB parser.
export const MAX_DRAWING_BYTES = 9 * 1024 * 1024;
export const DRAWING_BODY_LIMIT = 10 * 1024 * 1024;
export function validateDrawing(snapshot) {
  const doc = snapshot?.document || snapshot;
  if (!doc || typeof doc !== "object" || !doc.store || !doc.schema || Array.isArray(doc.store)) {
    throw Object.assign(new Error("Çizim verisi geçersiz."), { status: 400 });
  }
  if (new TextEncoder().encode(JSON.stringify(snapshot)).length > MAX_DRAWING_BYTES) {
    throw Object.assign(new Error("Çizim 9 MiB sınırını aşıyor. Büyük görselleri küçültüp tekrar deneyin."), { status: 413 });
  }
}
