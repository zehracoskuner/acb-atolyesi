import { createHash } from "node:crypto";
import mongoose from "mongoose";

const { MONGO_URI, CHAPTER_MIGRATION_DATABASE } = process.env;
if (!MONGO_URI || !CHAPTER_MIGRATION_DATABASE) {
  throw new Error("Provide MONGO_URI and CHAPTER_MIGRATION_DATABASE.");
}

async function audit() {
  await mongoose.connect(MONGO_URI, { autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 8000 });
  if (mongoose.connection.name !== CHAPTER_MIGRATION_DATABASE) throw new Error("Unexpected database name.");
  const db = mongoose.connection.db;
  const chapterHash = createHash("sha256");
  const byStatus = {};
  let chapters = 0, privateDrafts = 0, reviewSubmissions = 0, missingContent = 0;

  const projection = {
    work: 1, status: 1, title: 1, content: 1, media: 1, revision: 1, publishedRevision: 1,
    hasUnpublishedChanges: 1, draftContent: 1, reviewSubmission: 1, reviewStatus: 1,
  };
  for await (const chapter of db.collection("chapters").find({}, { projection }).sort({ _id: 1 })) {
    chapters++;
    byStatus[chapter.status ?? "missing"] = (byStatus[chapter.status ?? "missing"] ?? 0) + 1;
    if (chapter.draftContent) privateDrafts++;
    if (chapter.reviewSubmission) reviewSubmissions++;
    if (typeof chapter.content !== "string") missingContent++;
    chapterHash.update(JSON.stringify(Object.keys({ _id: 1, ...projection }).map(key => chapter[key])) + "\n");
  }

  const [history] = await db.listCollections({ name: "chapterversions" }, { nameOnly: true }).toArray();
  const stats = history ? await db.command({ collStats: history.name }) : null;
  const versions = history ? await db.collection(history.name).countDocuments() : 0;
  console.log(JSON.stringify({
    database: db.databaseName, chapters, byStatus, privateDrafts, reviewSubmissions, missingContent,
    chapterSha256: chapterHash.digest("hex"),
    history: { exists: !!history, versions, dataBytes: stats?.size ?? 0,
      storageBytes: stats?.storageSize ?? 0, indexBytes: stats?.totalIndexSize ?? 0 },
  }, null, 2));
}

try {
  await audit();
} catch (error) {
  console.error("Chapter storage audit failed:", error.name, error.code ?? "");
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
