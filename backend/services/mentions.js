import User from "../models/User.js";
import Notification from "../models/Notification.js";
import MentionCooldown from "../models/MentionCooldown.js";
import { canReadLog } from "./logAccess.js";
import { publishedDiscussion } from "./discussionAccess.js";

export async function resolveMentions(content) {
  const names = [...new Set([...content.matchAll(/(?:^|[^\w@])@([A-Za-z0-9_]{3,30})(?![A-Za-z0-9_])/g)].map(match => match[1]))];
  if (names.length > 5) throw Object.assign(new Error("Bir yorumda en fazla 5 farklı kişi etiketleyebilirsin."), { status: 400 });
  if (!names.length) return [];
  const users = await User.find({ kullaniciAdi: { $in: names } }).select("_id kullaniciAdi").lean();
  return users.map(user => ({ user: user._id, name: user.kullaniciAdi }));
}

export async function notifyMentions({ senderId, mentions, previous = [], log, workId, chapterId }) {
  const old = new Set(previous.map(mention => String(mention.user)));
  const recipients = mentions.filter(mention => String(mention.user) !== String(senderId) && !old.has(String(mention.user)));
  if (!recipients.length) return;
  if (!log && !await publishedDiscussion(workId, chapterId)) return;
  const sender = await User.findById(senderId).select("kullaniciAdi").lean();
  if (!sender) return;
  await Promise.all(recipients.map(async mention => {
    if (log && !await canReadLog(log, mention.user)) return;
    const now = new Date();
    const nextAt = new Date(now.getTime() + 5 * 60 * 1000);
    const key = `${senderId}:${mention.user}`;
    try {
      // The unique _id also prevents concurrent requests from claiming a fresh window.
      await MentionCooldown.findOneAndUpdate({ _id: key, nextAt: { $lte: now } }, { $set: { nextAt } }, { upsert: true, new: true });
    } catch (err) { if (err.code === 11000) return; throw err; }
    try {
      await Notification.create({ recipient: mention.user, sender: senderId, type: "mention",
        log: log?._id || null, work: workId || null, chapter: chapterId || null,
        text: `${sender.kullaniciAdi} bir yorumda seni etiketledi.`, read: false });
    } catch (err) {
      await MentionCooldown.deleteOne({ _id: key, nextAt });
      throw err;
    }
  }));
}
