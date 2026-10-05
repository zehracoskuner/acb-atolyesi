import Report from '../models/Report.js';
import Work from '../models/Work.js';
import Chapter from '../models/Chapter.js';
import Comment from '../models/Comment.js';
import { notifyReport } from './notificationService.js';

export function fail(status, message) { throw Object.assign(new Error(message), { status }); }
export const stageOf = r => r.stage || (r.status === 'pending' ? 'received' : 'decided');
const same = (a, b) => a != null && b != null && String(a._id || a) === String(b._id || b);
export function textField(value, max = 4000) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(400, `Metin zorunludur (en fazla ${max} karakter).`);
  return value.trim();
}
export function publicReport(r, userId) {
  const reporter = same(r.reporter, userId);
  if (!reporter && !(same(r.targetOwner, userId) && r.decisions?.length)) fail(404, 'Başvuru bulunamadı.');
  const decisions = (r.decisions || []).map(d => ({ at: d.at, outcome: d.outcome, action: d.action, rationale: d.rationale }));
  return {
    _id: r._id, number: String(r._id), targetType: r.targetType, targetId: r.targetId,
    reason: r.reason, status: r.status, stage: stageOf(r), revision: r.revision || 0,
    createdAt: r.createdAt, decisions, role: reporter ? 'reporter' : 'owner',
    ...(reporter ? { description: r.description, originalWork: r.originalWork } : {}),
    history: [{ at: r.createdAt, kind: 'received', text: 'Başvuru alındı.' }, ...(r.history || [])]
      .filter(h => reporter || h.audience === 'shared').map(h => ({ at: h.at, kind: h.kind, text: h.text })),
    appeals: (r.appeals || []).filter(a => same(a.by, userId)).map(a => ({ at: a.at, decision: a.decision, rationale: a.rationale })),
    canAppeal: r.reason === 'telif_ihlali' && ['decided', 'appeal_review'].includes(stageOf(r)) && decisions.length > 0 && !(r.appeals || []).some(a => same(a.by, userId) && a.decision === decisions.length),
  };
}
export async function captureEvidence(targetType, targetId) {
  let work, target;
  if (targetType === 'work') {
    work = await Work.findById(targetId).select('title description preface user status publishedChapterIds updatedAt').lean();
    if (!work || work.status !== 'published') fail(404, 'Yayındaki içerik bulunamadı.');
    const chapters = await Chapter.find({ _id: { $in: work.publishedChapterIds || [] }, work: work._id, status: 'published' }).select('title content order revision updatedAt').lean();
    target = { ...work, chapters };
  } else if (targetType === 'chapter') {
    target = await Chapter.findById(targetId).select('title content work status revision updatedAt').lean();
    work = target && await Work.findById(target.work).select('user status publishedChapterIds').lean();
    if (!target || target.status !== 'published' || work?.status !== 'published' || !work.publishedChapterIds.some(id => same(id, targetId))) fail(404, 'Yayındaki içerik bulunamadı.');
  } else if (targetType === 'comment') {
    target = await Comment.findById(targetId).select('content author status isDeleted updatedAt').lean();
    if (!target || target.isDeleted || target.status !== 'published') fail(404, 'Yayındaki içerik bulunamadı.');
  } else fail(400, 'Telif başvurusu eser, bölüm veya yorum için yapılabilir.');
  // No URL fetches; only the exact locally stored content used in this complaint.
  if (Buffer.byteLength(JSON.stringify(target)) > 8 * 1024 * 1024) fail(400, 'Eser çok büyük; ilgili bölümü seçerek başvurun.');
  return { targetOwner: work?.user || target.author, evidenceSnapshot: { capturedAt: new Date(), target } };
}
export async function transition(r, actor, operation, body) {
  if (!Number.isInteger(body.revision) || body.revision !== (r.revision || 0)) fail(409, 'Dosya değişti; yenileyip tekrar deneyin.');
  const stage = stageOf(r), at = new Date();
  const set = {}, push = {};
  const isReporter = same(r.reporter, actor.id);
  if (['review', 'request_information', 'decision', 'note'].includes(operation)) {
    if (actor.role !== 'admin') fail(403, 'Telif incelemesi için yönetici yetkisi gerekir.');
    // Legacy reports have no owner snapshot. Resolve only the local owner;
    // do not pretend today's content is evidence from the original submission.
    if (!r.targetOwner) {
      let owner;
      if (r.targetType === 'work') owner = (await Work.findById(r.targetId).select('user').lean())?.user;
      if (r.targetType === 'chapter') {
        const chapter = await Chapter.findById(r.targetId).select('work').lean();
        if (chapter) owner = (await Work.findById(chapter.work).select('user').lean())?.user;
      }
      if (r.targetType === 'comment') owner = (await Comment.findById(r.targetId).select('author').lean())?.author;
      if (owner) { r.targetOwner = owner; set.targetOwner = owner; }
    }
    if (same(r.reporter, actor.id) || same(r.targetOwner, actor.id)) fail(403, 'Taraf olduğunuz dosyada karar veremezsiniz.');
    if (operation === 'note') set.adminNote = textField(body.privateNote);
    if (operation === 'review') {
      if (stage !== 'received') fail(409, 'İnceleme bu aşamada başlatılamaz.');
      set.stage = 'reviewing'; push.history = { at, kind: operation, text: 'İnsan incelemesi başladı.', audience: 'reporter' };
    }
    if (operation === 'request_information') {
      if (!['reviewing', 'appeal_review'].includes(stage)) fail(409, 'Bu aşamada ek bilgi istenemez.');
      // Appeal review stays open while additional information is collected.
      set.stage = stage === 'appeal_review' ? stage : 'awaiting_information';
      push.history = { at, kind: operation, text: textField(body.text), audience: 'reporter' };
    }
    if (operation === 'decision') {
      if (!['reviewing', 'appeal_review'].includes(stage)) fail(409, 'Önce inceleme başlatılmalıdır.');
      if (!['upheld', 'dismissed', 'inconclusive'].includes(body.outcome) || !['none', 'notice'].includes(body.action)) fail(400, 'Geçersiz karar veya işlem.');
      if (body.action === 'notice' && (body.outcome !== 'upheld' || !r.targetOwner)) fail(400, 'Uyarı yalnızca ihlal tespitinde uygulanabilir.');
      const rationale = textField(body.rationale);
      set.stage = 'decided'; set.status = body.outcome === 'dismissed' ? 'dismissed' : 'resolved';
      set.resolvedBy = actor.id; set.resolvedAt = at;
      if (body.privateNote?.trim()) set.adminNote = textField(body.privateNote);
      push.decisions = { at, outcome: body.outcome, action: body.action, rationale, by: actor.id };
      push.history = { at, kind: 'decision', text: rationale, audience: 'shared' };
    }
  } else if (operation === 'information') {
    if (!isReporter) fail(404, 'Başvuru bulunamadı.');
    const latest = [...(r.history || [])].reverse().find(h => ['request_information', 'information'].includes(h.kind));
    if (!['awaiting_information', 'appeal_review'].includes(stage) || latest?.kind !== 'request_information') fail(409, 'Açık ek bilgi talebi yok.');
    set.stage = stage === 'appeal_review' ? stage : 'reviewing';
    push.history = { at, kind: operation, text: textField(body.text), audience: 'reporter' };
  } else if (operation === 'appeal') {
    if (!publicReport(r, actor.id).canAppeal) fail(409, 'Bu karara itiraz edilemez.');
    set.stage = 'appeal_review'; set.status = 'pending';
    push.appeals = { at, by: actor.id, decision: r.decisions.length, rationale: textField(body.text) };
    push.history = { at, kind: 'appeal', text: 'Gerekçeli itiraz alındı; insan incelemesi bekleniyor.', audience: 'shared' };
  } else fail(400, 'Geçersiz işlem.');
  const filter = { _id: r._id, ...(r.revision ? { revision: r.revision } : { $or: [{ revision: 0 }, { revision: { $exists: false } }] }) };
  const updated = await Report.findOneAndUpdate(filter, { $set: set, $inc: { revision: 1 }, ...(Object.keys(push).length ? { $push: push } : {}) }, { new: true, runValidators: true }).lean();
  if (!updated) fail(409, 'Dosya başka bir işlemle değişti; yenileyin.');
  // The decision is durable before any best-effort notification.
  if (operation !== 'note') await notifyReport(updated, operation).catch(e => console.error('Report notification:', e.message));
  return updated;
}
