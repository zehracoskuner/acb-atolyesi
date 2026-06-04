// backend/models/Notification.js
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      index:    true,
    },
    sender: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "User",
      default: null,
    },
    type: {
      type: String,
      enum: [
        // Sosyal
        "like", "comment", "follow", "log_like", "log_comment",
        // Moderasyon (sistem bildirimleri — sender: null)
        "chapter_pending",   // incelemeye alındı
        "chapter_approved",  // onaylandı, yayında
        "chapter_rejected",  // reddedildi
        "comment_removed",   // ← YENİ: yorum moderatör kararıyla kaldırıldı
        "warning",           // ← YENİ: kullanıcıya uyarı (adminReports /warn)
      ],
      required: true,
    },
    work: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Work",
      default: null,
    },
    log: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "Log",
      default: null,
    },
    text: {
      type:     String,
      required: true,
    },
    read: {
      type:    Boolean,
      default: false,
      index:   true,
    },
  },
  { timestamps: true, strict: false }
);

// 90 gün sonra otomatik sil
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export default mongoose.model("Notification", notificationSchema);