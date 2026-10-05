// backend/models/Chapter.js
import mongoose from "mongoose";
import { matureFilter } from "../services/matureAccess.js";
import Work from "./Work.js";
import { databaseNow } from "../services/databaseClock.js";

const chapterSchema = new mongoose.Schema(
  {
    developmentWordHighWater: { type: Number, default: null },
    firstPublishedAt: Date,
    publicationDateEstimated: { type: Boolean, default: false },
    revision: { type: Number, default: 0 },
    moderationHold: { type: Boolean, default: false },
    reviewHistory: [{ revision: Number, by: mongoose.Schema.Types.ObjectId, at: Date, action: String, reason: String }],
    moderationCase: { type: mongoose.Schema.Types.ObjectId, ref: 'ContentCase' },
    savedAt: { type: Date, default: null },
    work: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Work",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    content: {
      type: String,
      default: "",
    },

    order: {
      type: Number,
      default: 1,
    },

    // draft          → taslak
    // published      → yayında
    // pending_review → AI şüpheli buldu, admin onayı bekliyor
    // rejected       → admin reddetti
    status: {
      type: String,
      enum: ["draft", "published", "pending_review", "rejected"],
      default: "draft",
    },

    // AI veya admin tarafından yazılan red/uyarı notu
    reviewNote: {
      type: String,
      default: "",
    },

    // Hangi admin inceledi
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

// pending_review kuyruğunu hızlı çekmek için index
chapterSchema.index({ status: 1, createdAt: -1 });
chapterSchema.index({ work: 1, savedAt: -1 });

chapterSchema.pre("save", async function () {
  if (this.status === "published" && !this.firstPublishedAt) {
    this.firstPublishedAt = await databaseNow();
  }
});
chapterSchema.post("save", async function (chapter) {
  if (chapter.status !== "published" || !chapter.firstPublishedAt) return;
  await Work.updateOne({ _id: chapter.work }, {
    $min: { firstPublishedAt: chapter.firstPublishedAt },
    $max: { lastPublishedChapterAt: chapter.firstPublishedAt },
  }, { session: chapter.$session(), timestamps: false });
});

chapterSchema.pre(/^(find|count|distinct)/, async function () {
  if (Object.keys(matureFilter()).length) {
    const ids = await Work.distinct("_id", matureFilter());
    this.and([{ work: { $in: ids } }]);
  }
});

const Chapter = mongoose.model("Chapter", chapterSchema);
export default Chapter;
