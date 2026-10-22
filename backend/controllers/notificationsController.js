import Notification from "../models/Notification.js";
import Log from "../models/Log.js";
import { canReadLog } from "../services/logAccess.js";

export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit  = parseInt(req.query.limit) || 30;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipient: userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("sender", "username kullaniciAdi")
        .populate("work",   "title")
        .populate("chapter", "title order")
        .lean(),
      // 🔥 DÜZELTME 1: isRead yerine read kullanıyoruz
      Notification.countDocuments({ recipient: userId, read: false }),
    ]);

    // Preserve log IDs for existing clients; only expose previews the recipient may read.
    const logs = await Log.find({ _id: { $in: notifications.map(n => n.log).filter(Boolean) } })
      .select("content author visibility createdAt").lean();
    const contexts = new Map();
    await Promise.all(logs.map(async log => {
      if (await canReadLog(log, userId)) contexts.set(String(log._id), {
        preview: log.content.slice(0, 160), createdAt: log.createdAt, author: String(log.author),
      });
    }));
    res.json({ items: notifications.map(n => ({ ...n,
      ...(n.log ? { logContext: contexts.get(String(n.log)) || null } : {}),
    })), unreadCount });
  } catch (err) {
    console.error("getNotifications hatası:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
};

export const markRead = async (req, res) => {
  try {
    await Notification.updateOne(
      { _id: req.params.id, recipient: req.user.id },
      // 🔥 DÜZELTME 2: isRead yerine read
      { read: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
};

export const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      // 🔥 DÜZELTME 3: isRead yerine read
      { recipient: req.user.id, read: false },
      { read: true }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Sunucu hatası" });
  }
};