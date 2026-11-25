import { createHash } from 'node:crypto';
import { open, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { readImageEvidence, storeImageEvidence } from '../services/imageEvidence.js';

const [backupFile, mode] = process.argv.slice(2);
if (!backupFile || !['--backup', '--copy'].includes(mode) || process.argv.length !== 4) {
  throw new Error('Usage: node backend/scripts/copy-image-evidence.mjs <local BSON file> --backup|--copy');
}
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
const { MONGO_URI, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
if (!MONGO_URI || !(CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET)) {
  throw new Error('Atlas and Cloudinary configuration required');
}

const { MongoClient, BSON } = mongoose.mongo;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const publicImages = { privatePortrait: { $ne: true }, state: 'active', delivery: 'available',
  bytes: { $type: 'binData' }, url: /^https:\/\/res\.cloudinary\.com\//, publicId: { $type: 'string' } };

async function backup(assets, path) {
  const rows = await assets.find(publicImages, { maxTimeMS: 10000 }).sort({ _id: 1 }).toArray();
  if (!rows.length) throw new Error('No eligible public images');
  const hash = createHash('sha256');
  const file = await open(path, 'wx');
  try {
    for (const row of rows) {
      const data = BSON.serialize(row);
      await file.writeFile(data);
      hash.update(data);
    }
    await file.sync();
  } finally { await file.close(); }
  if (digest(await readFile(path)) !== hash.digest('hex')) throw new Error('Local BSON backup verification failed');
  console.log({ backedUp: rows.length, binaryBytes: rows.reduce((sum, row) => sum + row.bytes.length(), 0), path });
}

async function copy(assets, path) {
  const data = await readFile(path);
  const rows = [];
  for (let offset = 0; offset < data.length;) {
    const end = offset + data.readInt32LE(offset);
    if (end < offset + 5 || end > data.length) throw new Error('Invalid BSON backup');
    rows.push(BSON.deserialize(data.subarray(offset, end)));
    offset = end;
  }
  const totals = { eligible: rows.length, copied: 0, verifiedExisting: 0, failed: 0 };
  for (let first = 0; first < rows.length; first += 3) {
    await Promise.all(rows.slice(first, first + 3).map(async row => {
      try {
        const exact = { ...publicImages, _id: row._id, owner: row.owner, url: row.url, publicId: row.publicId, bytes: row.bytes };
        const current = await assets.findOne(exact, { projection: { evidence: 1 }, maxTimeMS: 5000 });
        if (!current) throw new Error('Image changed since backup');
        const bytes = Buffer.from(row.bytes.value());
        if (current.evidence) {
          if (!(await readImageEvidence(current.evidence)).equals(bytes)) throw new Error('Existing evidence mismatch');
          totals.verifiedExisting++;
          return;
        }
        const evidence = await storeImageEvidence(row._id, bytes, { reuseExisting: true });
        const result = await assets.updateOne({ ...exact, evidence: { $exists: false } }, { $set: { evidence } }, { writeConcern: { w: 'majority' } });
        if (result.modifiedCount !== 1) throw new Error('Image changed before saving evidence');
        totals.copied++;
      } catch (error) { totals.failed++; console.error({ asset: String(row._id), error: error.code || error.status || error.name,
        provider: String(error.cause?.message || '').replace(/https?:\/\/\S+|\b[a-f0-9]{24,}\b/g, '[hidden]').slice(0, 140) }); }
    }));
    if (first === 0 && totals.failed === Math.min(3, rows.length)) break;
  }
  console.log(totals);
  if (totals.copied + totals.verifiedExisting !== rows.length) process.exitCode = 1;
}

const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 7000, maxPoolSize: 4 });
cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET });
try {
  const db = (await client.connect()).db();
  await (mode === '--backup' ? backup : copy)(db.collection('imageassets'), resolve(backupFile));
} catch (error) {
  console.error({ error: error.code || error.name });
  process.exitCode = 1;
} finally { await client.close(); }
