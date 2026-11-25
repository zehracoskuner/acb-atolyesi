import ImageAsset from "../models/ImageAsset.js";
import Character from "../models/Character.js";
import ContentCase from "../models/ContentCase.js";
import { optimizePortrait, readPortraitAsset, uploadPortrait } from "./characterPortraits.js";
import { PORTRAIT_TARGET_BYTES } from "../../shared/characterPortrait.js";

export async function migrateCharacterPortraits(mode) {
  const totals = { inspected: 0, eligible: 0, detachedWithoutCase: 0, copied: 0, released: 0, alreadyCopied: 0, pending: 0, failed: 0, failureReasons: {} };
  const query = ImageAsset.find({ privatePortrait: true, bytes: { $exists: true } }).maxTimeMS(10000);
  if (mode !== "--dry-run") query.select("+bytes");
  for await (const asset of query.cursor()) {
    totals.inspected++;
    const [attached, evidence] = await Promise.all([
      Character.exists({ imageUrl: asset.url, user: asset.owner }).maxTimeMS(10000),
      ContentCase.exists({ asset: asset._id }).maxTimeMS(10000),
    ]);
    if (!attached && !evidence) { totals.detachedWithoutCase++; continue; }
    totals.eligible++;
    if (asset.providerUrl) totals.alreadyCopied++;
    else totals.pending++;
    if (mode === "--dry-run" || (mode === "--copy" && asset.providerUrl) || (mode === "--release-mongo" && !asset.providerUrl)) continue;
    try {
      const expected = asset.bytes.length > PORTRAIT_TARGET_BYTES ? await optimizePortrait(asset.bytes) : asset.bytes;
      const provider = asset.providerUrl ? asset : { _id: asset._id, ...await uploadPortrait(asset._id, expected, { reuseExisting: true }) };
      const verified = await readPortraitAsset(provider, { requireProvider: true });
      if (!verified?.equals(expected)) throw Object.assign(new Error("Cloudinary verification failed."), { code: "PORTRAIT_BYTES_MISMATCH" });
      const match = { _id: asset._id, privatePortrait: true, bytes: { $exists: true } };
      const result = mode === "--copy"
        ? await ImageAsset.updateOne({ ...match, providerUrl: { $exists: false } }, {
          $set: { providerUrl: provider.providerUrl, publicId: provider.publicId, providerVersion: provider.providerVersion },
        })
        : await ImageAsset.updateOne({ ...match, providerUrl: provider.providerUrl }, { $unset: { bytes: 1 } });
      if (result.modifiedCount) totals[mode === "--copy" ? "copied" : "released"]++;
    } catch (error) {
      totals.failed++;
      const reason = typeof error.code === "string" && error.code.startsWith("PORTRAIT_") ? error.code : "MIGRATION_OPERATION_FAILED";
      totals.failureReasons[reason] = (totals.failureReasons[reason] || 0) + 1;
    }
  }
  return totals;
}
