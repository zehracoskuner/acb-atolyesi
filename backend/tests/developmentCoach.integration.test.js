import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import Work from "../models/Work.js";
import User from "../models/User.js";
import Chapter from "../models/Chapter.js";
import ChapterVersion from "../models/ChapterVersion.js";
import Analysis from "../models/DevelopmentAnalysis.js";
import Gate from "../models/DevelopmentGate.js";
import Sample from "../models/DevelopmentSample.js";
import Fingerprint from "../models/DevelopmentFingerprint.js";
import { saveChapterVersion } from "../services/chapterHistory.js";
import { readDevelopment } from "../services/developmentProgress.js";
import { runDevelopmentCoach, readLatestDevelopment, prepareDevelopmentContext, listDevelopmentAnalyses } from "../services/developmentCoach.js";
import { validateCoachResult } from "../services/developmentResult.js";
import { validDevelopmentResult } from "./fixtures/developmentResult.js";
import { readDevelopmentQuota } from "../services/developmentQuota.js";
import { developmentConfig } from "../config/development.js";
vi.mock("../../shared/features.js", async importOriginal => ({ ...await importOriginal(), DEVELOPMENT_COACH_LAUNCH_ENABLED: true }));

const uri = process.env.CHAPTER_TEST_MONGO_URI;
const database = `acb_development_test_${randomUUID().replaceAll("-", "")}`;
const config = { enabled: true, dailyLimit: 2 };
const provider = () => ({ ready: true, promptVersion: "test-only", analysisVersion: "test-only", validate: result => result.test === true,
  generate: vi.fn(async () => ({ modelIdentifier: "test-fake", result: { test: true } })) });
describe.skipIf(!uri)("development coach transactions", () => {
  beforeAll(async () => {
    if (!/^mongodb:\/\/(localhost|127\.0\.0\.1):\d+\/?(?:\?.*)?$/.test(uri)) throw Error("Loopback only");
    await mongoose.connect(uri, { dbName: database });
    await Promise.all([User, Work, Chapter, ChapterVersion, Analysis, Gate, Sample, Fingerprint].map(m => m.init()));
  });
  afterAll(async () => { if (mongoose.connection.name === database) await mongoose.connection.dropDatabase(); await mongoose.disconnect(); });
  async function fixture(userId = new mongoose.Types.ObjectId()) {
    await User.updateOne({ _id: userId }, { $setOnInsert: { email: `${userId}@example.test`, "settings.developmentCoach": "enabled" } }, { upsert: true });
    const work = await Work.create({ user: userId, title: "Test" });
    const chapter = await Chapter.create({ work: work._id, title: "Test", content: "" });
    const args = { userId, workId: work._id };
    const save = async (content, eligibleWordDelta, extra = {}) => {
      const current = await Chapter.findById(chapter._id);
      return saveChapterVersion({ id: chapter._id, userId, expectedRevision: current.revision, content, eligibleWordDelta, ...extra });
    };
    return { args, chapter, save };
  }
  it("2999/3000 threshold, paste, repeat append, delete/re-paste and restore", async () => {
    const f = await fixture();
    await f.save("word ".repeat(2999), 2999);
    expect((await readDevelopment(f.args)).eligibleForDevelopmentReview).toBe(false);
    const text = "word ".repeat(2999) + "last";
    await f.save(text, 1);
    expect((await readDevelopment(f.args)).eligibleForDevelopmentReview).toBe(true);
    await f.save(text + " " + text, 3000);
    await f.save("", 0);
    await f.save(text, 3000);
    await f.save(undefined, 9000, { restoreRevision: 1 });
    expect((await Work.findById(f.args.workId)).developmentNewWords).toBe(3000);
    expect((await readDevelopment(f.args)).eligibleForDevelopmentReview).toBe(true);
  });
  it("placeholder prepares context without a provider call or spending eligibility", async () => {
    const f = await fixture(); await f.save("sample ".repeat(3000), 3000);
    const result = await runDevelopmentCoach(f.args);
    expect(result).toMatchObject({ status: "prepared", kind: "baseline", sampleWords: 3000 });
    const work = await Work.findById(f.args.workId);
    expect(work.developmentAnalysisCount).toBe(0); expect(work.lastDevelopmentAnalysisAt).toBeNull();
    expect(work.lastDevelopmentWordCheckpoint).toBe(0); expect(work.eligibleForDevelopmentReview).toBe(true);
    expect(await Analysis.countDocuments({ workId: work._id })).toBe(0);
  });
  it.each(["success", "refusal", "timeout"])("configured production OpenAI path: %s preserves transaction and quota rules", async outcome => {
    const f = await fixture(); await f.save("synthetic ".repeat(3000), 3000);
    vi.stubEnv("DEVELOPMENT_COACH_PROVIDER", "openai");
    vi.stubEnv("DEVELOPMENT_COACH_MODEL", "gpt-6-luna");
    vi.stubEnv("DEVELOPMENT_COACH_ENABLED", "true");
    vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
    vi.stubEnv("DEVELOPMENT_ANALYSIS_TIMEOUT_MS", "1000");
    const result = validDevelopmentResult();
    const content = outcome === "refusal" ? [{ type: "refusal", refusal: "private refusal" }] : [{ type: "output_text", text: JSON.stringify(result) }];
    const transport = vi.fn(async () => new Response(JSON.stringify({ object: "response", model: "gpt-6-luna", status: "completed", output: [{ type: "message", role: "assistant", content }] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    if (outcome === "timeout") transport.mockImplementation((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))));
    vi.stubGlobal("fetch", transport);
    try {
      const configured = developmentConfig();
      if (outcome === "success") {
        await expect(runDevelopmentCoach(f.args, { config: configured })).resolves.toMatchObject({ status: "complete", development: { analysisCount: 1, quota: { remaining: 1 } } });
        expect((await Analysis.findOne({ workId: f.args.workId })).modelIdentifier).toBe("gpt-6-luna");
        expect((await Work.findById(f.args.workId)).lastDevelopmentWordCheckpoint).toBe(3000);
      } else {
        await expect(runDevelopmentCoach(f.args, { config: configured })).rejects.toMatchObject({ code: outcome === "refusal" ? "DEVELOPMENT_OPENAI_REFUSAL" : "DEVELOPMENT_TIMEOUT" });
        expect(await Analysis.countDocuments({ workId: f.args.workId })).toBe(0);
        expect((await readDevelopment(f.args)).quota.remaining).toBe(2);
        expect((await Work.findById(f.args.workId)).lastDevelopmentWordCheckpoint).toBe(0);
        expect((await Gate.findById(f.args.userId)).token).toBeUndefined();
      }
      expect(transport).toHaveBeenCalledTimes(1);
      expect(String(transport.mock.calls[0][0])).toBe("https://api.openai.com/v1/responses");
    } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
  });
  it.each(["undecided", "disabled"])("%s consent blocks every provider call and keeps notes readable", async preference => {
    const f = await fixture(); await f.save("pasted ".repeat(3000), 3000);
    await User.updateOne({ _id: f.args.userId }, { $set: { "settings.developmentCoach": preference } });
    const p = provider();
    await expect(runDevelopmentCoach(f.args, { provider: p, config })).rejects.toMatchObject({ code: "DEVELOPMENT_CONSENT_REQUIRED" });
    expect(p.generate).not.toHaveBeenCalled();
    expect((await listDevelopmentAnalyses(f.args)).items).toEqual([]);
    expect((await Work.findById(f.args.workId)).lastDevelopmentWordCheckpoint).toBe(0);
  });
  it("disabling during analysis aborts and does not spend quota", async () => {
    const f = await fixture(); await f.save("sample ".repeat(3000), 3000);
    let started;
    const entered = new Promise(resolve => { started = resolve; });
    const p = provider(); p.generate.mockImplementation((_context, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(Error("consent revoked"))); started();
    }));
    const running = runDevelopmentCoach(f.args, { provider: p, config });
    const rejection = expect(running).rejects.toThrow("consent revoked");
    await entered;
    await User.updateOne({ _id: f.args.userId }, { $set: { "settings.developmentCoach": "disabled" } });
    await rejection;
    expect((await Work.findById(f.args.workId)).developmentAnalysisCount).toBe(0);
  });
  it("paginates durable notes without mixing works or exposing another user's notes", async () => {
    const f = await fixture();
    await Analysis.insertMany(Array.from({ length: 21 }, (_, index) => ({
      userId: f.args.userId, workId: f.args.workId, sequence: index + 1, analyzedAt: new Date(),
      checkpointStart: index * 3000, checkpointEnd: (index + 1) * 3000,
      kind: index ? "comparison" : "baseline", modelIdentifier: "test", promptVersion: "test", analysisVersion: "1", result: validDevelopmentResult(),
    })));
    const first = await listDevelopmentAnalyses(f.args);
    expect(first.items).toHaveLength(20); expect(first.items[0].sequence).toBe(21); expect(first.nextBefore).toBe(2);
    const second = await listDevelopmentAnalyses({ ...f.args, before: first.nextBefore });
    expect(second.items.map(item => item.sequence)).toEqual([1]); expect(second.nextBefore).toBeNull();
    const other = await fixture(f.args.userId);
    expect((await listDevelopmentAnalyses(other.args)).items).toEqual([]);
    await expect(listDevelopmentAnalyses({ ...f.args, userId: new mongoose.Types.ObjectId() })).rejects.toMatchObject({ status: 403 });
  });
  it("persists the supplied schema, returns it, and reads it only for its owner", async () => {
    const f = await fixture(); await f.save("sample ".repeat(3000), 3000);
    const result = validDevelopmentResult();
    result.profileSnapshot.rhythm = "Test snapshot";
    const p = { ...provider(), validate: validateCoachResult, generate: vi.fn(async () => ({ result, profileSnapshot: result.profileSnapshot, modelIdentifier: "test-schema" })) };
    const receipt = await runDevelopmentCoach(f.args, { provider: p, config });
    expect(receipt.result).toEqual(result);
    expect(receipt.development).toMatchObject({ analysisCount: 1, eligibleForDevelopmentReview: false });
    expect((await readLatestDevelopment(f.args)).result).toEqual(result);
    await User.updateOne({ _id: f.args.userId }, { $set: { "settings.developmentCoach": "disabled" } });
    expect((await listDevelopmentAnalyses(f.args)).items[0].result).toEqual(result);
    await expect(listDevelopmentAnalyses({ ...f.args, userId: new mongoose.Types.ObjectId() })).rejects.toMatchObject({ status: 403 });
    await expect(readLatestDevelopment({ ...f.args, userId: new mongoose.Types.ObjectId() })).rejects.toMatchObject({ status: 403 });
    await f.save("sample ".repeat(3000) + "next ".repeat(3000), 3000);
    const context = await prepareDevelopmentContext(f.args);
    expect(context.previous.profile.rhythm).toBe("Test snapshot");
    expect(context.previous.summary.voiceProfile).toEqual(result.voiceProfile);
    expect(context.kind).toBe("comparison");
  });
  it("empty/short saved samples and false client claims never reach provider", async () => {
    const f = await fixture();
    await f.save("small text", 20000);
    expect((await Work.findById(f.args.workId)).developmentNewWords).toBe(2);
    const p = provider();
    await expect(runDevelopmentCoach(f.args, { provider: p, config })).rejects.toMatchObject({ code: "DEVELOPMENT_NOT_READY" });
    await f.save("available ".repeat(3000), 3000);
    await f.save("", 0);
    await expect(runDevelopmentCoach(f.args, { provider: p, config })).rejects.toMatchObject({ code: "DEVELOPMENT_EMPTY" });
    await f.save("short", 0);
    await expect(runDevelopmentCoach(f.args, { provider: p, config })).rejects.toMatchObject({ code: "DEVELOPMENT_SAMPLE_SHORT" });
    expect(p.generate).not.toHaveBeenCalled();
    expect((await Work.findById(f.args.workId)).eligibleForDevelopmentReview).toBe(true);
  });
  it("a copied chapter is not new writing but another work has independent progress", async () => {
    const f = await fixture(); const text = "new ".repeat(3000);
    await f.save(text, 3000);
    const second = await Chapter.create({ work: f.args.workId, title: "Second" });
    await saveChapterVersion({ id: second._id, userId: f.args.userId, expectedRevision: 0, content: text, eligibleWordDelta: 3000 });
    expect((await Work.findById(f.args.workId)).developmentNewWords).toBe(3000);
    const other = await fixture(f.args.userId); await other.save(text, 3000);
    expect((await Work.findById(other.args.workId)).developmentNewWords).toBe(3000);
  });
  it.each(["network", "timeout", "429", "invalid", "DEVELOPMENT_PROVIDER_BLOCKED"])("%s failure preserves all success state", async kind => {
    const f = await fixture(); await f.save("sample ".repeat(3000), 3000);
    const p = provider();
    p.generate.mockImplementation(async () => { if (kind === "invalid") return { modelIdentifier: "test", result: {} }; throw Error(kind); });
    await expect(runDevelopmentCoach(f.args, { provider: p, config })).rejects.toThrow();
    const work = await Work.findById(f.args.workId);
    expect(work.developmentAnalysisCount).toBe(0); expect(work.lastDevelopmentAnalysisAt).toBeNull();
    expect(work.lastDevelopmentWordCheckpoint).toBe(0); expect(work.eligibleForDevelopmentReview).toBe(true);
    expect((await Gate.findById(f.args.userId)).token).toBeUndefined();
    expect((await readDevelopment(f.args)).quota.remaining).toBe(2);
    await runDevelopmentCoach(f.args, { provider: provider(), config });
    expect((await readDevelopment(f.args)).quota.remaining).toBe(1);
  });
  it("allows two immediate successes, requires new words, and shares the rolling limit across works", async () => {
    const f = await fixture(); await f.save("first ".repeat(3000), 3000);
    const p = provider();
    expect((await runDevelopmentCoach(f.args, { provider: p, config })).kind).toBe("baseline");
    expect((await readDevelopment(f.args)).quota.remaining).toBe(1);
    await expect(runDevelopmentCoach(f.args, { provider: p, config })).rejects.toMatchObject({ code: "DEVELOPMENT_NOT_READY" });
    const other = await fixture(f.args.userId); await other.save("other ".repeat(20000), 20000);
    await expect(runDevelopmentCoach({ ...f.args, userId: new mongoose.Types.ObjectId() }, { provider: p, config })).rejects.toMatchObject({ status: 403 });
    await f.save("first ".repeat(3000) + "next ".repeat(2999), 2999);
    await expect(runDevelopmentCoach(f.args, { provider: p, config })).rejects.toMatchObject({ code: "DEVELOPMENT_NOT_READY" });
    await f.save("first ".repeat(3000) + "next ".repeat(3000), 1);
    expect((await runDevelopmentCoach(f.args, { provider: p, config })).kind).toBe("comparison");
    expect(p.generate.mock.calls[1][0].previous.sequence).toBe(1);
    expect(p.generate.mock.calls[1][0].samples[0].text).toContain("next");
    expect((await Work.findById(f.args.workId)).lastDevelopmentWordCheckpoint).toBe(6000);
    expect((await readDevelopment(other.args)).quota).toMatchObject({ dailyLimit: 2, used: 2, remaining: 0 });
    await expect(runDevelopmentCoach(other.args, { provider: p, config })).rejects.toMatchObject({ status: 429, code: "DEVELOPMENT_DAILY_LIMIT", quota: { remaining: 0 } });
    expect(p.generate).toHaveBeenCalledTimes(2);
    const first = await Analysis.findOne({ userId: f.args.userId }).sort({ analyzedAt: 1 });
    const boundary = new Date(first.analyzedAt.getTime() + 86400000);
    expect((await readDevelopmentQuota(f.args.userId, { config, now: new Date(boundary.getTime() - 1) })).remaining).toBe(0);
    expect((await readDevelopmentQuota(f.args.userId, { config, now: boundary })).remaining).toBe(1);
    await Analysis.updateOne({ _id: first._id }, { $set: { analyzedAt: new Date(Date.now() - 86401000) } });
    await expect(runDevelopmentCoach(other.args, { provider: p, config })).resolves.toMatchObject({ development: { quota: { remaining: 0 } } });
    const independent = await fixture(); await independent.save("independent ".repeat(3000), 3000);
    await expect(runDevelopmentCoach(independent.args, { provider: p, config })).resolves.toMatchObject({ kind: "baseline" });
  });
  it("two requests invoke provider once and concurrent saves remain pending", async () => {
    const f = await fixture(); await f.save("first ".repeat(3000), 3000);
    const other = await fixture(f.args.userId); await other.save("other ".repeat(3000), 3000);
    await runDevelopmentCoach(other.args, { provider: provider(), config });
    let release, started;
    const entered = new Promise(r => { started = r; });
    const pending = new Promise(r => { release = r; });
    const p = provider(); p.generate.mockImplementation(async () => { started(); await pending; return { modelIdentifier: "test", result: { test: true } }; });
    const running = runDevelopmentCoach(f.args, { provider: p, config });
    await entered;
    await expect(runDevelopmentCoach(f.args, { provider: p, config })).rejects.toMatchObject({ code: "DEVELOPMENT_IN_FLIGHT" });
    await expect(runDevelopmentCoach(other.args, { provider: p, config })).rejects.toMatchObject({ code: "DEVELOPMENT_IN_FLIGHT" });
    await f.save("first ".repeat(3000) + "during ".repeat(3000), 3000);
    release(); await running;
    expect(p.generate).toHaveBeenCalledTimes(1);
    const work = await Work.findById(f.args.workId);
    expect(work.lastDevelopmentWordCheckpoint).toBe(3000);
    expect(work.developmentNewWords).toBe(6000); expect(work.eligibleForDevelopmentReview).toBe(true);
    expect((await readDevelopment(f.args)).quota.remaining).toBe(0);
  });
  it("enforces configured limits and ignores legacy success timestamps without analysis records", async () => {
    const f = await fixture(); await f.save("first ".repeat(3000), 3000);
    await Gate.updateOne({ _id: f.args.userId }, { $set: { lastSuccessAt: new Date() } }, { upsert: true });
    const one = { ...config, dailyLimit: 1 };
    await expect(runDevelopmentCoach(f.args, { provider: provider(), config: one })).resolves.toMatchObject({ development: { quota: { remaining: 0, dailyLimit: 1 } } });
    await expect(runDevelopmentCoach(f.args, { provider: provider(), config: one })).rejects.toMatchObject({ code: "DEVELOPMENT_DAILY_LIMIT" });
    expect(await readDevelopmentQuota(f.args.userId, { config: { ...config, dailyLimit: 3 } })).toMatchObject({ used: 1, remaining: 2, dailyLimit: 3 });
  });
  it("failed analysis persistence rolls back quota, count and checkpoint", async () => {
    const f = await fixture(); await f.save("first ".repeat(3000), 3000);
    const spy = vi.spyOn(Analysis, "create").mockRejectedValueOnce(Error("database failure"));
    try { await expect(runDevelopmentCoach(f.args, { provider: provider(), config })).rejects.toThrow("database failure"); }
    finally { spy.mockRestore(); }
    expect((await Work.findById(f.args.workId)).developmentAnalysisCount).toBe(0);
    expect((await Gate.findById(f.args.userId)).lastSuccessAt).toBeUndefined();
    expect(await Analysis.countDocuments({ workId: f.args.workId })).toBe(0);
  });
});
