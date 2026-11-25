import express from "express";
import mongoose from "mongoose";
import ensureAuth from "../middlewares/ensureAuth.js";
import Character from "../models/Character.js";
import ImageAsset from "../models/ImageAsset.js";
import Work from "../models/Work.js";
import uploadOrigin from "../middlewares/uploadOrigin.js";
import { imageUpload } from "../middlewares/imageUpload.js";
import { uploadLimiter, uploadUserLimiter } from "../middlewares/rateLimiter.js";
import { assertImageAllowed, imagePermission, txOptions } from "../services/imageAssets.js";
import { discardPortraitUpload, readStoredPortrait, uploadPortrait } from "../services/characterPortraits.js";
import { PORTRAIT_MAX_INPUT_BYTES } from "../../shared/characterPortrait.js";

const router = express.Router();
const readPortrait = imageUpload("file", ["jpeg", "png", "webp"], { maxBytes: PORTRAIT_MAX_INPUT_BYTES, portrait: true });

async function ownedPortraitCharacter(req, res, next) {
  const { id } = req.params;
  const { workId } = req.query;
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(workId)) {
    return res.status(400).json({ message: "Geçersiz karakter veya çalışma." });
  }
  try {
    const user = req.user.id;
    const scope = { _id: id, user, work: workId };
    if (!await Work.exists({ _id: workId, user }) || !await Character.exists(scope)) {
      return res.status(404).json({ message: "Karakter bulunamadı." });
    }
    req.characterScope = scope;
    return next();
  } catch (err) { return next(err); }
}

router.get("/:id/portrait/:assetId", ensureAuth, async (req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  const { id, assetId } = req.params;
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(assetId)) return res.sendStatus(404);
  try {
    const user = req.user.id;
    const url = `/api/characters/${id}/portrait/${assetId}`;
    const character = await Character.findOne({ _id: id, user, imageUrl: url }).select("work").lean();
    if (!character || !await Work.exists({ _id: character.work, user })) return res.sendStatus(404);
    const bytes = await readStoredPortrait({ _id: assetId, owner: user, url, state: "active" });
    if (!bytes) return res.sendStatus(404);
    return res.set("X-Content-Type-Options", "nosniff").type("image/webp").send(bytes);
  } catch (err) { return next(err); }
});

router.post("/:id/portrait", uploadLimiter, uploadOrigin, ensureAuth, uploadUserLimiter, ownedPortraitCharacter, imagePermission, readPortrait, async (req, res, next) => {
  const scope = req.characterScope;
  const assetId = new mongoose.Types.ObjectId();
  const url = `/api/characters/${scope._id}/portrait/${assetId}`;
  let uploaded;
  try {
    uploaded = await uploadPortrait(assetId, req.file.buffer);
    const item = await mongoose.connection.transaction(async session => {
      await assertImageAllowed(req.user.id, session);
      const character = await Character.findOneAndUpdate(scope, { $set: { imageUrl: url }, $unset: { removedImageCase: 1 } }, { new: true, session });
      if (!character) return null;
      await ImageAsset.create([{ _id: assetId, owner: req.user.id, url, privatePortrait: true, ...uploaded, mime: req.file.mimetype }], { session });
      return character;
    }, txOptions);
    if (!item) {
      await discardPortraitUpload(assetId);
      return res.status(404).json({ message: "Karakter bulunamadı." });
    }
    return res.status(201).json({ item });
  } catch (err) {
    if (uploaded && !err.hasErrorLabel?.("UnknownTransactionCommitResult")) {
      // A failed commit response can still mean that the transaction committed.
      const exists = await ImageAsset.exists({ _id: assetId }).catch(() => true);
      if (!exists) await discardPortraitUpload(assetId);
    }
    if (!err.status) return next(err);
    return res.status(err.status).json({ message: err.message, code: err.code, until: err.until });
  }
});

router.delete("/:id/portrait", uploadOrigin, ensureAuth, ownedPortraitCharacter, async (req, res, next) => {
  try {
    const item = await Character.findOneAndUpdate(req.characterScope, { $unset: { imageUrl: 1, removedImageCase: 1 } }, { new: true });
    return item ? res.json({ item }) : res.status(404).json({ message: "Karakter bulunamadı." });
  } catch (err) { return next(err); }
});

// DEBUG
router.get("/ping", (req, res) => {
  res.json({ ok: true, route: "characters" });
});

/* ═══════════════════════════════════════════
   GET /api/characters?workId=...
═══════════════════════════════════════════ */
router.get("/", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { workId } = req.query;

    if (!userId) return res.status(401).json({ message: "Giriş yapılmamış." });
    if (!workId) return res.status(400).json({ message: "workId gerekli." });

    const work = await Work.findOne({ _id: workId, user: userId });
    if (!work) return res.status(403).json({ message: "Bu çalışmaya erişim yok." });

    const items = await Character.find({ user: userId, work: workId }).sort({ updatedAt: -1 });
    res.json({ items });
  } catch (err) {
    console.error("GET /characters error:", err);
    res.status(500).json({ message: "Karakterler alınamadı." });
  }
});

/* ═══════════════════════════════════════════
   PATCH /api/characters/:id
   (name / role / color / notes / tagline / faction / location / status)
═══════════════════════════════════════════ */
router.patch("/:id", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { workId } = req.body;

    if (!userId) return res.status(401).json({ message: "Giriş yapılmamış." });
    if (!workId) return res.status(400).json({ message: "workId gerekli." });

    const work = await Work.findOne({ _id: workId, user: userId });
    if (!work) return res.status(403).json({ message: "Bu çalışmaya erişim yok." });

    const allowed = ["name", "role", "color", "notes", "tagline", "faction", "location", "status"];
    const patch = {};
    for (const k of allowed) {
      if (req.body?.[k] !== undefined) patch[k] = req.body[k];
    }

    if (typeof patch.name   === "string") patch.name  = patch.name.trim();
    if (typeof patch.role   === "string") patch.role  = patch.role.trim();
    if (typeof patch.color  === "string") patch.color = patch.color.trim();

    const item = await Character.findOneAndUpdate(
      { _id: id, user: userId, work: workId },
      { $set: patch },
      { new: true }
    );

    if (!item) return res.status(404).json({ message: "Karakter bulunamadı." });
    res.json({ item });
  } catch (err) {
    console.error("PATCH /characters/:id error:", err);
    res.status(500).json({ message: "Karakter güncellenemedi." });
  }
});

/* ═══════════════════════════════════════════
   PATCH /api/characters/:id/position
═══════════════════════════════════════════ */
router.patch("/:id/position", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { workId, x, y, positionMode } = req.body;

    if (!userId) return res.status(401).json({ message: "Giriş yapılmamış." });
    if (!workId) return res.status(400).json({ message: "workId gerekli." });
    if (!Number.isFinite(x) || !Number.isFinite(y) || (positionMode !== undefined && !["manual", "auto"].includes(positionMode))) {
      return res.status(400).json({ message: "Geçersiz harita konumu." });
    }

    const work = await Work.findOne({ _id: workId, user: userId });
    if (!work) return res.status(403).json({ message: "Bu çalışmaya erişim yok." });

    const item = await Character.findOneAndUpdate(
      { _id: id, user: userId, work: workId },
      { $set: { x, y, positionMode: positionMode ?? "manual" } },
      { new: true }
    );

    if (!item) return res.status(404).json({ message: "Karakter bulunamadı." });
    res.json({ item });
  } catch (err) {
    console.error("PATCH /characters/:id/position error:", err);
    res.status(500).json({ message: "Pozisyon güncellenemedi." });
  }
});

/* ═══════════════════════════════════════════
   POST /api/characters
═══════════════════════════════════════════ */
router.post("/", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { workId } = req.body;

    if (!userId) return res.status(401).json({ message: "Giriş yapılmamış." });
    if (!workId) return res.status(400).json({ message: "workId gerekli." });

    const work = await Work.findOne({ _id: workId, user: userId });
    if (!work) return res.status(403).json({ message: "Bu çalışmaya erişim yok." });

    const allowed = ["name", "role", "notes", "tagline", "x", "y", "color", "faction", "location", "positionMode"];
    const patch = {};
    for (const k of allowed) {
      if (req.body?.[k] !== undefined) patch[k] = req.body[k];
    }

    const item = await Character.create({
      user:     userId,
      work:     workId,
      name:     patch.name?.trim() || "Yeni Karakter",
      role:     patch.role    || "",
      x:        typeof patch.x === "number" ? patch.x : 240,
      y:        typeof patch.y === "number" ? patch.y : 200,
      positionMode: patch.positionMode === "auto" ? "auto" : undefined,
      color:    patch.color   || "#7dd3fc",
      tagline:  patch.tagline || "",
      notes:    patch.notes   || "",
      faction:  patch.faction || "",
      location: patch.location || "",
      traits:   [],
      status:   "active",
    });

    res.status(201).json({ item });
  } catch (err) {
    console.error("POST /characters error:", err);
    res.status(500).json({ message: "Karakter oluşturulamadı." });
  }
});

/* ═══════════════════════════════════════════
   DELETE /api/characters/:id?workId=...
═══════════════════════════════════════════ */
router.delete("/:id", ensureAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { workId } = req.query;

    if (!userId) return res.status(401).json({ message: "Giriş yapılmamış." });
    if (!workId) return res.status(400).json({ message: "workId gerekli." });

    const work = await Work.findOne({ _id: workId, user: userId });
    if (!work) return res.status(403).json({ message: "Bu çalışmaya erişim yok." });

    const item = await Character.findOneAndDelete({ _id: id, user: userId, work: workId });
    if (!item) return res.status(404).json({ message: "Karakter bulunamadı." });

    return res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /characters/:id error:", err);
    return res.status(500).json({ message: "Karakter silinemedi." });
  }
});

export default router;
