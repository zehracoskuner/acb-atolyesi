import mongoose from "mongoose";
import Character from "../models/Character.js";
import Relationship from "../models/Relationship.js";
import Chapter from "../models/Chapter.js";
import ReadingProgress from "../models/ReadingProgress.js";

export const validGuideId = value => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
const key = value => value == null ? "" : String(value);
const byId = items => new Map(items.map(item => [key(item._id), item]));
export const guidePortraitAsset = (characterId, url) =>
  new RegExp(`^/api/characters/${characterId}/portrait/([a-f\\d]{24})$`, "i").exec(url || "")?.[1]?.toLowerCase();

export async function guideSources(work, { published = false } = {}) {
  const scope = { work: work._id, user: work.user };
  const publishedIds = work.publishedChapterIds || [];
  const publishedSet = new Set(publishedIds.map(key));
  const [characters, relationships, chapters] = await Promise.all([
    Character.find(scope).select("_id imageUrl").lean(),
    Relationship.find(scope).select("_id from to directed status").lean(),
    Chapter.find({ work: work._id, ...(published ? { status: "published", _id: { $in: publishedIds } } : {}) })
      .select("_id title order status moderationHold").sort({ order: 1, _id: 1 }).lean(),
  ]);
  const titles = work.customChapterTitles || {};
  return {
    characters: byId(characters), relationships: byId(relationships),
    chapters: chapters.filter(chapter => !published || !chapter.moderationHold).map(chapter => ({
      id: key(chapter._id), order: chapter.order, title: titles[key(chapter._id)] || chapter.title,
      published: !chapter.moderationHold && chapter.status === "published" && publishedSet.has(key(chapter._id)),
    })),
  };
}

function invalid() {
  throw Object.assign(new Error("Rehberde geçersiz karakter, bağ, bölüm veya metin var."), { status: 400 });
}
function list(value, max) {
  if (!Array.isArray(value) || value.length > max) invalid();
  return value;
}
function field(value, max, required = false) {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) invalid();
  return value.trim();
}
function member(value, ids) {
  if (!validGuideId(value) || !ids.has(value)) invalid();
  return value;
}
function milestones(value, chapters) {
  const notes = list(value, 60).map(note => ({
    _id: validGuideId(note?._id) ? note._id : new mongoose.Types.ObjectId(),
    chapterId: member(note?.chapterId, chapters), text: field(note.text, 1000, true), shared: note.shared === true,
  }));
  if (new Set(notes.map(note => key(note._id))).size !== notes.length) invalid();
  return notes;
}

export function validateRelationshipDraft(input, row, chapters) {
  const previous = row?.milestones || [];
  const chapterIds = new Set([...chapters.map(chapter => chapter.id), ...previous.map(note => key(note.chapterId))]);
  const savedNotes = byId(previous);
  const notes = milestones(input?.milestones, chapterIds).map(note => {
    const original = savedNotes.get(key(note._id));
    return { ...note, shared: !!original?.shared && original.text === note.text && key(original.chapterId) === note.chapterId };
  });
  return { writerNote: field(input?.writerNote, 8000), milestones: notes };
}

export function validateCharacterGuide(input, sources, saved) {
  const chapters = new Set(sources.chapters.map(chapter => chapter.id));
  // References to deleted chapters stay locked, and can be reassigned in the editor.
  for (const row of saved.characters) {
    [row.afterChapterId, row.summaryAfterChapterId, row.portraitAfterChapterId].filter(Boolean).forEach(id => chapters.add(key(id)));
  }
  for (const row of saved.relationships) {
    [row.afterChapterId, ...row.milestones.map(note => note.chapterId)].filter(Boolean).forEach(id => chapters.add(key(id)));
  }
  const after = value => value == null || value === "" ? null : member(value, chapters);
  if (!input || typeof input.enabled !== "boolean") invalid();
  const characters = list(input.characters, 300).map(row => {
    const characterId = member(row?.characterId, sources.characters);
    const portraitAssetId = row.portraitAssetId || null;
    const currentPortrait = guidePortraitAsset(characterId, sources.characters.get(characterId).imageUrl);
    const savedPortrait = saved.characters.find(item => key(item.characterId) === characterId)?.portraitAssetId;
    if (portraitAssetId && portraitAssetId !== currentPortrait && portraitAssetId !== key(savedPortrait)) invalid();
    return {
      characterId, name: field(row.name, 120, true), afterChapterId: after(row.afterChapterId),
      summary: field(row.summary ?? "", 1500), summaryAfterChapterId: after(row.summaryAfterChapterId),
      portraitAssetId, portraitAfterChapterId: after(row.portraitAfterChapterId),
    };
  });
  const savedRows = new Map(saved.relationships.map(row => [key(row.relationshipId), row]));
  const relationships = list(input.relationships, 600).map(row => {
    const relationshipId = member(row?.relationshipId, sources.relationships);
    return {
      relationshipId,
      writerNote: savedRows.get(relationshipId)?.writerNote,
      shared: row.shared === true,
      label: field(row.label ?? "", 120, row.shared === true),
      afterChapterId: after(row.afterChapterId),
      milestones: milestones(row.milestones, chapters),
    };
  });
  const relationshipIds = new Set(relationships.map(row => row.relationshipId));
  if (new Set(characters.map(row => row.characterId)).size !== characters.length ||
      relationshipIds.size !== relationships.length) invalid();
  // The guide editor does not own the private writing field.
  for (const [relationshipId, row] of savedRows) {
    if (row.writerNote && !relationshipIds.has(relationshipId) && sources.relationships.has(relationshipId)) {
      relationships.push({ relationshipId, writerNote: row.writerNote, shared: false, milestones: [] });
    }
  }
  if (relationships.length > 600) invalid();
  return { enabled: input.enabled, characters, relationships };
}

export async function readerGuideBoundary(workId, user, chapters, duringChapterId) {
  const progress = user && await ReadingProgress.findOne({ user: user.id, story: workId }).select("chapter scrollPosition").lean();
  const index = chapters.findIndex(chapter => chapter.id === key(progress?.chapter));
  const finished = Math.max(-1, index - (progress?.scrollPosition >= 100 ? 0 : 1));
  if (duringChapterId === "start") return -1;
  const readingIndex = chapters.findIndex(chapter => chapter.id === duringChapterId);
  return readingIndex < 0 ? finished : Math.min(finished, readingIndex);
}

export function visibleCharacterGuide(guide, sources, boundary) {
  const chapters = new Map(sources.chapters.map((chapter, index) => [chapter.id, { ...chapter, index }]));
  const unlocked = id => !id || (chapters.get(key(id))?.index ?? Infinity) <= boundary;
  const characters = guide.characters.flatMap(row => {
    const id = key(row.characterId);
    const source = sources.characters.get(id);
    if (!source || !unlocked(row.afterChapterId)) return [];
    const assetId = guidePortraitAsset(id, source.imageUrl);
    return [{
      id, name: row.name,
      summary: unlocked(row.summaryAfterChapterId) ? row.summary : "",
      portraitAssetId: assetId && assetId === key(row.portraitAssetId) && unlocked(row.portraitAfterChapterId) ? assetId : undefined,
    }];
  });
  const visible = new Set(characters.map(character => character.id));
  const relationships = guide.relationships.flatMap(row => {
    const id = key(row.relationshipId);
    const edge = sources.relationships.get(id);
    if (!edge || !row.shared || !unlocked(row.afterChapterId) || !visible.has(key(edge.from)) || !visible.has(key(edge.to))) return [];
    const milestones = row.milestones.filter(note => note.shared && unlocked(note.chapterId))
      .map(note => ({ id: key(note._id), text: note.text, chapter: chapters.get(key(note.chapterId)) }))
      .sort((a, b) => a.chapter.index - b.chapter.index)
      .map(({ id, text, chapter }) => ({ id, text, chapter: { id: chapter.id, title: chapter.title, order: chapter.order } }));
    return [{ id, from: key(edge.from), to: key(edge.to), directed: edge.directed, label: row.label, milestones }];
  });
  return { characters, relationships };
}
