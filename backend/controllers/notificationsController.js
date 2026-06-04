import Notification from "../models/Notification.js";

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
        .lean(),
      // 🔥 DÜZELTME 1: isRead yerine read kullanıyoruz
      Notification.countDocuments({ recipient: userId, read: false }),
    ]);

    res.json({ items: notifications, unreadCount });
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