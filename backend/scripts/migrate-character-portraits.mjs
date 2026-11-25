import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import { migrateCharacterPortraits } from "../services/portraitMigration.js";

// Default mode counts records. --copy keeps the bytes for the previous server
// version. Run --release-mongo after deploying Cloudinary portrait reads.
const mode = process.argv[2] || "--dry-run";
if (!["--dry-run", "--copy", "--release-mongo"].includes(mode) || process.argv.length > 3) {
  throw new Error("Use --dry-run, --copy or --release-mongo.");
}
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });
const { MONGO_URI, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
if (!MONGO_URI || (mode !== "--dry-run" && !(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET))) {
  throw new Error("Database and Cloudinary configuration required.");
}
cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET });

try {
  await mongoose.connect(MONGO_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 8000 });
  const totals = await migrateCharacterPortraits(mode);
  console.log(JSON.stringify(totals));
  if (totals.failed) process.exitCode = 1;
} catch (error) {
  const code = typeof error.code === "string" && /^[A-Z0-9_]+$/.test(error.code) ? ` ${error.code}` : "";
  console.error(`Migration stopped (${error.name}${code}).`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
