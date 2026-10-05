import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import ImageAsset from '../models/ImageAsset.js';
import VisualAccount from '../models/VisualAccount.js';
import { fail } from './reportWorkflow.js';

export const txOptions = { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' };
export async function accountForWrite(owner, session) {
  return VisualAccount.findOneAndUpdate({ _id: owner }, { $inc: { lock: 1 } }, { upsert: true, new: true, session });
}
export function blockedUntil(account, now = new Date()) {
  return [account?.manual?.until, ...(account?.penalties || []).filter(p => !p.revokedAt).map(p => p.until)]
    .filter(d => d && +new Date(d) > +now).sort((a, b) => +new Date(b) - +new Date(a))[0];
}
export async function assertImageAllowed(owner, session) {
  const account = session ? await accountForWrite(owner, session) : await VisualAccount.findById(owner).lean();
  const until = blockedUntil(account);
  if (until) throw Object.assign(new Error(`Görsel yükleme engeli ${new Date(until).toISOString()} tarihinde sona erecek.`), { status: 403, code: 'IMAGE_UPLOAD_BLOCKED', until });
}
export async function imagePermission(req, res, next) {
  try { await assertImageAllowed(req.user.id); next(); }
  catch (e) { res.status(e.status || 503).json({ message: e.status ? e.message : 'Görsel izni doğrulanamadı.', code: e.status ? e.code : undefined, until: e.until }); }
}
export async function ownedImage(url, owner, session) {
  if (typeof url !== 'string') fail(400, 'Geçersiz görsel.');
  const asset = await ImageAsset.findOne({ url, owner, state: 'active' }).session(session || null);
  if (!asset) fail(400, 'Görsel kendi hesabınızdan yüklenmiş, etkin bir görsel olmalıdır.');
  // Serialize attachments with removal, not just with the account penalty.
  if (session) await ImageAsset.updateOne({ _id: asset._id }, { $inc: { __v: 1 } }, { session });
  return asset;
}
export async function withImageChange(owner, url, oldUrl, save) {
  if (url === undefined || url === oldUrl) return save(null);
  return mongoose.connection.transaction(async session => {
    if (url) { await assertImageAllowed(owner, session); await ownedImage(url, owner, session); }
    return save(session);
  }, txOptions);
}
export async function registerImage(owner, file, result) {
  return mongoose.connection.transaction(async session => {
    await assertImageAllowed(owner, session);
    const [asset] = await ImageAsset.create([{
      owner, url: result.secure_url, publicId: result.public_id, providerVersion: String(result.version || ''),
      bytes: file.buffer, mime: file.mimetype,
    }], { session });
    return asset;
  }, txOptions).catch(async error => {
    // A concurrent sanction/DB error must not leave a newly accepted upload public.
    if (result.public_id) await cloudinary.uploader.destroy(result.public_id, { resource_type: 'image', invalidate: true })
      .catch(e => console.error('Unregistered image cleanup failed:', result.public_id, e.message));
    throw error;
  });
}
export function publishImage(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: 'acb-covers', resource_type: 'image' },
      (err, result) => err ? reject(err) : resolve(result));
    stream.on('error', reject); stream.end(buffer);
  });
}
// Legacy URLs originate in our database, never in a complaint payload.
// Only our Cloudinary namespace is eligible for provider operations/downloads.
export async function legacyImage(url, owner) {
  let asset = await ImageAsset.findOne({ url });
  if (asset) return asset;
  let publicId, bytes, mime;
  const parsed = new URL(url);
  const prefix = `/${cloudinary.config().cloud_name}/image/upload/`;
  if (parsed.protocol === 'https:' && parsed.hostname === 'res.cloudinary.com' && parsed.pathname.startsWith(prefix)) {
    const tail = parsed.pathname.slice(prefix.length);
    const match = tail.match(/^v\d+\/(.+)\.[a-zA-Z0-9]+$/);
    if (match) {
      publicId = decodeURIComponent(match[1]);
      const resource = await cloudinary.api.resource(publicId, { resource_type: 'image' });
      const source = new URL(resource.secure_url);
      if (source.hostname !== 'res.cloudinary.com' || source.protocol !== 'https:' || !source.pathname.startsWith(prefix)) fail(502, 'Sağlayıcı kaynağı doğrulanamadı.');
      const response = await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (!response.ok) fail(502, 'Kanıt alınamadı.');
      const chunks = []; let size = 0;
      for await (const chunk of response.body) { size += chunk.length; if (size > 5 * 1024 * 1024) fail(413, 'Eski görsel kanıt sınırını aşıyor.'); chunks.push(chunk); }
      bytes = Buffer.concat(chunks); mime = `image/${resource.format === 'jpg' ? 'jpeg' : resource.format}`;
    }
  }
  try { asset = await ImageAsset.create({ owner, url, publicId, bytes, mime, delivery: publicId ? 'available' : 'external' }); }
  catch (e) { if (e.code !== 11000) throw e; asset = await ImageAsset.findOne({ url }); }
  return asset;
}
export async function purgeImage(assetId) {
  const asset = await ImageAsset.findById(assetId);
  if (!asset || asset.state !== 'removed' || asset.delivery === 'purged') return asset;
  if (!asset.publicId) { asset.delivery = 'external'; await asset.save(); return asset; }
  try {
    const result = await cloudinary.uploader.destroy(asset.publicId, { resource_type: 'image', invalidate: true });
    if (!['ok', 'not found'].includes(result.result)) throw new Error('Sağlayıcı silmeyi doğrulamadı.');
    asset.delivery = 'purged'; asset.deliveryError = '';
  } catch (e) { asset.delivery = 'purge_pending'; asset.deliveryError = String(e.message).slice(0, 300); }
  await asset.save(); return asset;
}
