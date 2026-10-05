import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import Work from "../models/Work.js";
import Chapter from "../models/Chapter.js";
import Analysis from "../models/DevelopmentAnalysis.js";
import Gate from "../models/DevelopmentGate.js";
import Sample from "../models/DevelopmentSample.js";
import { developmentConfig, DEVELOPMENT_WORD_THRESHOLD } from "../config/development.js";
import { initializeDevelopment, developmentStatus } from "./developmentProgress.js";
import { plainWords, textHash } from "./developmentWriting.js";
import { databaseNow } from "./databaseClock.js";
import { selectDevelopmentProvider } from "./developmentProviderSelection.js";
import { requireCoachConsent } from "./developmentConsent.js";
import { readDevelopmentQuota } from "./developmentQuota.js";
import { DEVELOPMENT_COACH_LAUNCH_ENABLED } from "../../shared/features.js";

const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const transactionOptions = { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" };

export async function prepareDevelopmentContext({ workId, userId }) {
  return mongoose.connection.transaction(async session => {
    const work = await Work.findOne({ _id: workId, user: userId }).session(session);
    if (!work) throw fail(403, "DEVELOPMENT_OWNER", "Erişim reddedildi.");
    await initializeDevelopment(work, session);
    if (work.isModified()) await work.save({ session });
    if (!developmentStatus(work).eligibleForDevelopmentReview) throw fail(409, "DEVELOPMENT_NOT_READY", "Gelişim değerlendirmesi için yeni yazı birikiyor.");
    const checkpointStart = work.lastDevelopmentWordCheckpoint || 0;
    const checkpointEnd = work.developmentNewWords;
    if (await Analysis.exists({ workId, checkpointEnd }).session(session)) throw fail(409, "DEVELOPMENT_ALREADY_ANALYZED", "Bu yazılar zaten değerlendirildi.");
    const samples = [];
    let remaining = DEVELOPMENT_WORD_THRESHOLD;
    // Bounded excerpts, with immutable provenance; never all historical text.
    if (work.developmentAnalysisCount) for await (const sample of Sample.find({ workId, checkpointEnd: { $gt: checkpointStart, $lte: checkpointEnd } }).sort({ checkpointEnd: -1 }).session(session).lean().cursor()) {
      const words = sample.text.trim().split(/\s+/u).filter(Boolean).slice(0, remaining);
      if (words.length) samples.push({ chapterId: sample.chapterId, revision: sample.revision, contentHash: sample.contentHash, text: words.join(" "), words: words.length });
      remaining -= words.length;
      if (!remaining) break;
    }
    // The initial profile samples current writing (including legacy works).
    // Subsequent comparisons exclusively sample the saved contribution ledger.
    if (remaining && !work.developmentAnalysisCount) {
      for await (const chapter of Chapter.find({ work: workId }).sort({ order: 1, _id: 1 }).session(session).lean().cursor()) {
        const words = plainWords(chapter.content).slice(0, remaining);
        if (words.length) samples.push({ chapterId: chapter._id, revision: chapter.revision || 0, contentHash: textHash(plainWords(chapter.content).join(" ")), text: words.join(" "), words: words.length });
        remaining -= words.length;
        if (!remaining) break;
      }
    }
    if (!samples.length) throw fail(409, "DEVELOPMENT_EMPTY", "Değerlendirilebilecek kayıtlı metin bulunamadı.");
    if (remaining) throw fail(409, "DEVELOPMENT_SAMPLE_SHORT", "Değerlendirme için yeterli kayıtlı metin örneği bulunamadı. Biriken hakkın korunuyor.");
    const previous = await Analysis.findOne({ userId, workId }).sort({ sequence: -1 }).select("_id sequence profileSnapshot result analysisVersion").session(session).lean();
    return { workId, userId, checkpointStart, checkpointEnd, sequence: (work.developmentAnalysisCount || 0) + 1,
      kind: work.developmentAnalysisCount ? "comparison" : "baseline", samples,
      workContext: { title: work.title, genres: work.universe?.genres || [], tone: work.universe?.tone || "", themes: work.universe?.themes || "" },
      previous: previous ? { id: previous._id, sequence: previous.sequence, analysisVersion: previous.analysisVersion, profile: previous.profileSnapshot || previous.result,
        summary: { summary: previous.result?.summary, voiceProfile: previous.result?.voiceProfile, progress: previous.result?.progress, focus: previous.result?.focus } } : null };
  }, transactionOptions);
}

// Dependencies are injectable only in server-side tests, never from the request.
export async function runDevelopmentCoach({ workId, userId }, { provider, config = developmentConfig() } = {}) {
  if (!DEVELOPMENT_COACH_LAUNCH_ENABLED) throw fail(503, "DEVELOPMENT_COMING_SOON", "Gelişim Koçu beta aşamasında. Çok yakında.");
  provider ??= selectDevelopmentProvider(config);
  if (!mongoose.isValidObjectId(workId) || !mongoose.isValidObjectId(userId)) throw fail(400, "DEVELOPMENT_ID", "Geçersiz eser.");
  if (!await Work.exists({ _id: workId, user: userId })) throw fail(403, "DEVELOPMENT_OWNER", "Erişim reddedildi.");
  await requireCoachConsent(userId);
  await Gate.updateOne({ _id: userId }, { $setOnInsert: { _id: userId } }, { upsert: true, writeConcern: { w: "majority" } }).catch(error => { if (error.code !== 11000) throw error; });
  const token = randomUUID();
  const gate = await Gate.findOneAndUpdate({ _id: userId, token: null }, { $set: { token, startedAt: await databaseNow() } }, { new: true, writeConcern: { w: "majority" } });
  if (!gate) throw fail(409, "DEVELOPMENT_IN_FLIGHT", "Gelişim değerlendirmen hazırlanıyor. Lütfen bekle.");
  let committed = false;
  try {
    const quota = await readDevelopmentQuota(userId, { config });
    if (!quota.remaining) {
      throw Object.assign(fail(429, "DEVELOPMENT_DAILY_LIMIT", `Son 24 saatteki ${quota.dailyLimit} başarılı analiz hakkını kullandın. Yeni yazıların korunuyor.`), { retryAfter: quota.retryAfter, quota });
    }
    const context = await prepareDevelopmentContext({ workId, userId });
    if (!config.enabled || !provider.ready) return { status: "prepared", kind: context.kind, sampleWords: context.samples.reduce((sum, s) => sum + s.words, 0), message: "Yazı örneklerin hazır. Gelişim Koçu henüz kullanıma açılmadı; değerlendirme hakkın ve biriken yazıların korunuyor." };
    // No automatic retries. The adapter must settle only after its request has
    // stopped, including abort/timeout, so releasing this lock cannot overlap calls.
    await requireCoachConsent(userId);
    const controller = new AbortController();
    let checking = false;
    const consentWatch = setInterval(async () => {
      if (checking) return;
      checking = true;
      try { await requireCoachConsent(userId); }
      catch { controller.abort(); }
      finally { checking = false; }
    }, 500);
    let output;
    try { output = await provider.generate(context, { signal: controller.signal }); }
    finally { clearInterval(consentWatch); }
    await requireCoachConsent(userId);
    if (!output || typeof output.result !== "object" || Array.isArray(output.result) || !output.result || !Object.keys(output.result).length ||
        !output.modelIdentifier || !provider.promptVersion || !provider.analysisVersion ||
        Buffer.byteLength(JSON.stringify(output)) > 65536 || !await provider.validate(output.result, context)) {
      throw fail(502, "DEVELOPMENT_INVALID_RESULT", "Değerlendirme doğrulanamadı. Hakkın korunuyor.");
    }
    const receipt = await mongoose.connection.transaction(async session => {
      const work = await Work.findOne({ _id: workId, user: userId }).session(session);
      if (!work || (work.lastDevelopmentWordCheckpoint || 0) !== context.checkpointStart || (work.developmentAnalysisCount || 0) + 1 !== context.sequence) throw fail(409, "DEVELOPMENT_STALE", "Değerlendirme kaydı değişti; tekrar deneyin.");
      const analyzedAt = await databaseNow();
      const updated = await Gate.updateOne({ _id: userId, token }, { $set: { lastSuccessAt: analyzedAt }, $unset: { token: "", startedAt: "" } }, { session });
      if (updated.matchedCount !== 1) throw fail(409, "DEVELOPMENT_LOCK_LOST", "Değerlendirme kilidi değişti.");
      const [analysis] = await Analysis.create([{ ...context, sources: context.samples.map(({ text, ...source }) => source), analyzedAt,
        modelIdentifier: output.modelIdentifier, result: output.result, profileSnapshot: output.profileSnapshot,
        promptVersion: provider.promptVersion, analysisVersion: provider.analysisVersion }], { session });
      work.lastDevelopmentWordCheckpoint = context.checkpointEnd;
      work.lastDevelopmentAnalysisAt = analyzedAt;
      work.developmentAnalysisCount = context.sequence;
      work.eligibleForDevelopmentReview = developmentStatus(work).eligibleForDevelopmentReview;
      await work.save({ session });
      return { status: "complete", analysisId: analysis._id, kind: context.kind, analyzedAt, result: analysis.result,
        development: { ...developmentStatus(work), quota: await readDevelopmentQuota(userId, { config, now: analyzedAt, session }) } };
    }, transactionOptions);
    committed = true;
    return receipt;
  } finally {
    if (!committed) await Gate.updateOne({ _id: userId, token }, { $unset: { token: "", startedAt: "" } });
  }
}

export async function readLatestDevelopment({ workId, userId }) {
  if (!mongoose.isValidObjectId(workId) || !await Work.exists({ _id: workId, user: userId })) throw fail(403, "DEVELOPMENT_OWNER", "Erişim reddedildi.");
  const analysis = await Analysis.findOne({ workId, userId }).sort({ sequence: -1 }).select("_id kind analyzedAt result").lean();
  if (!analysis) throw fail(404, "DEVELOPMENT_NOT_FOUND", "Henüz bir gelişim değerlendirmen yok.");
  return { status: "complete", analysisId: analysis._id, kind: analysis.kind, analyzedAt: analysis.analyzedAt, result: analysis.result };
}

export async function listDevelopmentAnalyses({ workId, userId, before }) {
  if (!mongoose.isValidObjectId(workId) || !await Work.exists({ _id: workId, user: userId })) throw fail(403, "DEVELOPMENT_OWNER", "Erişim reddedildi.");
  if (before !== undefined && (!Number.isSafeInteger(before) || before < 1)) throw fail(400, "DEVELOPMENT_CURSOR", "Geçersiz değerlendirme sırası.");
  const items = await Analysis.find({ workId, userId, ...(before ? { sequence: { $lt: before } } : {}) }).sort({ sequence: -1 }).limit(20)
    .select("_id sequence kind analyzedAt result").lean();
  return { items, nextBefore: items.length === 20 ? items.at(-1).sequence : null };
}
