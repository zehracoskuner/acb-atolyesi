import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";
import ImageAsset from "../models/ImageAsset.js";
import { PORTRAIT_MAX_EDGE, PORTRAIT_MAX_INPUT_BYTES, PORTRAIT_TARGET_BYTES } from "../../shared/characterPortrait.js";

const delivery = { resource_type: "image", type: "authenticated" };
const namespace = "acb-character-portraits";

export async function optimizePortrait(bytes) {
  const { data, info } = await sharp(bytes, { failOn: "warning", limitInputPixels: 40_000_000 })
    .rotate().resize({ width: PORTRAIT_MAX_EDGE, height: PORTRAIT_MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .toColourspace("srgb").timeout({ seconds: 10 }).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  for (const quality of [85, 76, 66, 55]) {
    const encoded = await sharp(data, { raw: { width, height, channels } }).timeout({ seconds: 10 }).webp({ quality }).toBuffer();
    if (encoded.length <= PORTRAIT_TARGET_BYTES || quality === 55) return encoded;
  }
}

function providerError(code, cause) {
  const status = cause?.http_code ?? cause?.status;
  const detail = Number.isInteger(status) ? `_${status}` : "";
  return Object.assign(new Error("Portre depolama servisine şu anda erişilemiyor. Lütfen tekrar deneyin."),
    { status: 502, code: `${code}${detail}` });
}

function providerFields(result, publicId) {
  let url;
  try { url = new URL(result?.secure_url); }
  catch { throw providerError("PORTRAIT_PROVIDER_MISSING_URL"); }
  if (result.public_id !== publicId || !/^\d+$/.test(String(result.version))) throw providerError("PORTRAIT_PROVIDER_ID");
  if (url.origin !== "https://res.cloudinary.com" || url.search || url.hash) throw providerError("PORTRAIT_PROVIDER_UPLOAD_ORIGIN");
  const prefix = `/${cloudinary.config().cloud_name}/image/authenticated/`;
  if (!url.pathname.startsWith(prefix)) throw providerError("PORTRAIT_PROVIDER_UPLOAD_ACCESS_TYPE");
  const tail = url.pathname.slice(prefix.length).replace(/^s--[\w-]+--\//, "");
  if (tail !== `v${result.version}/${publicId}.webp`) throw providerError("PORTRAIT_PROVIDER_UPLOAD_PATH");
  url.pathname = prefix + tail;
  return { publicId, providerUrl: url.href, providerVersion: String(result.version) };
}

export async function uploadPortrait(assetId, bytes, { reuseExisting = false } = {}) {
  const publicId = `${namespace}/${assetId}`;
  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ ...delivery, public_id: publicId, overwrite: false, timeout: 12000 },
        (error, upload) => error ? reject(error) : resolve(upload));
      stream.on("error", reject);
      stream.end(bytes);
    });
    return providerFields(result, publicId);
  } catch (error) {
    if (reuseExisting) {
      try { return providerFields(await cloudinary.api.resource(publicId, delivery), publicId); }
      catch (existingError) {
        if (existingError.code?.startsWith("PORTRAIT_")) throw existingError;
      }
    }
    if (error.code?.startsWith("PORTRAIT_")) throw error;
    throw providerError("PORTRAIT_PROVIDER_UPLOAD", error);
  }
}

export async function discardPortraitUpload(assetId) {
  try { await cloudinary.uploader.destroy(`${namespace}/${assetId}`, { ...delivery, invalidate: true }); }
  catch { console.error("Unregistered portrait cleanup failed."); }
}

export async function readStoredPortrait(filter) {
  const scope = { ...filter, privatePortrait: true };
  const asset = await ImageAsset.findOne(scope).select("providerUrl publicId providerVersion").lean();
  return readPortraitAsset(asset, {
    loadLegacyBytes: async () => (await ImageAsset.findOne({ ...scope, _id: asset._id }).select("bytes"))?.bytes,
  });
}

export async function readPortraitAsset(asset, { requireProvider = false, loadLegacyBytes } = {}) {
  if (!asset) return null;
  const legacyBytes = () => requireProvider ? null : asset.bytes ?? loadLegacyBytes?.() ?? null;
  if (!asset.providerUrl) return legacyBytes();
  try {
    if (asset.publicId !== `${namespace}/${asset._id}` || !/^\d+$/.test(asset.providerVersion)) throw providerError("PORTRAIT_PROVIDER_METADATA");
    const url = cloudinary.url(asset.publicId, {
      ...delivery, format: "webp", version: asset.providerVersion, secure: true, sign_url: true,
    });
    const source = new URL(url);
    const prefix = `/${cloudinary.config().cloud_name}/image/authenticated/`;
    if (source.origin !== "https://res.cloudinary.com" || !source.pathname.startsWith(prefix)) throw providerError("PORTRAIT_PROVIDER_URL_INVALID");
    const response = await fetch(source, { redirect: "error", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw providerError("PORTRAIT_PROVIDER_DOWNLOAD", { status: response.status });
    if (response.headers.get("content-type")?.split(";")[0] !== "image/webp" || !response.body) throw providerError("PORTRAIT_PROVIDER_MIME");
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > PORTRAIT_MAX_INPUT_BYTES) throw providerError("PORTRAIT_PROVIDER_SIZE");
      chunks.push(chunk);
    }
    if (!size) throw providerError("PORTRAIT_PROVIDER_EMPTY");
    return Buffer.concat(chunks);
  } catch (error) {
    const bytes = await legacyBytes();
    if (bytes) return bytes;
    if (error.code?.startsWith("PORTRAIT_")) throw error;
    throw providerError("PORTRAIT_PROVIDER_DOWNLOAD", error);
  }
}
