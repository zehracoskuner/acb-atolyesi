import express from "express";
import ensureAuth from "../middlewares/ensureAuth.js";
import Work from "../models/Work.js";
import CharacterGuide from "../models/CharacterGuide.js";
import ImageAsset from "../models/ImageAsset.js";
import { guideSources, readerGuideBoundary, validGuideId, validateCharacterGuide, validateRelationshipDraft, visibleCharacterGuide } from "../services/characterGuide.js";

const fields = "user title status contentWarning publishedChapterIds customChapterTitles";
const emptyGuide = { enabled: false, revision: 0, characters: [], relationships: [] };
const missing = res => res.status(404).json({ message: "Karakter Rehberi bulunamadı." });
const conflict = res => res.status(409).json({ message: "Bu kayıt başka bir oturumda değişti. Son sürümü açıp değişikliklerini yeniden uygula." });
const withoutWriterNote = ({ relationshipId, shared, label, afterChapterId, milestones }) =>
  ({ relationshipId, shared, label, afterChapterId, milestones });
export const authorCharacterGuide = express.Router({ mergeParams: true });
export const publicCharacterGuide = express.Router({ mergeParams: true });

async function loadEditor(req, res, next) {
  try {
    const { id } = req.params;
    if (!validGuideId(id)) return missing(res);
    const work = await Work.findOne({ _id: id, user: req.user.id }).select(fields).lean();
    if (!work) return missing(res);
    const [guide, sources] = await Promise.all([CharacterGuide.findById(work._id).lean(), guideSources(work)]);
    req.guideEditor = { work, guide: guide || emptyGuide, sources };
    next();
  } catch (error) { next(error); }
}

function writeGuide(workId, guide, update) {
  return CharacterGuide.findOneAndUpdate(
    { _id: workId, revision: guide.revision }, { $set: update, $inc: { revision: 1 } },
    { new: true, upsert: guide === emptyGuide, setDefaultsOnInsert: false, runValidators: true },
  ).lean();
}

authorCharacterGuide.use(ensureAuth, loadEditor);
authorCharacterGuide.get("/", (req, res) => {
  const { guide, work, sources } = req.guideEditor;
  const characters = guide.characters.filter(row => sources.characters.has(String(row.characterId)));
  const relationships = guide.relationships.filter(row => sources.relationships.has(String(row.relationshipId))).map(withoutWriterNote);
  res.json({ guide: { enabled: guide.enabled, revision: guide.revision, characters, relationships },
    chapters: sources.chapters, published: work.status === "published" });
});

authorCharacterGuide.put("/", async (req, res, next) => {
  const { work, guide, sources } = req.guideEditor;
  try {
    if (req.body?.revision !== guide.revision) return conflict(res);
    const input = validateCharacterGuide(req.body, sources, guide);
    if (input.enabled && work.status !== "published") {
      return res.status(400).json({ message: "Rehberi açmak için önce kitabı yayımla." });
    }
    const item = await writeGuide(work._id, guide, input);
    if (!item) return conflict(res);
    const { enabled, revision, characters, relationships } = item;
    return res.json({ guide: { enabled, revision, characters, relationships: relationships.map(withoutWriterNote) } });
  } catch (error) {
    if (error.code === 11000) return conflict(res);
    if (error.status === 400) return res.status(400).json({ message: error.message });
    next(error);
  }
});

const draftPath = "/relationships/:relationshipId";
function draftScope(req, res, next) {
  const { relationshipId } = req.params;
  const { guide, sources } = req.guideEditor;
  const edge = validGuideId(relationshipId) && sources.relationships.get(relationshipId);
  if (!edge || edge.status === "archived" || !sources.characters.has(String(edge.from)) || !sources.characters.has(String(edge.to))) {
    return res.status(404).json({ message: "Bağ bulunamadı." });
  }
  req.relationshipRow = guide.relationships.find(row => String(row.relationshipId) === relationshipId);
  next();
}
const draftPayload = (row, revision) => ({ writerNote: row?.writerNote ?? "", milestones: row?.milestones || [], revision });

authorCharacterGuide.get(draftPath, draftScope, (req, res) => {
  const { guide, sources } = req.guideEditor;
  res.json({ draft: draftPayload(req.relationshipRow, guide.revision), chapters: sources.chapters });
});

authorCharacterGuide.put(draftPath, draftScope, async (req, res, next) => {
  const { work, guide, sources } = req.guideEditor;
  const { relationshipId } = req.params;
  try {
    if (req.body?.revision !== guide.revision) return conflict(res);
    const { relationshipRow } = req;
    const draft = validateRelationshipDraft(req.body, relationshipRow, sources.chapters);
    const row = { ...relationshipRow, relationshipId, ...draft };
    const relationships = guide.relationships.filter(item => String(item.relationshipId) !== relationshipId && sources.relationships.has(String(item.relationshipId)));
    if (relationships.length >= 600) return res.status(400).json({ message: "Bu çalışmadaki ilişki notu sınırına ulaşıldı." });
    const item = await writeGuide(work._id, guide, { enabled: guide.enabled, characters: guide.characters, relationships: [...relationships, row] });
    if (!item) return conflict(res);
    return res.json({ draft: draftPayload(item.relationships.find(saved => String(saved.relationshipId) === relationshipId), item.revision) });
  } catch (error) {
    if (error.code === 11000) return conflict(res);
    if (error.status === 400) return res.status(400).json({ message: error.message });
    next(error);
  }
});

authorCharacterGuide.post("/preview", async (req, res, next) => {
  const { work, guide, sources } = req.guideEditor;
  try {
    const input = validateCharacterGuide(req.body, sources, guide);
    const previewSources = { ...sources, chapters: sources.chapters.filter(chapter => chapter.published) };
    const boundary = previewSources.chapters.findIndex(chapter => chapter.id === req.body.previewAfterChapterId);
    const item = visibleCharacterGuide(input, previewSources, boundary);
    return res.json({ item: { ...item, title: work.title, characters: item.characters.map(({ portraitAssetId, ...person }) => ({
      ...person, ...(portraitAssetId ? { imageUrl: `/api/characters/${person.id}/portrait/${portraitAssetId}` } : {}),
    })) } });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ message: error.message });
    next(error);
  }
});

async function loadPublicGuide(req, res, next) {
  res.set("Cache-Control", "private, no-store");
  const { id } = req.params;
  if (!validGuideId(id)) return missing(res);
  try {
    const work = await Work.findOne({ _id: id, status: "published" }).select(fields).lean();
    if (!work) return missing(res);
    const guide = await CharacterGuide.findOne({ _id: work._id, enabled: true }).lean();
    if (!guide) return missing(res);
    if (work.contentWarning && !req.user?.matureAcknowledgements?.some(id => String(id) === String(work._id))) {
      return res.status(428).json({ code: "MATURE_ACKNOWLEDGEMENT_REQUIRED", workId: String(work._id) });
    }
    const sources = await guideSources(work, { published: true });
    const boundary = await readerGuideBoundary(work._id, req.user, sources.chapters, req.query.duringChapter);
    req.visibleGuide = { work, ...visibleCharacterGuide(guide, sources, boundary) };
    next();
  } catch (error) { next(error); }
}
publicCharacterGuide.use(loadPublicGuide);
publicCharacterGuide.get("/", (req, res) => {
  const { work, characters, relationships } = req.visibleGuide;
  const during = req.query.duringChapter;
  const scope = during === "start" || validGuideId(during) ? `?duringChapter=${during}` : "";
  return res.json({ item: {
    title: work.title, relationships,
    characters: characters.map(({ portraitAssetId, ...person }) => ({
      ...person, ...(portraitAssetId ? { imageUrl: `/api/public/works/${work._id}/character-guide/portraits/${person.id}/${portraitAssetId}${scope}` } : {}),
    })),
  } });
});
publicCharacterGuide.get("/portraits/:characterId/:assetId", async (req, res, next) => {
  const { work, characters } = req.visibleGuide;
  const { characterId, assetId } = req.params;
  if (!characters.some(person => person.id === characterId && person.portraitAssetId === assetId)) return res.sendStatus(404);
  try {
    const url = `/api/characters/${characterId}/portrait/${assetId}`;
    const asset = await ImageAsset.findOne({ _id: assetId, owner: work.user, url, privatePortrait: true, state: "active" })
      .select("+bytes");
    if (!asset?.bytes) return res.sendStatus(404);
    return res.set("X-Content-Type-Options", "nosniff").type("image/webp").send(asset.bytes);
  } catch (error) { next(error); }
});
