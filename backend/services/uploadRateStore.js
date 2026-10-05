import mongoose from "mongoose";

const COLLECTION = "upload_rate_limits";
function collection() {
  if (mongoose.connection.readyState !== 1) throw new Error("Upload quota database unavailable");
  return mongoose.connection.db.collection(COLLECTION);
}

export async function prepareUploadRateLimits() {
  await collection().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}

// Both upload counters are shared by all processes using the application's DB.
// Mongo's server clock and single-document update avoid read/increment races.
export class UploadRateStore {
  localKeys = false;
  constructor(prefix) { this.prefix = prefix; }
  init(options) { this.windowMs = options.windowMs; }
  async increment(key) {
    const expired = { $lte: [{ $ifNull: ["$expiresAt", new Date(0)] }, "$$NOW"] };
    const update = [{ $set: {
      hits: { $cond: [expired, 1, { $add: ["$hits", 1] }] },
      expiresAt: { $cond: [expired, { $add: ["$$NOW", this.windowMs] }, "$expiresAt"] },
    } }];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const row = await collection().findOneAndUpdate({ _id: this.prefix + key }, update, {
          upsert: true, returnDocument: "after", includeResultMetadata: false,
          writeConcern: { w: "majority", wtimeout: 5000 }, maxTimeMS: 5000,
        });
        return { totalHits: row.hits, resetTime: row.expiresAt };
      } catch (error) {
        // Concurrent creation may race on the built-in unique _id index.
        if (error.code !== 11000 || attempt === 2) throw error;
      }
    }
  }
  async decrement() {
    throw new Error("Upload attempts are never refunded");
  }
  async resetKey(key) { await collection().deleteOne({ _id: this.prefix + key }); }
}
