import { sessionStore } from "./fixtures/sessionStore.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
// Keep dormant history code covered; production flag is tested separately.
vi.mock("../../shared/features.js", () => ({ CHAPTER_HISTORY_ENABLED: true }));
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import Chapter from "../models/Chapter.js";
import mongoose from "mongoose";
import Fingerprint from "../models/DevelopmentFingerprint.js";
import Sample from "../models/DevelopmentSample.js";
import ChapterVersion from "../models/ChapterVersion.js";
import Work from "../models/Work.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import chapterRouter from "../routes/chapter.js";
import worksRouter from "../routes/works.js";
import publicRouter from "../routes/public.js";
import searchRouter from "../routes/search.js";
import feedRouter from "../routes/feed.js";
import libraryRouter from "../routes/library.js";
import Log from "../models/Log.js";
import Library from "../models/Library.js";
import moderatorRouter from "../routes/moderator.js";
import workNotesRouter from "../routes/workNotes.js";
import beatsRouter from "../routes/beats.js";
import WorkNote from "../models/WorkNote.js";
import Beat from "../models/Beat.js";
import ensureAuth from "../middlewares/ensureAuth.js";
import requireRole from "../middlewares/requireRole.js";
import cookieParser from "cookie-parser";
import { newTermsAcceptance } from "../config/terms.js";
import { moderateChapter } from "../utils/aiModerator.js";
import { sendMail, sendStaffMail } from "../services/emailService.js";

vi.mock("../utils/aiModerator.js", () => ({ moderateChapter: vi.fn() }));
vi.mock("../services/emailService.js", () => ({
  sendMail: vi.fn(), sendStaffMail: vi.fn(), SITE_URL: "https://example.test",
}));
vi.mock("../services/notificationService.js", () => ({ notifyFollow: vi.fn(), notifyCommentRemoved: vi.fn() }));

const id = (n) => n.toString(16).padStart(24, "0");
const A = id(1), B = id(2), STAFF = id(3);
const WA = id(10), WB = id(11), WB2 = id(12);
const CA = id(20), CB = id(21), DRAFT = id(22), SECOND = id(23);
let db, writes, server, baseUrl, issue;

// Route ve JWT middleware gerçektir. Yalnızca depolama ve dış servisler
// izoledir: hiçbir MongoDB bağlantısı açılmaz veya gerçek veri kullanılmaz.
function matches(row, filter) {
  return Object.entries(filter).every(([key, expected]) => {
    if (key === "$or") return expected.some(part => matches(row, part));
    const actual = row[key];
    if (expected instanceof RegExp) return expected.test(actual ?? "");
    if (expected && typeof expected === "object" && !(expected instanceof Array) && !expected.toHexString) {
      if (Object.hasOwn(expected, "$ne")) return actual !== expected.$ne;
      if (expected.$in) return expected.$in.some((value) => String(value) === String(actual));
      if (expected.$exists !== undefined && (actual !== undefined) !== expected.$exists) return false;
      if (expected.$not?.$size !== undefined) return actual?.length !== expected.$not.$size;
    }
    return String(actual) === String(expected);
  });
}

function query(value) {
  const chain = {
    session: () => chain,
    select: () => chain,
    populate: (path) => {
      if (path === "user") {
        for (const work of (Array.isArray(value) ? value : [value])) {
          if (work?.user && db.users[String(work.user)]) work.user = User.hydrate(db.users[String(work.user)]);
        }
      }
      return chain;
    },
    lean: () => chain,
    cursor: () => (async function* () { for (const row of value) yield row; })(),
    limit: () => chain, skip: () => chain,
    sort: (sort) => {
      if (Array.isArray(value)) {
        const [key, direction] = Object.entries(sort)[0];
        value.sort((a, b) => (a[key] - b[key]) * direction);
      }
      return chain;
    },
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return chain;
}

function mockStorage(Model, collection) {
  const hydrate = (row) => row ? Model.hydrate(structuredClone(row)) : null;
  vi.spyOn(Model, "findById").mockImplementation((key) => query(hydrate(db[collection][String(key)])));
  vi.spyOn(Model, "findOne").mockImplementation((filter) =>
    query(hydrate(Object.values(db[collection]).find((row) => matches(row, filter)))));
  vi.spyOn(Model, "find").mockImplementation((filter) =>
    query(Object.values(db[collection]).filter((row) => matches(row, filter)).map(hydrate)));
  vi.spyOn(Model, "countDocuments").mockImplementation((filter) =>
    query(Object.values(db[collection]).filter(row => matches(row, filter)).length));
  vi.spyOn(Model.prototype, "save").mockImplementation(async function () {
    writes.push([collection, "save", String(this._id)]);
    db[collection][String(this._id)] = JSON.parse(JSON.stringify(this.toObject()));
    return this;
  });
  vi.spyOn(Model.prototype, "deleteOne").mockImplementation(async function () {
    writes.push([collection, "delete", String(this._id)]);
    delete db[collection][String(this._id)];
  });
  vi.spyOn(Model.prototype, "populate").mockImplementation(async function (path) {
    await query(this).populate(path);
    return this;
  });
}

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", randomBytes(32).toString("hex"));
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/chapters", chapterRouter);
  app.use("/api/works", worksRouter);
  app.use("/api/public", publicRouter);
  app.use("/api/search", searchRouter);
  app.use("/api/feed", feedRouter);
  app.use("/api/library", libraryRouter);
  app.use("/api/moderator", ensureAuth, requireRole("admin", "moderator"), moderatorRouter);
  app.use("/api/works/:workId/notes", workNotesRouter);
  app.use("/api/beats", beatsRouter);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  vi.unstubAllEnvs();
});

beforeEach(() => {
  issue = sessionStore();
  writes = [];
  db = {
    works: {
      [WA]: { _id: WA, user: A, title: "A eseri", status: "published", publishedChapterIds: [CA] },
      [WB]: { _id: WB, user: B, title: "B eseri", status: "published", publishedChapterIds: [CB] },
      [WB2]: { _id: WB2, user: B, title: "B ikinci eser", status: "draft", publishedChapterIds: [] },
    },
    chapters: {
      [CA]: { _id: CA, work: WA, title: "A bölümü", content: "A içeriği", status: "published", order: 1 },
      [CB]: { _id: CB, work: WB, title: "B bölümü", content: "B özel içeriği", status: "published", order: 1 },
      [DRAFT]: { _id: DRAFT, work: WA, title: "Taslak", content: "Gizli taslak", status: "draft", order: 2 },
      [SECOND]: { _id: SECOND, work: WA, title: "İkinci", content: "İkinci içerik", status: "published", order: 3 },
    },
    users: {
      [A]: { _id: A, contentBanned: false, role: "user" },
      [B]: { _id: B, contentBanned: false, role: "user" },
      [STAFF]: { _id: STAFF, role: "moderator" },
    },
    notifications: [],
  };
  Object.values(db.users).forEach(user => Object.assign(user, { birthYear: 1990 }, newTermsAcceptance()));
  db.versions = [];
  db.fingerprints = []; db.samples = [];
  vi.spyOn(Fingerprint, "exists").mockImplementation(filter => query(db.fingerprints.find(v => matches(v, filter)) || null));
  vi.spyOn(Fingerprint, "updateOne").mockImplementation(async (filter, update) => { if (!db.fingerprints.some(v => matches(v, filter))) db.fingerprints.push(update.$setOnInsert); });
  vi.spyOn(Sample, "create").mockImplementation(async rows => { db.samples.push(...rows); return rows; });
  Object.values(db.chapters).forEach(ch => { ch.revision = 0; ch.updatedAt = "2026-09-01T00:00:00.000Z"; });
  // Isolated storage transaction double: commit as a unit or roll back every collection.
  // Real MongoDB transaction/replica-set behavior needs the separate integration test.
  let queue = Promise.resolve();
  vi.spyOn(mongoose.connection, "transaction").mockImplementation(fn => {
    const task = queue.then(async () => {
      const before = structuredClone(db);
      try { return await fn({ testSession: true }); }
      catch (err) { db = before; throw err; }
    });
    queue = task.catch(() => {});
    return task;
  });
  vi.spyOn(ChapterVersion, "exists").mockImplementation(filter => query(db.versions.find(v => matches(v, filter)) || null));
  vi.spyOn(ChapterVersion, "findOne").mockImplementation(filter => query(db.versions.find(v => matches(v, filter)) || null));
  vi.spyOn(ChapterVersion, "find").mockImplementation(filter => query(db.versions.filter(v => matches(v, filter))));
  vi.spyOn(ChapterVersion, "create").mockImplementation(async rows => {
    db.versions.push(...JSON.parse(JSON.stringify(rows)));
    return rows;
  });
  mockStorage(Work, "works");
  mockStorage(Chapter, "chapters");
  vi.spyOn(Work, "findByIdAndUpdate").mockImplementation(async (key, update) => {
    writes.push(["works", "update", String(key)]);
    const work = db.works[String(key)];
    if (update.$pull) work.publishedChapterIds = work.publishedChapterIds.filter(
      (value) => value !== String(update.$pull.publishedChapterIds));
    if (update.$addToSet) work.publishedChapterIds = [...new Set([
      ...work.publishedChapterIds, String(update.$addToSet.publishedChapterIds),
    ])];
    return Work.hydrate(structuredClone(work));
  });
  vi.spyOn(User, "findById").mockImplementation((key) => query(db.users[String(key)]));
  vi.spyOn(User, "findOne").mockImplementation((filter) => query(Object.values(db.users).find((row) => matches(row, filter))));
  vi.spyOn(User, "find").mockImplementation((filter) => query(Object.values(db.users).filter((row) => matches(row, filter))));
  vi.spyOn(Notification, "create").mockImplementation(async (notification) => {
    db.notifications.push(JSON.parse(JSON.stringify(notification)));
  });
  moderateChapter.mockResolvedValue({ severity: "clean" });
  // Yetki retlerinin beklenen sunucu loglarını test çıktısına taşımıyoruz.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

async function request(user, method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (user) headers.Authorization = `Bearer ${issue(db.users[user])}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json(), headers: response.headers };
}

function expectNoEffects(snapshot) {
  expect(db).toEqual(snapshot);
  expect(writes).toEqual([]);
  expect(moderateChapter).not.toHaveBeenCalled();
  expect(sendMail).not.toHaveBeenCalled();
  expect(sendStaffMail).not.toHaveBeenCalled();
}

describe("Direct HTTP reader access", () => {
  const textPath = `/api/public/works/${WA}/chapters/${CA}`;

  it("guests receive previews and metadata, never chapter prose or studio notes", async () => {
    db.works[WA].description = "Public description";
    db.works[WA].preface = "Public preface";
    db.works[WA].universe = { genres: ["Fantastik"], rules: "Private rules", tone: "Private tone", themes: "Private themes" };
    db.works[WA].customChapterTitles = { [CA]: "Public title", [DRAFT]: "Private title" };
    const preview = await request(null, "GET", `/api/public/works/${WA}`);
    expect(preview.status).toBe(200);
    expect(preview.body.item).toMatchObject({ description: "Public description", preface: "Public preface" });
    expect(preview.body.item.universe).toEqual({ genres: ["Fantastik"], genre: "" });
    expect(preview.body.item.customChapterTitles).toEqual({ [CA]: "Public title" });
    const list = await request(null, "GET", `/api/public/works/${WA}/chapters`);
    expect(list.status).toBe(200);
    expect(Object.keys(list.body.items[0]).sort()).toEqual(["_id", "order", "title"]);
    for (const path of [textPath, `/api/chapters/${CA}`, `/api/chapters?workId=${WA}`, `/api/works/${WA}/chapters`]) {
      const result = await request(null, "GET", path);
      expect(result.status).toBe(401);
      expect(result.headers.get("cache-control")).toBe("private, no-store");
      expect(result.body).not.toHaveProperty("item");
    }
    for (const path of ["/api/works/discover", "/api/search/works?q=eseri"]) {
      const result = await request(null, "GET", path);
      expect(result.status).toBe(200);
      expect(result.body.items.length).toBeGreaterThan(0);
      expect(JSON.stringify(result.body)).not.toContain("Private");
      expect(JSON.stringify(result.body)).not.toContain(db.chapters[CA].content);
    }
  });

  it("valid members can read published text, with private no-store responses", async () => {
    for (const user of [A, B, STAFF]) {
      const result = await request(user, "GET", textPath);
      expect(result.status).toBe(200);
      expect(result.body.item.content).toBe(db.chapters[CA].content);
      expect(Object.keys(result.body.item).sort()).toEqual(["_id", "content", "order", "title"]);
      expect(result.headers.get("cache-control")).toBe("private, no-store");
      expect(result.headers.get("vary")).toContain("Authorization");
      expect(result.headers.get("vary")).toContain("Cookie");
    }
  });

  it("accepts cookie sessions and rejects invalid or expired tokens directly over HTTP", async () => {
    const cookie = issue(db.users[B]);
    const valid = await fetch(baseUrl + textPath, { headers: { Cookie: `token=${cookie}` } });
    expect(valid.status).toBe(200);
    for (const token of ["invalid", jwt.sign({ id: B }, process.env.JWT_SECRET, { expiresIn: -1 })]) {
      const result = await fetch(baseUrl + textPath, { headers: { Authorization: `Bearer ${token}` } });
      expect(result.status).toBe(401);
      expect(await result.text()).not.toContain(db.chapters[CA].content);
    }
  });

  it.each(["draft", "pending_review", "rejected"])("membership and staff roles do not unlock %s chapters", async status => {
    db.chapters[CA].status = status;
    for (const user of [B, STAFF]) {
      expect((await request(user, "GET", textPath)).status).toBe(404);
      expect((await request(user, "GET", `/api/chapters/${CA}`)).status).toBe(403);
    }
    const owner = await request(A, "GET", `/api/chapters/${CA}`);
    expect(owner.status).toBe(200);
    expect(owner.body.item.content).toBe(db.chapters[CA].content);
  });

  it("checks the work status, chapter membership, list membership and malformed IDs", async () => {
    db.works[WA].publishedChapterIds.push(CB);
    expect((await request(B, "GET", `/api/public/works/${WA}/chapters/${CB}`)).status).toBe(404);
    expect((await request(B, "GET", `/api/public/works/${WA}/chapters/${SECOND}`)).status).toBe(404);
    expect((await request(B, "GET", `/api/public/works/${WA}/chapters/invalid`)).status).toBe(400);
    db.works[WA].status = "draft";
    expect((await request(B, "GET", textPath)).status).toBe(404);
    expect((await request(null, "GET", `/api/public/works/${WA}`)).status).toBe(404);
  });

  it("retains staff access only through the review queue", async () => {
    db.chapters[CA].status = "pending_review";
    expect((await request(null, "GET", "/api/moderator/chapters")).status).toBe(401);
    expect((await request(B, "GET", "/api/moderator/chapters")).status).toBe(403);
    for (const role of ["moderator", "admin"]) {
      db.users[STAFF].role = role;
      const result = await request(STAFF, "GET", "/api/moderator/chapters");
      expect(result.status).toBe(200);
      expect(result.body.bolumler.map(ch => String(ch._id))).toEqual([CA]);
      expect(result.body.bolumler[0].content).toBe(db.chapters[CA].content);
      expect(result.headers.get("cache-control")).toBe("private, no-store");
    }
  });

  it("protects other studio notes from guests, other members and staff", async () => {
    vi.spyOn(WorkNote, "find").mockReturnValue(query([{ title: "Private note", body: "Private body" }]));
    vi.spyOn(Beat, "find").mockReturnValue(query([{ title: "Private beat", notes: "Private plan" }]));
    for (const path of [`/api/works/${WA}/notes`, `/api/beats?workId=${WA}&plotId=${id(100)}`]) {
      expect((await request(null, "GET", path)).status).toBe(401);
      for (const user of [B, STAFF]) expect((await request(user, "GET", path)).status).toBe(404);
      const owner = await request(A, "GET", path);
      expect(owner.status).toBe(200);
      expect(owner.headers.get("cache-control")).toBe("private, no-store");
      expect(owner.body.items.length).toBe(1);
    }
  });
});

describe("İki kullanıcı arasında bölüm sahipliği", () => {
  it.each([
    ["GET", `/api/chapters/${CB}`, undefined],
    ["GET", `/api/chapters?workId=${WB}`, undefined],
    ["GET", `/api/works/${WB}/chapters`, undefined],
    ["PUT", `/api/chapters/${CB}`, { expectedRevision: 0, title: "Ele geçirilen", content: "Değiştirildi", workId: WA }],
    ["DELETE", `/api/chapters/${CB}`, undefined],
    ...["draft", "published"].flatMap((status) => [
      ["PATCH", `/api/chapters/${CB}/status`, { status, workId: WA }],
      ["PATCH", `/api/chapters/${CB}/status`, { status, workId: WB }],
      ["PATCH", `/api/chapters/${CB}/status`, { status }],
    ]),
  ])("A, B bölümüne erişemez: %s %s %j", async (method, path, body) => {
    const snapshot = structuredClone(db);
    const result = await request(A, method, path, body);
    expect([403, 404]).toContain(result.status);
    expect(Object.keys(result.body)).toEqual(["message"]);
    expect(JSON.stringify(result.body)).not.toContain("B özel içeriği");
    expectNoEffects(snapshot);
  });

  it.each([WA, WB2, null, "", { $ne: WB }].flatMap((workId) =>
    ["draft", "published"].map((status) => ({ workId, status }))
  ))("Sahibin uyumsuz workId girdisi de reddedilir: %j", async ({ workId, status }) => {
    const snapshot = structuredClone(db);
    const result = await request(B, "PATCH", `/api/chapters/${CB}/status`, { status, workId });
    expect(result.status).toBe(400);
    expect(Object.keys(result.body)).toEqual(["message"]);
    expectNoEffects(snapshot);
  });

  it.each([undefined, WB, WB.toUpperCase()])("Sahibi yayın ve taslak işlemlerini gerçek eserde yapar: %s", async (workId) => {
    const otherWork = structuredClone(db.works[WA]);
    let result = await request(B, "GET", `/api/chapters/${CB}`);
    expect(result.body.item.content).toBe("B özel içeriği");
    result = await request(B, "PATCH", `/api/chapters/${CB}/status`, { status: "draft", workId });
    expect(result.status).toBe(200);
    expect(db.chapters[CB].status).toBe("draft");
    expect(db.works[WB].publishedChapterIds).toEqual([]);
    expect(db.works[WB].status).toBe("draft");
    result = await request(B, "PATCH", `/api/chapters/${CB}/status`, { status: "published", workId });
    expect(result.status).toBe(200);
    expect(db.chapters[CB].status).toBe("published");
    expect(db.works[WB].publishedChapterIds).toEqual([CB]);
    expect(db.works[WB].status).toBe("published");
    expect(db.works[WA]).toEqual(otherWork);
  });

  it("Sahibin içerik güncellemesi çalışır ve yayından kaldırır", async () => {
    const result = await request(B, "PUT", `/api/chapters/${CB}`, { expectedRevision: 0, content: "<p>Yeni içerik</p>" });
    expect(result.status).toBe(200);
    expect(db.chapters[CB].content).toBe("<p>Yeni içerik</p>");
    expect(db.chapters[CB].status).toBe("draft");
    expect(db.works[WB].publishedChapterIds).toEqual([]);
    expect(db.works[WA].publishedChapterIds).toEqual([CA]);
  });

  it.each([
    ["clean", true, "pending_review", 202],
  ])("Moderasyon %s / kısıt %s: liste ve bildirim gerçek eseri kullanır", async (severity, banned, status, code) => {
    db.users[B].contentBanned = banned;
    moderateChapter.mockResolvedValue({ severity, reason: "Test incelemesi" });
    const otherWork = structuredClone(db.works[WA]);
    const result = await request(B, "PATCH", `/api/chapters/${CB}/status`, { status: "published", workId: WB });
    expect(result.status).toBe(code);
    expect(db.chapters[CB].status).toBe(status);
    expect(db.works[WB].publishedChapterIds).toEqual([]);
    expect(db.works[WB].status).toBe("draft");
    expect(db.works[WA]).toEqual(otherWork);
    expect(db.notifications.length).toBeGreaterThan(0);
    expect(db.notifications.every((notification) => notification.work === WB)).toBe(true);
    expect(db.notifications.some((notification) => notification.recipient === B)).toBe(true);
    expect(db.notifications.some((notification) => notification.recipient === A)).toBe(false);
    expect(sendStaffMail).toHaveBeenCalled();
  });
});

describe("Yayın listesinin eser ve durum doğrulaması", () => {
  it.each([[CB], [CA, CB], [DRAFT], [id(999)], ["invalid"], null].map(
    (publishedChapterIds) => ({ publishedChapterIds })
  ))("Geçersiz liste tüm güncellemeyi reddeder: %j", async ({ publishedChapterIds }) => {
    const snapshot = structuredClone(db);
    const result = await request(A, "PATCH", `/api/works/${WA}`, { title: "Değişmemeli", publishedChapterIds });
    expect(result.status).toBe(400);
    expectNoEffects(snapshot);
  });

  it("A, B eserinin listesini değiştiremez", async () => {
    const snapshot = structuredClone(db);
    const result = await request(A, "PATCH", `/api/works/${WB}`, { publishedChapterIds: [] });
    expect(result.status).toBe(404);
    expectNoEffects(snapshot);
  });

  it("Sahibi kendi yayındaki bölümlerini sıralayabilir ve listeyi boşaltabilir", async () => {
    const otherWork = structuredClone(db.works[WB]);
    let result = await request(A, "PATCH", `/api/works/${WA}`, { publishedChapterIds: [SECOND, CA] });
    expect(result.status).toBe(200);
    expect(db.works[WA].publishedChapterIds).toEqual([SECOND, CA]);
    result = await request(A, "PATCH", `/api/works/${WA}`, { publishedChapterIds: [] });
    expect(result.status).toBe(200);
    expect(db.works[WA].status).toBe("draft");
    expect(db.works[WA].publishedChapterIds).toEqual([]);
    expect(db.works[WB]).toEqual(otherWork);
  });

  it("Hatalı listeden yabancı ve yayında olmayan bölümler okuyucuya sızmaz", async () => {
    db.works[WA].publishedChapterIds = [SECOND, CB, DRAFT, CA, id(999)];
    const snapshot = structuredClone(db);
    for (const user of [undefined, A]) {
      const result = await request(user, "GET", `/api/public/works/${WA}/chapters`);
      expect(result.status).toBe(200);
      expect(result.body.items.map((chapter) => chapter._id)).toEqual([CA, SECOND]);
      expect(JSON.stringify(result.body)).not.toContain("B özel içeriği");
      expect(JSON.stringify(result.body)).not.toContain("Gizli taslak");
    }
    const details = await request(undefined, "GET", `/api/public/works/${WA}`);
    expect(details.body.item.publishedChapterIds).toEqual([SECOND, CA]);
    const explore = await request(undefined, "GET", "/api/public/explore");
    expect(explore.status).toBe(200);
    expect(explore.body.items.find((work) => work._id === WA).chapterCount).toBe(2);
    expect(explore.body.items.find((work) => work._id === WB).chapterCount).toBe(1);
    const profile = await request(undefined, "GET", `/api/public/profile/${A}/works`);
    expect(profile.status).toBe(200);
    expect(profile.body.items[0].chapterCount).toBe(2);
    expectNoEffects(snapshot);
  });

  it.each(["draft", "pending_review", "rejected"])("Listede olsa bile %s bölüm okunamaz", async (status) => {
    db.chapters[CA].status = status;
    const result = await request(undefined, "GET", `/api/public/works/${WA}/chapters`);
    expect(result.status).toBe(200);
    expect(result.body.items).toEqual([]);
  });

  it("Taslak eserin bölümleri public uçtan okunamaz", async () => {
    db.works[WA].status = "draft";
    const result = await request(undefined, "GET", `/api/public/works/${WA}/chapters`);
    expect(result.status).toBe(200);
    expect(result.body.items).toEqual([]);
  });
});

describe("Anonim yayının kaldırılması ve eski eserlerin gizliliği", () => {
  beforeEach(() => {
    db.works[WA].isAnonymous = true;
    db.users[A].kullaniciAdi = "EskiEserYazari";
    db.users[A].avatarUrl = "https://example.test/secret-avatar.png";
    db.users[B].kullaniciAdi = "NormalYazar";
    vi.spyOn(Work, "create").mockImplementation(async (data) => {
      const work = new Work(data);
      await work.validate();
      await work.save();
      return work;
    });
  });

  it.each([true, "true", 1, null])("Yeni anonim eser isteği reddedilir: %j", async (isAnonymous) => {
    const snapshot = structuredClone(db);
    const result = await request(A, "POST", "/api/works", { title: "Yeni", isAnonymous });
    expect(result.status).toBe(400);
    expect(Work.create).not.toHaveBeenCalled();
    expectNoEffects(snapshot);
  });

  it.each([undefined, false])("Yeni normal eser oluşturulabilir: %j", async (isAnonymous) => {
    const result = await request(B, "POST", "/api/works", { title: "Yeni normal eser", isAnonymous });
    expect(result.status).toBe(201);
    expect(result.body.item).toMatchObject({ isAnonymous: false, author: { _id: B, kullaniciAdi: "NormalYazar" } });
    expect(db.works[result.body.item._id].isAnonymous).toBe(false);
  });

  it("Model yeni anonim eseri reddeder, eski anonim kayıt doğrulanabilir", async () => {
    await expect(new Work({ user: A, title: "Yeni", isAnonymous: true }).validate()).rejects.toThrow("anonim");
    await expect(Work.hydrate(db.works[WA]).validate()).resolves.toBeUndefined();
  });

  it("Normal eser anonim yapılamaz", async () => {
    const snapshot = structuredClone(db);
    expect((await request(B, "PATCH", `/api/works/${WB}`, { title: "Değişmesin", isAnonymous: true })).status).toBe(400);
    expectNoEffects(snapshot);
  });

  it.each([undefined, false, "true"])("Eski eserin kimliği açık onay olmadan açılamaz: %j", async (confirmAuthorDisclosure) => {
    const snapshot = structuredClone(db);
    const result = await request(A, "PATCH", `/api/works/${WA}`, { isAnonymous: false, confirmAuthorDisclosure });
    expect(result.status).toBe(400);
    expectNoEffects(snapshot);
  });

  it("Sıradan düzenleme ve yeniden yayınlama anonimliği korur", async () => {
    expect((await request(A, "PATCH", `/api/works/${WA}`, { title: "Güncel eser" })).status).toBe(200);
    for (const status of ["draft", "published"]) {
      expect((await request(A, "PATCH", `/api/chapters/${CA}/status`, { status })).status).toBe(200);
      expect(db.works[WA].isAnonymous).toBe(true);
    }
    const result = await request(null, "GET", `/api/public/works/${WA}`);
    expect(result.body.item.author).toBeNull();
  });

  it("Sadece sahibi açık onayla geçer; profil, arama ve detayda aynı yazar görünür", async () => {
    const payload = { isAnonymous: false, confirmAuthorDisclosure: true };
    const snapshot = structuredClone(db);
    expect((await request(B, "PATCH", `/api/works/${WA}`, payload)).status).toBe(404);
    expectNoEffects(snapshot);
    expect((await request(A, "PATCH", `/api/works/${WA}`, payload)).status).toBe(200);
    expect(db.works[WA].isAnonymous).toBe(false);
    for (const path of ["/api/public/explore", "/api/works/discover", "/api/search/works?q=eseri", `/api/public/profile/${A}/works`, `/api/public/works/${WA}`]) {
      const result = await request(null, "GET", path);
      expect(result.status).toBe(200);
      const work = result.body.item ?? result.body.items.find((item) => item._id === WA);
      expect(work.author).toMatchObject({ _id: A, username: "EskiEserYazari", kullaniciAdi: "EskiEserYazari" });
    }
    expect((await request(A, "PATCH", `/api/works/${WA}`, { isAnonymous: true })).status).toBe(400);
  });

  it("Anonim eser API yanıtlarında kimliğini gizler ve yazar profilinde listelenmez", async () => {
    const snapshot = structuredClone(db);
    for (const path of ["/api/public/explore", "/api/works/discover", "/api/search/works?q=eseri", `/api/public/works/${WA}`, `/api/works/${WA}`]) {
      const result = await request(A, "GET", path);
      expect(result.status).toBe(200);
      const work = result.body.item ?? result.body.items.find((item) => item._id === WA);
      expect(work).toMatchObject({ isAnonymous: true, author: null });
      const json = JSON.stringify(work);
      for (const secret of [A, "EskiEserYazari", "secret-avatar"]) expect(json).not.toContain(secret);
      expect(work).not.toHaveProperty("user");
    }
    const profile = await request(null, "GET", `/api/public/profile/${A}/works`);
    expect(profile.status).toBe(200);
    expect(profile.body.items).toEqual([]);
    const normalProfile = await request(null, "GET", `/api/public/profile/${B}/works`);
    expect(normalProfile.body.items[0].author).toMatchObject({ _id: B, kullaniciAdi: "NormalYazar" });
    expectNoEffects(snapshot);
  });

  it("Takip akışı anonim eseri yazarıyla ilişkilendirmez", async () => {
    db.users[B].following = [A];
    const aggregate = vi.spyOn(Log, "aggregate").mockResolvedValue([{ items: [], count: [] }]);
    const result = await request(B, "GET", "/api/feed?scope=following");
    expect(result.status).toBe(200);
    expect(result.body.items).toEqual([]);
    const chapterPipeline = aggregate.mock.calls[0][0].find(stage => stage.$unionWith).$unionWith.pipeline;
    expect(chapterPipeline.find(stage => stage.$lookup).$lookup.pipeline[0].$match)
      .toMatchObject({ isAnonymous: { $ne: true }, status: "published" });
  });

  it("Kütüphane API'si anonim yazar kimliğini göndermez", async () => {
    vi.spyOn(Library, "find").mockReturnValue(query([{
      work: { ...db.works[WA], user: db.users[A] }, createdAt: new Date(),
    }]));
    const result = await request(B, "GET", "/api/library");
    expect(result.status).toBe(200);
    expect(result.body.items[0]).toMatchObject({ isAnonymous: true, author: null });
    expect(JSON.stringify(result.body)).not.toContain("EskiEserYazari");
  });
});


describe("Version history and atomic saves (isolated storage)", () => {
  it("two editors with the same base revision: only one succeeds", async () => {
    const results = await Promise.all(["first", "second"].map(content => request(B, "PUT", `/api/chapters/${CB}`, { expectedRevision: 0, content })));
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    const success = results.find(r => r.status === 200).body;
    const conflict = results.find(r => r.status === 409).body;
    expect(success.revision).toBe(1);
    expect(Date.parse(success.savedAt)).toBeGreaterThan(0);
    expect(conflict.current.content).toBe(success.item.content);
    expect(db.versions.map(v => v.revision)).toEqual([0, 1]);
  });
  it("unchanged content does not generate another version", async () => {
    await request(B, "PUT", `/api/chapters/${CB}`, { expectedRevision: 0, content: "same" });
    const savedAt = db.chapters[CB].savedAt;
    const response = await request(B, "PUT", `/api/chapters/${CB}`, { expectedRevision: 1, content: "same" });
    expect(response.status).toBe(200);
    expect(response.body.revision).toBe(1);
    expect(response.body.savedAt).toBe(savedAt);
    expect(db.versions).toHaveLength(2);
  });
  it("history write failure rolls back chapter, publication and history", async () => {
    const before = structuredClone(db);
    ChapterVersion.create.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("disk failure"));
    const result = await request(B, "PUT", `/api/chapters/${CB}`, { expectedRevision: 0, content: "not committed" });
    expect(result.status).toBe(503);
    expect(db).toEqual(before);
    expect(result.body.savedAt).toBeUndefined();
  });
  it("restore preserves current and older versions and clears all approval fields", async () => {
    const original = db.chapters[CB].content;
    await request(B, "PUT", `/api/chapters/${CB}`, { expectedRevision: 0, content: "new text" });
    db.chapters[CB].status = "published";
    db.chapters[CB].reviewedBy = STAFF;
    db.chapters[CB].reviewedAt = new Date().toISOString();
    db.chapters[CB].reviewNote = "approved";
    const result = await request(B, "POST", `/api/chapters/${CB}/versions/0/restore`, { expectedRevision: 1 });
    expect(result.status).toBe(200);
    expect(result.body.item).toMatchObject({ content: original, revision: 2, status: "draft", reviewedBy: null, reviewedAt: null, reviewNote: "" });
    expect(db.versions.map(v => v.content)).toEqual([original, "new text", original]);
    expect(db.versions[2].restoredFrom).toBe(0);
    expect(db.works[WB].publishedChapterIds).toEqual([]);
  });
  it.each([A, STAFF])("non-owner %s cannot list, read or restore versions", async user => {
    await request(B, "PUT", `/api/chapters/${CB}`, { expectedRevision: 0, content: "private version" });
    const before = structuredClone(db);
    for (const [method, suffix, body] of [["GET", "/versions"], ["GET", "/versions/0"], ["POST", "/versions/0/restore", { expectedRevision: 1 }]]) {
      const result = await request(user, method, `/api/chapters/${CB}${suffix}`, body);
      expect(result.status).toBe(403);
      expect(JSON.stringify(result.body)).not.toContain("private version");
    }
    expect(db).toEqual(before);
  });
  it("owner can preview, stale restore and missing revision are rejected", async () => {
    await request(B, "PUT", `/api/chapters/${CB}`, { expectedRevision: 0, content: "new text" });
    expect((await request(B, "GET", `/api/chapters/${CB}/versions`)).body.items).toHaveLength(2);
    expect((await request(B, "GET", `/api/chapters/${CB}/versions/1`)).body.item.content).toBe("new text");
    expect((await request(B, "POST", `/api/chapters/${CB}/versions/0/restore`, { expectedRevision: 0 })).status).toBe(409);
    expect((await request(B, "PUT", `/api/chapters/${CB}`, { content: "unsafe" })).status).toBe(400);
    expect(db.chapters[CB].content).toBe("new text");
  });
});

describe("Kayıt yanıtı ve taslağa geçiş", () => {
  it.each(["published", "pending_review", "rejected"])("%s başlık düzenlemesi taslağa geçer ve varsa moderasyon gerekçesini korur", async status => {
    db.chapters[CB].status = status;
    db.chapters[CB].reviewNote = "Eski inceleme";
    const result = await request(B, "PUT", `/api/chapters/${CB}`, { expectedRevision: 0, title: "Yeni başlık" });
    expect(result.status).toBe(200);
    const held = status !== "published";
    expect(result.body.item).toMatchObject({ title: "Yeni başlık", status: "draft", reviewNote: held ? "Eski inceleme" : "" });
    if (held) expect(result.body.item.moderationHold).toBe(true);
    expect(result.body.draftedFromPublished).toBe(true);
    expect(db.works[WB].publishedChapterIds).toEqual([]);
    expect(db.works[WB].status).toBe("draft");
  });
  it("değişmeyen kayıt yayını kaldırmaz", async () => {
    const result = await request(B, "PUT", `/api/chapters/${CB}`, { expectedRevision: 0, title: db.chapters[CB].title, content: db.chapters[CB].content });
    expect(result.status).toBe(200);
    expect(result.body.item.status).toBe("published");
    expect(result.body.draftedFromPublished).toBe(false);
    expect(db.works[WB].publishedChapterIds).toEqual([CB]);
  });
});
