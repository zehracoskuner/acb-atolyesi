import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import ContentCase from '../models/ContentCase.js';
import Report from '../models/Report.js';
import ImageAsset from '../models/ImageAsset.js';
import VisualAccount from '../models/VisualAccount.js';
import Work from '../models/Work.js';
import User from '../models/User.js';
import Chapter from '../models/Chapter.js';
import Notification from '../models/Notification.js';
import { fail, textField, captureEvidence } from './reportWorkflow.js';
import { legacyImage, accountForWrite, txOptions, publishImage, purgeImage } from './imageAssets.js';

const DAY = 86400000;
const same = (a, b) => String(a) === String(b);
export const imageKinds = ['cover', 'avatar', 'banner'];
export const chapterVersion = c => `${c.revision || 0}:${createHash('sha256').update(JSON.stringify([c.title, c.content])).digest('hex')}`;
const notify = (recipient, text, session, contentCase) => Notification.create([{ recipient, sender: null, type: 'warning', text, contentCase }], { session });
export function staff(actor) { if (!['admin', 'moderator'].includes(actor?.role)) fail(403, 'Yetkili incelemesi gerekir.'); }

export async function fileContentReport(actor, body) {
  const { targetType: kind, targetId: target, reason } = body;
  if (![...imageKinds, 'chapter'].includes(kind) || !mongoose.isValidObjectId(target)) fail(400, 'Geçersiz hedef.');
  if (!['spam', 'uygunsuz_icerik', 'telif_ihlali', 'taciz', 'nefret_soylemi', 'diger'].includes(reason)) fail(400, 'Geçersiz neden.');
  if (body.description != null && (typeof body.description !== 'string' || body.description.length > 500)) fail(400, 'Açıklama en fazla 500 karakter olabilir.');
  let owner, asset, version, snapshot;
  if (kind === 'chapter') {
    const evidence = await captureEvidence('chapter', target);
    owner = evidence.targetOwner; snapshot = evidence.evidenceSnapshot.target; version = chapterVersion(snapshot);
  } else {
    const model = kind === 'cover' ? Work : User;
    const field = { cover: 'coverImage', avatar: 'avatarUrl', banner: 'bannerImage' }[kind];
    const current = await model.findById(target).select(`${field} user status`).lean();
    if (!current?.[field] || (kind === 'cover' && current.status !== 'published')) fail(404, 'Görsel bulunamadı.');
    if (body.expectedUrl && body.expectedUrl !== current[field]) fail(409, 'Görsel değişti; sayfayı yenileyin.');
    owner = kind === 'cover' ? current.user : current._id;
    asset = await legacyImage(current[field], owner);
    if (asset.state !== 'active') fail(409, 'Bu görsel zaten kaldırıldı.');
    version = String(asset._id); snapshot = { url: current[field] };
  }
  if (same(owner, actor.id)) fail(400, 'Kendi içeriğinizi şikâyet edemezsiniz.');
  const key = kind === 'chapter' ? `chapter:${target}:${version}` : `image:${version}`;
  let entry;
  try { entry = await ContentCase.findOneAndUpdate({ key }, { $setOnInsert: { kind, target, owner, asset: asset?._id, version, snapshot } }, { upsert: true, new: true }); }
  catch (e) { if (e.code !== 11000) throw e; entry = await ContentCase.findOne({ key }); }
  return mongoose.connection.transaction(async session => {
    entry = await ContentCase.findById(entry._id).session(session);
    if (entry.status !== 'pending') fail(409, 'Bu sürüm için karar verilmiş; yeni şikâyet açılamaz.');
    const [report] = await Report.create([{ reporter: actor.id, targetType: kind, targetId: target, reason,
      description: body.description?.trim() || '', contentCase: entry._id, targetVersion: version, targetOwner: owner }], { session });
    entry.reportCount += 1; entry.revision += 1;
    if (kind !== 'chapter' && entry.reportCount >= 5 && !entry.notifiedThreshold) {
      entry.notifiedThreshold = true;
      await notify(owner, 'ACB Atölyesi: Yüklediğiniz görsele dair şikâyet aldık. Yetkililerimiz inceleyecek; henüz bir ihlal kararı verilmedi.', session, entry._id);
    }
    await entry.save({ session });
    return report;
  }, txOptions);
}

async function imageViolation(entry, undo, session, now) {
  const account = await accountForWrite(entry.owner, session);
  const existing = account.violations.find(v => same(v.asset, entry.asset));
  if (undo) {
    if (existing) existing.active = false;
    for (const penalty of account.penalties) {
      if (!penalty.revokedAt && +penalty.until > +now && penalty.cases.some(c => same(c, entry._id))) {
        const count = account.violations.filter(v => v.active && penalty.cases.some(c => same(c, v.caseId))).length;
        if (count < 5) penalty.revokedAt = now;
      }
    }
  } else if (!existing) account.violations.push({ caseId: entry._id, asset: entry.asset, at: now, active: true });
  const recent = account.violations.filter(v => v.active && +v.at >= +now - 90 * DAY);
  const available = recent.filter(v => !v.consumedBy);
  if (!undo && available.length >= 5 && !account.penalties.some(p => !p.revokedAt && +p.until > +now)) {
    const group = available.slice(0, 5), penaltyId = new mongoose.Types.ObjectId();
    const until = new Date(+now + 3 * DAY);
    group.forEach(v => { v.consumedBy = penaltyId; });
    account.penalties.push({ _id: penaltyId, at: now, until, cases: group.map(v => v.caseId) });
    await notify(entry.owner, `ACB Atölyesi: Son 90 günde doğrulanan 5 ayrı görsel ihlali nedeniyle görsel yüklemeniz ${until.toISOString()} tarihine kadar engellendi. Metin yazmaya devam edebilirsiniz.`, session, entry._id);
  }
  await account.save({ session });
  return recent.length;
}
async function syncWork(workId, session) {
  const work = await Work.findById(workId).session(session);
  work.status = work.publishedChapterIds.length ? 'published' : 'draft';
  await work.save({ session });
}
async function removeImageReferences(asset, entry, session) {
  await Work.updateMany({ coverImage: asset.url }, { $set: { coverImage: '', removedCoverCase: String(entry._id) }, $inc: { __v: 1 } }, { session });
  for (const [field, marker] of [['avatarUrl', 'removedAvatarCase'], ['bannerImage', 'removedBannerCase']]) {
    await User.updateMany({ [field]: asset.url }, { $set: { [field]: '', [marker]: String(entry._id) }, $inc: { __v: 1 } }, { session });
  }
}
export async function decideContent(id, actor, body) {
  staff(actor);
  const reason = textField(body.reason), action = body.action;
  const message = body.message == null || body.message === '' ? '' : textField(body.message, 1000);
  if (!['remove', 'dismiss', 'reverse', 'retry_delivery'].includes(action)) fail(400, 'Geçersiz karar.');
  let entry = await ContentCase.findById(id).select('+snapshot');
  if (!entry) fail(404, 'İnceleme bulunamadı.');
  if (same(entry.owner, actor.id)) fail(403, 'Kendi içeriğinizde karar veremezsiniz.');
  if (await Report.exists({ contentCase: id, reporter: actor.id })) fail(403, 'Taraf olduğunuz dosyada karar veremezsiniz.');
  if (action === 'retry_delivery') {
    if (entry.status !== 'removed' || !entry.asset) fail(409, 'Tekrar silinecek görsel yok.');
    return { entry, delivery: (await purgeImage(entry.asset))?.delivery };
  }
  // Idempotent repeats never create another violation or notification.
  if ((action === 'remove' && entry.status === 'removed') || (action === 'reverse' && entry.status === 'reversed') || (action === 'dismiss' && entry.status === 'dismissed')) {
    return { entry, delivery: entry.asset ? (await purgeImage(entry.asset))?.delivery : undefined };
  }
  if (!Number.isInteger(body.revision) || body.revision !== entry.revision) fail(409, 'İnceleme değişti; yenileyin.');
  let restored;
  if (action === 'reverse' && entry.asset) {
    const asset = await ImageAsset.findById(entry.asset).select('+bytes');
    if (asset.bytes) restored = await publishImage(asset.bytes);
    else if (asset.delivery === 'external') restored = { secure_url: asset.url };
    else fail(409, 'Özel kanıt yok; sağlayıcı yedeğinden geri yükleme gerekir.');
  }
  try {
    entry = await mongoose.connection.transaction(async session => {
      const current = await ContentCase.findById(id).select('+snapshot').session(session);
      if (current.revision !== body.revision) fail(409, 'Başka yetkili işlem yaptı; yenileyin.');
      const now = new Date();
      if (action === 'dismiss') {
        if (current.status !== 'pending') fail(409, 'Önce mevcut kararı geri alın.');
        current.status = 'dismissed';
      } else if (current.kind === 'chapter') {
        const chapter = await Chapter.findById(current.target).session(session);
        if (!chapter || chapterVersion(chapter) !== current.version) fail(409, 'Bölüm sürümü değişmiş; bu karar güncel metne uygulanamaz.');
        if (action === 'remove') {
          if (current.status !== 'pending') fail(409, 'Karar verilmiş.');
          chapter.moderationHold = true; chapter.moderationCase = current._id;
          chapter.status = 'rejected'; chapter.reviewNote = reason; chapter.reviewedBy = actor.id; chapter.reviewedAt = now;
          current.status = 'removed';
        } else {
          if (current.status !== 'removed' || !same(chapter.moderationCase, current._id)) fail(409, 'Bu engel bu karara ait değil.');
          chapter.moderationHold = false; chapter.moderationCase = null; chapter.status = 'draft'; chapter.reviewNote = '';
          current.status = 'reversed';
        }
        await chapter.save({ session });
        await Work.updateOne({ _id: chapter.work }, { $pull: { publishedChapterIds: chapter._id } }, { session });
        await syncWork(chapter.work, session);
        await notify(current.owner, `ACB Atölyesi: Bölüm kararı: ${action === 'remove' ? 'yayından kaldırıldı' : 'geri alındı'}. Gerekçe: ${reason}. Metniniz ve sürüm geçmişiniz korunuyor.`, session, id);
      } else {
        const asset = await ImageAsset.findById(current.asset).select('+bytes').session(session);
        if (action === 'remove') {
          if (current.status !== 'pending') fail(409, 'Karar verilmiş.');
          asset.state = 'removed'; asset.delivery = asset.publicId ? 'purge_pending' : 'external';
          await asset.save({ session });
          await removeImageReferences(asset, current, session);
          current.status = 'removed';
        } else {
          if (current.status !== 'removed') fail(409, 'Kaldırma kararı yok.');
          if (restored.secure_url === asset.url) { asset.state = 'active'; await asset.save({ session }); }
          else await ImageAsset.create([{ owner: asset.owner, url: restored.secure_url, publicId: restored.public_id,
            bytes: asset.bytes, mime: asset.mime, providerVersion: String(restored.version || '') }], { session });
          // Only untouched placeholders created by this exact decision may be restored.
          await Work.updateMany({ removedCoverCase: String(id), coverImage: '' }, { $set: { coverImage: restored.secure_url, removedCoverCase: '' }, $inc: { __v: 1 } }, { session });
          for (const [field, marker] of [['avatarUrl', 'removedAvatarCase'], ['bannerImage', 'removedBannerCase']]) {
            await User.updateMany({ [marker]: String(id), [field]: '' }, { $set: { [field]: restored.secure_url, [marker]: '' }, $inc: { __v: 1 } }, { session });
          }
          current.status = 'reversed';
        }
        const count = await imageViolation(current, action === 'reverse', session, now);
        await notify(current.owner, `ACB Atölyesi: Görsel ${action === 'remove' ? 'kaldırıldı' : 'kararı geri alındı'}. Gerekçe: ${reason}. Son 90 gündeki doğrulanmış görsel ihlali: ${count}.${message ? ` Yetkili mesajı: ${message}` : ''}`, session, id);
      }
      current.events.push({ at: now, by: actor.id, action, reason, message });
      current.revision += 1;
      await current.save({ session });
      await Report.updateMany({ contentCase: id }, { $set: { status: action === 'dismiss' ? 'dismissed' : 'resolved', resolvedBy: actor.id, resolvedAt: now } }, { session });
      if (action === 'remove') {
        const reporters = await Report.distinct('reporter', { contentCase: id }).session(session);
        for (const reporter of reporters) await notify(reporter, 'ACB Atölyesi: Bildirdiğiniz içerik inceleme sonucunda kaldırıldı. Topluluğumuzu güvende tutmamıza yardımcı olduğun için teşekkür ederiz.', session, id);
      }
      return current;
    }, txOptions);
  } catch (e) {
    if (restored?.public_id) { const { v2 } = await import('cloudinary'); await v2.uploader.destroy(restored.public_id, { invalidate: true }).catch(() => {}); }
    throw e;
  }
  return { entry, delivery: action === 'remove' && entry.asset ? (await purgeImage(entry.asset))?.delivery : undefined };
}

export async function manualVisualBlock(actor, owner, body) {
  staff(actor); const reason = textField(body.reason);
  const until = new Date(body.until);
  if (!Number.isFinite(+until) || +until <= Date.now() || +until > Date.now() + 365 * DAY) fail(400, 'Geçerli bitiş tarihi gerekir.');
  if (same(actor.id, owner)) fail(403, 'Kendinize yaptırım uygulayamazsınız.');
  return mongoose.connection.transaction(async session => {
    if (!await User.exists({ _id: owner }).session(session)) fail(404, 'Kullanıcı bulunamadı.');
    const account = await accountForWrite(owner, session);
    account.manual = { until, reason, by: actor.id };
    account.manualHistory.push({ at: new Date(), until, reason, by: actor.id });
    await account.save({ session });
    await notify(owner, `ACB Atölyesi: Yetkili kararıyla görsel yüklemeniz ${until.toISOString()} tarihine kadar engellendi. Gerekçe: ${reason}`, session);
    return { until };
  }, txOptions);
}
