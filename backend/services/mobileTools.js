import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Note from '../models/Note.js';
import WorkNote from '../models/WorkNote.js';
import Character from '../models/Character.js';
import Plot from '../models/Plot.js';
import World from '../models/World.js';
import Work from '../models/Work.js';
import { sanitizeChapterHtml } from '../utils/sanitizeHtml.js';
import { parseDocument } from 'htmlparser2';

const definitions = {
  personal: { model: Note, fields: ['title', 'content'] },
  notes: { model: WorkNote, fields: ['title', 'body'] },
  characters: { model: Character, fields: ['name', 'role', 'tagline', 'notes'] },
  scenes: { model: Plot, array: 'scenes', fields: ['title', 'description', 'goal', 'act', 'status', 'draftText', 'characters'] },
  world: { model: World, fields: ['name', 'description', 'notes'] },
};
const fail = (status, message, current) => Object.assign(new Error(message), { status, ...(current ? { current } : {}) });
const validId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const stable = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const hash = value => crypto.createHash('sha256').update(stable(value)).digest('hex');
const plainHtml = value => value ? `<p>${String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replace(/\r\n?/g, '\n').replaceAll('\n', '<br>')}</p>` : '';
function htmlText(html) {
  const visit = node => node.type === 'text' ? node.data : node.name === 'br' ? '\n'
    : (node.children || []).map(visit).join('') + (['p', 'div', 'h1', 'h2', 'h3', 'blockquote', 'li'].includes(node.name) ? '\n' : '');
  return parseDocument(html).children.map(visit).join('').replace(/\n$/, '');
}
function storageValues(ctx, data) {
  const field = ctx.kind === 'personal' ? 'content' : ctx.kind === 'notes' ? 'body' : null;
  if (!field) return data;
  const plain = htmlText(data[field]);
  return { ...data, [field]: plain, [field === 'content' ? 'mobileRichContent' : 'mobileRichBody']: { html: data[field], plain } };
}

async function context(userId, kind, workId, category) {
  const definition = Object.hasOwn(definitions, kind) ? definitions[kind] : null;
  if (!definition) throw fail(400, 'Geçersiz araç.');
  if (kind !== 'personal') {
    if (!validId(workId) || !await Work.exists({ _id: workId, user: userId })) throw fail(403, 'Bu esere erişimin yok.');
  }
  if (kind === 'world' && !['locations', 'timeline', 'rules', 'notes'].includes(category)) throw fail(400, 'Geçersiz dünya kategorisi.');
  const filter = kind === 'personal' ? { user: userId } : kind === 'notes' ? { workId } : kind === 'characters' ? { user: userId, work: workId } : { work: workId };
  return { ...definition, kind, filter, array: kind === 'world' ? category : definition.array };
}
function values(ctx, item) {
  return Object.fromEntries(ctx.fields.map(key => {
    if (key === 'characters') return [key, (item[key] || []).map(String)];
    if (key === 'content' || key === 'body') {
      const rich = item[key === 'content' ? 'mobileRichContent' : 'mobileRichBody'];
      // Web edits update the plain field. Reuse mobile formatting only while
      // its source still matches, otherwise preserve the new web text exactly.
      return [key, rich?.plain === item[key] ? rich.html : plainHtml(item[key] || '')];
    }
    return [key, item[key] || ''];
  }));
}
function snapshot(ctx, parent, item) {
  return { recordId: String(item._id), data: values(ctx, item), version: hash({ item }) };
}
async function locate(ctx, recordId) {
  const parent = await ctx.model.findOne(ctx.array ? ctx.filter : { ...ctx.filter, _id: recordId }).lean();
  const item = ctx.array ? parent?.[ctx.array]?.find(entry => String(entry._id) === recordId) : parent;
  return item ? { parent, item } : null;
}
export async function readMobileTool(userId, kind, recordId, options = {}) {
  if (!validId(recordId)) throw fail(400, 'Geçersiz kayıt.');
  const ctx = await context(userId, kind, options.workId, options.category);
  const found = await locate(ctx, recordId);
  if (!found) throw fail(404, 'Kayıt bulunamadı. Cihaz taslağın korunuyor.');
  return snapshot(ctx, found.parent, found.item);
}
async function cleanValues(ctx, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail(400, 'Geçersiz içerik.');
  const data = {};
  for (const key of ctx.fields) {
    if (key === 'characters') {
      if (!Array.isArray(input[key]) || input[key].some(id => !validId(id))) throw fail(400, 'Geçersiz karakter seçimi.');
      const ids = [...new Set(input[key])];
      if (await Character.countDocuments({ ...ctx.filter, _id: { $in: ids } }) !== ids.length) throw fail(400, 'Karakterler bu esere ait olmalı.');
      data[key] = ids; continue;
    }
    if (typeof input[key] !== 'string') throw fail(400, 'Metin alanı geçersiz.');
    const limit = key === 'content' || key === 'body' ? 500000 : key === 'draftText' ? 50000 : key === 'goal' ? 500 : key === 'title' && ctx.kind === 'scenes' ? 200 : 10000;
    if (input[key].length > limit) throw fail(400, 'Metin izin verilen uzunluğu aşıyor.');
    data[key] = key === 'content' || key === 'body' ? sanitizeChapterHtml(input[key]) : input[key];
    if (['title', 'name', 'act'].includes(key)) data[key] = data[key].trim();
  }
  if (!(data.title || data.name)?.trim()) throw fail(400, 'Başlık veya ad gerekli.');
  if (ctx.kind === 'scenes' && (!data.act || !['idea', 'drafting', 'writing', 'done'].includes(data.status))) throw fail(400, 'Geçersiz sahne durumu veya perde.');
  return data;
}
export async function saveMobileTool(userId, kind, body = {}) {
  const { recordId, draftId, expectedVersion, workId, category } = body;
  const ctx = await context(userId, kind, workId, category);
  if (typeof draftId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(draftId) || (recordId && !validId(recordId))) throw fail(400, 'Geçersiz taslak kimliği.');
  const data = await cleanValues(ctx, body.data);
  // Stable IDs make a retried creation safe when the first response was lost.
  const id = recordId || hash({ userId, kind, workId: workId || '', category: category || '', draftId }).slice(0, 24);
  let found = await locate(ctx, id);
  if (!recordId) {
    if (!found) {
      if (ctx.array) {
        let parent = await ctx.model.findOne(ctx.filter);
        if (!parent) { try { parent = await ctx.model.create(ctx.filter); } catch (error) { if (error.code !== 11000) throw error; } }
        const order = (await ctx.model.findOne(ctx.filter).lean())[ctx.array]?.length || 0;
        await ctx.model.updateOne({ ...ctx.filter, [`${ctx.array}._id`]: { $ne: id } }, {
          $push: { [ctx.array]: { _id: id, ...data, order } }, $inc: { __v: 1 },
        }, { runValidators: true });
      } else {
        try { await ctx.model.create({ _id: id, ...ctx.filter, ...storageValues(ctx, data) }); }
        catch (error) { if (error.code !== 11000) throw error; }
      }
      found = await locate(ctx, id);
    }
    const current = snapshot(ctx, found.parent, found.item);
    if (stable(current.data) !== stable(data)) throw fail(409, 'Bu taslağın daha önce kaydedilmiş başka bir sürümü var.', current);
    return current;
  }
  if (!found) throw fail(404, 'Kayıt silinmiş veya erişilemiyor. Cihaz taslağın korunuyor.');
  const current = snapshot(ctx, found.parent, found.item);
  if (typeof expectedVersion !== 'string' || !/^[a-f\d]{64}$/.test(expectedVersion)) throw fail(400, 'Kayıt sürümü gerekli.');
  if (expectedVersion !== current.version) {
    if (stable(current.data) === stable(data)) return current;
    throw fail(409, 'Kayıt başka bir cihazda değişmiş. İki sürüm de korunuyor.', current);
  }
  const previous = Object.fromEntries(ctx.fields.map(key => [key, found.item[key] === undefined ? { $exists: false } : { $eq: found.item[key] }]));
  const filter = { _id: found.parent._id, ...ctx.filter,
    ...(ctx.array ? { [ctx.array]: { $elemMatch: { _id: id, ...previous, updatedAt: found.item.updatedAt } } }
      : { ...previous, updatedAt: found.parent.updatedAt, __v: found.parent.__v === undefined ? { $exists: false } : found.parent.__v }) };
  const patch = ctx.array ? Object.fromEntries(Object.entries({ ...data, updatedAt: new Date() }).map(([key, value]) => [`${ctx.array}.$.${key}`, value])) : storageValues(ctx, data);
  const updated = await ctx.model.findOneAndUpdate(filter, { $set: patch, $inc: { __v: 1 } }, { new: true, runValidators: true }).lean();
  if (!updated) {
    const latest = await locate(ctx, id);
    if (!latest) throw fail(404, 'Kayıt silinmiş. Cihaz taslağın korunuyor.');
    throw fail(409, 'Kayıt kaydetme sırasında değişmiş.', snapshot(ctx, latest.parent, latest.item));
  }
  return snapshot(ctx, updated, ctx.array ? updated[ctx.array].find(entry => String(entry._id) === id) : updated);
}
