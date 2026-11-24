import express from "express";
import mongoose from "mongoose";
import { once } from "node:events";
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import User from "../models/User.js";
import Work from "../models/Work.js";
import Chapter from "../models/Chapter.js";
import Character from "../models/Character.js";
import Relationship from "../models/Relationship.js";
import CharacterGuide from "../models/CharacterGuide.js";
import ImageAsset from "../models/ImageAsset.js";
import { createNativeSession } from "../services/authSession.js";
import { newTermsAcceptance } from "../config/terms.js";
import publicRoutes from "../routes/public.js";
import { authorCharacterGuide } from "../routes/characterGuide.js";
import progressRoutes from "../routes/readingProgress.js";

vi.mock("../services/emailService.js", () => ({ sendMail: vi.fn(), sendStaffMail: vi.fn(), SITE_URL: "https://example.test" }));
const uri = process.env.CHAPTER_TEST_MONGO_URI;
const id = item => String(item._id);

describe.skipIf(!uri)("character guide publishing and spoiler boundaries", () => {
  const database = `character_guide_${randomUUID().replaceAll("-", "")}`;
  let server, base, owner, reader, otherReader, work, first, second, draft, a, b, asset, config, edit, read;

  beforeAll(async () => {
    if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):\d+\/?(?:\?.*)?$/.test(uri)) throw new Error("Loopback test database only");
    vi.stubEnv("JWT_SECRET", randomBytes(48).toString("hex"));
    await mongoose.connect(uri, { dbName: database });
    const app = express();
    app.use(express.json());
    app.use("/api/works/:id/character-guide", authorCharacterGuide);
    app.use("/api/public", publicRoutes);
    app.use("/api/reading-progress", progressRoutes);
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    base = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.name === database) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    vi.unstubAllEnvs();
  });

  async function session() {
    const user = await User.create({ email: `${randomUUID()}@guide.test`, kullaniciAdi: randomUUID(), birthYear: 1990, ...newTermsAcceptance() });
    return { user, token: await createNativeSession(user) };
  }

  beforeEach(async () => {
    [owner, reader, otherReader] = await Promise.all([session(), session(), session()]);
    work = await Work.create({ user: owner.user._id, title: "Karakterlerin Eseri", status: "published" });
    [first, second, draft] = await Chapter.create([
      { work: work._id, title: "Tanışma", order: 1, status: "published" },
      { work: work._id, title: "Yüzleşme", order: 2, status: "published" },
      { work: work._id, title: "DRAFT_CHAPTER", order: 3, status: "draft" },
    ]);
    await Work.updateOne({ _id: work._id }, { publishedChapterIds: [second._id, first._id, draft._id] });
    const scope = { work: work._id, user: owner.user._id };
    [a, b] = await Character.create([
      { ...scope, name: "Lavinia", notes: "PRIVATE_CHARACTER_NOTE", role: "PRIVATE_ROLE" },
      { ...scope, name: "Kevin" },
    ]);
    const edge = await Relationship.create({ ...scope, from: a._id, to: b._id, type: "family", label: "PRIVATE_EDGE_LABEL" });
    const assetId = new mongoose.Types.ObjectId();
    const portrait = `/api/characters/${a._id}/portrait/${assetId}`;
    asset = await ImageAsset.create({ _id: assetId, owner: owner.user._id, privatePortrait: true, url: portrait, bytes: Buffer.from("webp"), mime: "image/webp" });
    await Character.updateOne({ _id: a._id }, { imageUrl: portrait });
    edit = `/api/works/${work._id}/character-guide`;
    read = `/api/public/works/${work._id}/character-guide`;
    config = {
      enabled: true, revision: 0,
      characters: [
        { characterId: id(a), name: "Lavinia", summary: "SUMMARY_UNLOCKED", summaryAfterChapterId: id(first),
          portraitAssetId: id(asset), portraitAfterChapterId: id(first) },
        { characterId: id(b), name: "Kevin", afterChapterId: id(first) },
      ],
      relationships: [{
        relationshipId: id(edge), shared: true, label: "Aile", afterChapterId: id(first),
        milestones: [
          { chapterId: id(second), text: "SHARED_SECOND", shared: true },
          { chapterId: id(first), text: "SHARED_FIRST", shared: true },
          { chapterId: id(first), text: "PRIVATE_FIRST", shared: false },
          { chapterId: id(draft), text: "SHARED_BUT_DRAFT", shared: true },
        ],
      }],
    };
  });

  async function request(path, { viewer, method = "GET", body } = {}) {
    const response = await fetch(base + path, { method, headers: {
      "Content-Type": "application/json", ...(viewer ? { Authorization: `Bearer ${viewer.token}` } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const payload = response.headers.get("content-type")?.includes("json") ? await response.json() : await response.text();
    return { status: response.status, headers: response.headers, body: payload };
  }

  const save = (body = config, viewer = owner) => request(edit, { viewer, method: "PUT", body });
  const progress = (viewer, chapter, scrollPosition) => request("/api/reading-progress", {
    viewer, method: "POST", body: { storyId: id(work), chapterId: id(chapter), scrollPosition },
  });

  it("starts private, scopes all writes to the owner and preserves concurrent edits", async () => {
    expect((await request(read)).status).toBe(404);
    expect((await request(edit)).status).toBe(401);
    expect((await save(config, reader)).status).toBe(404);
    const results = await Promise.all([save(), save()]);
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    const saved = await request(edit, { viewer: owner });
    expect(saved.body.guide).toMatchObject({ revision: 1, enabled: true });
    expect(JSON.stringify(saved.body.guide)).toContain("PRIVATE_FIRST");
    expect((await request(`/api/public/works/${work._id}`)).body.item.hasCharacterGuide).toBe(true);
  });

  it("shares only approved details at the recipient's progress, including when opening deep links", async () => {
    expect((await save()).status).toBe(200);
    const anonymous = await request(read + `?character=${b._id}&duringChapter=${second._id}`);
    expect(anonymous.headers.get("cache-control")).toBe("private, no-store");
    expect(anonymous.body.item).toMatchObject({ characters: [{ name: "Lavinia", summary: "" }], relationships: [] });
    expect(anonymous.body.item.characters[0]).not.toHaveProperty("imageUrl");
    expect((await progress(reader, first, 99)).status).toBe(200);
    expect((await request(read, { viewer: reader })).body.item.relationships).toEqual([]);
    expect((await progress(reader, first, 100)).status).toBe(200);
    const result = await request(read, { viewer: reader });
    expect(result.body.item.characters.find(person => person.id === id(a)).summary).toBe("SUMMARY_UNLOCKED");
    expect(result.body.item.relationships[0].milestones.map(note => note.text)).toEqual(["SHARED_FIRST"]);
    expect((await request(read, { viewer: otherReader })).body.item.characters).toHaveLength(1);
    expect((await progress(reader, second, 100)).status).toBe(200);
    const later = await request(read, { viewer: reader });
    expect(later.body.item.relationships[0].milestones.map(note => note.text)).toEqual(["SHARED_FIRST", "SHARED_SECOND"]);
    expect(JSON.stringify(later.body)).not.toMatch(/PRIVATE_|SHARED_BUT_DRAFT|DRAFT_CHAPTER/);
    expect((await request(read + `?duringChapter=${first._id}`, { viewer: reader })).body.item.relationships[0].milestones).toHaveLength(1);
    expect((await request(read + "?duringChapter=start", { viewer: reader })).body.item.relationships).toEqual([]);
  });

  it("protects portrait bytes, including direct requests and after moderation or guide removal", async () => {
    await save();
    const portraitPath = `${read}/portraits/${a._id}/${asset._id}`;
    expect((await request(portraitPath)).status).toBe(404);
    expect((await request(portraitPath, { viewer: reader })).status).toBe(404);
    await progress(reader, second, 0);
    const guide = await request(read, { viewer: reader });
    expect(guide.body.item.characters.find(person => person.id === id(a)).imageUrl).toBe(portraitPath);
    const picture = await request(portraitPath, { viewer: reader });
    expect(picture.status).toBe(200);
    expect(picture.headers.get("content-type")).toBe("image/webp");
    expect(picture.body).toBe("webp");
    await ImageAsset.updateOne({ _id: asset._id }, { state: "removed" });
    expect((await request(portraitPath, { viewer: reader })).status).toBe(404);
    expect((await save({ ...config, revision: 1, enabled: false })).status).toBe(200);
    expect((await request(read, { viewer: reader })).status).toBe(404);
    expect((await request(`/api/public/works/${work._id}`)).body.item).not.toHaveProperty("hasCharacterGuide");
  });

  it("previews unsaved choices privately and rejects references from another work", async () => {
    const otherWork = await Work.create({ user: owner.user._id, title: "Diğer" });
    const foreignChapter = await Chapter.create({ work: otherWork._id, title: "Başka eser" });
    config.characters[0].summaryAfterChapterId = id(foreignChapter);
    expect((await save()).status).toBe(400);
    config.characters[0].summaryAfterChapterId = id(first);
    const preview = body => request(edit + "/preview", { viewer: owner, method: "POST", body });
    const result = await preview({ ...config, enabled: false, previewAfterChapterId: id(second) });
    expect(result.body.item.relationships[0].milestones).toHaveLength(2);
    expect(JSON.stringify(result.body)).not.toMatch(/PRIVATE_|SHARED_BUT_DRAFT/);
    expect(await CharacterGuide.exists({ _id: work._id })).toBeNull();
    expect((await request(read)).status).toBe(404);
    await Work.updateOne({ _id: work._id }, { status: "draft" });
    expect((await save()).status).toBe(400);
    expect((await save({ ...config, enabled: false })).status).toBe(200);
  });

  it("keeps hidden or removed chapters locked and applies the book's mature access restrictions", async () => {
    await save();
    await progress(reader, second, 100);
    await Chapter.updateOne({ _id: first._id }, { status: "draft" });
    expect((await request(read, { viewer: reader })).body.item.relationships).toEqual([]);
    await Work.updateOne({ _id: work._id }, { contentWarning: true });
    expect((await request(read)).status).toBe(404);
    expect((await request(read, { viewer: reader })).status).toBe(428);
    await request(`/api/public/works/${work._id}/mature-acknowledgement`, { viewer: reader, method: "POST" });
    expect((await request(read, { viewer: reader })).status).toBe(200);
  });

  it("keeps the writer note private while reusing the guide timeline and leaves sharing with the guide editor", async () => {
    const path = `${edit}/relationships/${config.relationships[0].relationshipId}`;
    const open = () => request(path, { viewer: owner });
    const write = body => request(path, { viewer: owner, method: "PUT", body });
    expect((await open()).body.draft).toEqual({ writerNote: "", milestones: [], revision: 0 });
    expect((await request(path, { viewer: reader })).status).toBe(404);
    expect((await save()).status).toBe(200);
    const { body: { draft: current } } = await open();
    const edited = current.milestones.map(note => note.text === "SHARED_SECOND" ? { ...note, text: "EDITED_IN_STUDIO", shared: true } : note);
    const privateNote = "WRITER_NOTE_SECRET";
    const result = await write({ ...current, writerNote: privateNote, milestones: edited });
    expect(result.status).toBe(200);
    expect(result.body.draft).toMatchObject({ writerNote: privateNote, revision: 2 });
    expect(result.body.draft.milestones.find(note => note.text === "EDITED_IN_STUDIO").shared).toBe(false);
    expect(result.body.draft.milestones.find(note => note.text === "SHARED_FIRST").shared).toBe(true);
    expect((await write({ ...current, writerNote: "STALE" })).status).toBe(409);
    await progress(reader, second, 100);
    const publicGuide = await request(read, { viewer: reader });
    expect(JSON.stringify(publicGuide.body)).not.toMatch(/WRITER_NOTE_SECRET|EDITED_IN_STUDIO/);
    const editor = await request(edit, { viewer: owner });
    expect(JSON.stringify(editor.body)).not.toContain(privateNote);
    const guide = editor.body.guide;
    guide.relationships[0].milestones.find(note => note.text === "EDITED_IN_STUDIO").shared = true;
    const publish = await save(guide);
    expect(publish.status).toBe(200);
    expect((await open()).body.draft.writerNote).toBe(privateNote);
    expect(JSON.stringify(publish.body)).not.toContain(privateNote);
    const laterGuide = await request(read, { viewer: reader });
    expect(laterGuide.body.item.relationships[0].milestones.map(note => note.text)).toEqual(["SHARED_FIRST", "EDITED_IN_STUDIO"]);
  });

  it("can create a private timeline before the book has a published guide", async () => {
    const path = `${edit}/relationships/${config.relationships[0].relationshipId}`;
    await Work.updateOne({ _id: work._id }, { status: "draft" });
    const body = { writerNote: "Özel taslak", revision: 0,
      milestones: [{ chapterId: id(draft), text: "Plan", shared: true }] };
    expect((await request(path, { viewer: reader, method: "PUT", body })).status).toBe(404);
    const writes = await Promise.all([
      request(path, { viewer: owner, method: "PUT", body }),
      request(path, { viewer: owner, method: "PUT", body }),
    ]);
    expect(writes.map(result => result.status).sort()).toEqual([200, 409]);
    const saved = writes.find(result => result.status === 200).body.draft;
    expect(saved.milestones[0]).toMatchObject({ text: "Plan", shared: false });
    expect((await request(read)).status).toBe(404);
  });
});
