import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import Chapter from "../models/Chapter.js";
import Fingerprint from "../models/DevelopmentFingerprint.js";
import { plainWords, textHash } from "../services/developmentWriting.js";

// Read the retired collection directly. The application never registers a
// model for it or accesses it during normal requests.
export async function migrateChapterDevelopment(connection, { apply = false } = {}) {
  const chapters = connection.db.collection(Chapter.collection.name);
  const versions = connection.db.collection("chapterversions");
  const fingerprints = connection.db.collection(Fingerprint.collection.name);
  const pending = { developmentWordHighWater: null };
  const result = { chaptersWithHistory: 0, initialized: 0 };
  for await (const { _id } of chapters.find(pending, { projection: { _id: 1 } })) {
    if (!await versions.findOne({ chapter: _id }, { projection: { _id: 1 } })) continue;
    result.chaptersWithHistory++;
    if (!apply) continue;

    const initialized = await connection.transaction(async session => {
      const filter = { _id, ...pending };
      const chapter = await chapters.findOne(filter, {
        session, projection: { work: 1, content: 1, "draftContent.content": 1 },
      });
      if (!chapter) return false;

      let highWater = 0;
      const hashes = new Set();
      const remember = content => {
        const words = plainWords(content ?? "");
        highWater = Math.max(highWater, words.length);
        if (words.length) hashes.add(textHash(words.join(" ")));
      };
      remember(chapter.draftContent?.content ?? chapter.content);
      for await (const version of versions.find({ chapter: _id }, { session, projection: { content: 1 } })) {
        remember(version.content);
      }
      if (hashes.size) {
        await fingerprints.bulkWrite([...hashes].map(hash => ({
          updateOne: {
            filter: { workId: chapter.work, hash },
            update: { $setOnInsert: { workId: chapter.work, hash } },
            upsert: true,
          },
        })), { session });
      }
      await chapters.updateOne(filter, { $set: { developmentWordHighWater: highWater } }, { session });
      return true;
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" });

    if (initialized) result.initialized++;
  }
  return result;
}

async function main() {
  const mode = process.argv[2];
  const { MONGO_URI, CHAPTER_MIGRATION_DATABASE } = process.env;
  if (!MONGO_URI || !CHAPTER_MIGRATION_DATABASE || !["--dry-run", "--apply"].includes(mode)) {
    throw new Error("Provide MONGO_URI, CHAPTER_MIGRATION_DATABASE and --dry-run or --apply.");
  }
  try {
    await mongoose.connect(MONGO_URI, { autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 8000 });
    if (mongoose.connection.name !== CHAPTER_MIGRATION_DATABASE) throw new Error("Unexpected database name.");
    if (mode === "--apply") {
      const indexes = await mongoose.connection.db.collection(Fingerprint.collection.name).indexes();
      if (!indexes.some(index => index.unique && JSON.stringify(index.key) === '{"workId":1,"hash":1}')) {
        throw new Error("The unique development fingerprint index is required.");
      }
    }
    console.log(await migrateChapterDevelopment(mongoose.connection, { apply: mode === "--apply" }));
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error instanceof mongoose.Error ? error.name : error.message);
    process.exitCode = 1;
  });
}
