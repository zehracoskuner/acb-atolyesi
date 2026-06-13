// backend/models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    kullaniciAdi: {
      type:   String,
      required: false,
      trim:   true,
      unique: true,
      sparse: true,
      index:  true,
    },
    email: {
      type:      String,
      required:  true,
      unique:    true,
      lowercase: true,
      trim:      true,
    },

    sifreHash: { type: String, default: null, required: false },

    authProvider: {
      type:    String,
      enum:    ["local", "google", "both"],
      default: "local",
    },

    profileComplete: { type: Boolean, default: true },

    googleId: { type: String, default: null, sparse: true },

    emailVerified:      { type: Boolean, default: false },
    emailVerifyToken:   { type: String,  default: null },
    emailVerifyExpires: { type: Date,    default: null },

    passwordResetToken:   { type: String, default: null },
    passwordResetExpires: { type: Date,   default: null },

    experienceLevel: {
      type:    String,
      enum:    ["no-experience", "beginner", "experienced"],
      default: "no-experience",
    },

    settings: {
      theme: { type: String, enum: ["light", "dark", "sepia"], default: "light" },
    },

    // ── Rol sistemi ──────────────────────────────────────────
    // "user"       → normal kullanıcı
    // "moderator"  → içerik + yorum onayı yapabilir, ban atamaz
    // "admin"      → tam yetki, ban atar
    // "banned"     → platforma erişim tamamen engellendi (50+ şikayet)
    role: {
      type:    String,
      enum:    ["user", "moderator", "admin", "banned"],
      default: "user",
      index:   true,
    },

    // ── Kısıtlı ban türleri (role'dan bağımsız) ──────────────
    // commentBanned: true → yorumları pending_review'a düşer, mod onaylar
    // contentBanned: true → bölüm/eser paylaşımları pending_review'a düşer
    // İkisi aynı anda aktif olabilir, birbirini etkilemez.
    commentBanned: {
      type:    Boolean,
      default: false,
      index:   true,
    },
    contentBanned: {
      type:    Boolean,
      default: false,
      index:   true,
    },

    // Ban meta — admin neden banladı, ne zaman
    banMeta: {
      commentBannedAt:     { type: Date,   default: null },
      commentBannedBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      commentBanReason:    { type: String, default: "" },
      contentBannedAt:     { type: Date,   default: null },
      contentBannedBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      contentBanReason:    { type: String, default: "" },
      fullBannedAt:        { type: Date,   default: null },
      fullBannedBy:        { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      fullBanReason:       { type: String, default: "" },
    },
    warnings: [{
      message:  { type: String, default: "" },
      issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      issuedAt: { type: Date, default: Date.now },
      reportId: { type: mongoose.Schema.Types.ObjectId, ref: "Report", default: null },
    }],

    library: [{ type: mongoose.Schema.Types.ObjectId, ref: "Work" }],

    avatarUrl:   { type: String, default: "" },
    bannerImage: { type: String, default: "" },
    bio:         { type: String, default: "" },
    location:    { type: String, default: "" },
    website:     { type: String, default: "" },

    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // ── Yazma serisi (streak) ────────────────────────────────
    currentStreak: { type: Number, default: 0 },
    longestStreak: { type: Number, default: 0 },
    lastWriteDate: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function () {
  return {
    id:              this._id,
    kullaniciAdi:    this.kullaniciAdi,
    email:           this.email,
    emailVerified:   this.emailVerified,
    avatarUrl:       this.avatarUrl,
    authProvider:    this.authProvider,
    profileComplete: this.profileComplete,
    experienceLevel: this.experienceLevel,
    settings:        this.settings,
    role:            this.role,
    commentBanned:   this.commentBanned,
    contentBanned:   this.contentBanned,
    currentStreak:   this.currentStreak,
    longestStreak:   this.longestStreak,
    lastWriteDate:   this.lastWriteDate,
    createdAt:       this.createdAt,
  };
};

userSchema.statics.isValidUsername = function (str) {
  return /^[a-zA-Z0-9_]{3,30}$/.test(str);
};

const User = mongoose.model("User", userSchema);
export default User;