import User from "../models/User.js";
import { notifyFollow } from "../services/notificationService.js";

export const notifyFollow = async ({ senderId, receiverId }) => {
  console.log("notifyFollow çağrıldı:", { senderId, receiverId }); // ← ekle

    if (String(senderId) === String(receiverId)) return;

  // Zaten varsa yeni oluşturma
  const existing = await Notification.findOne({
    recipient: receiverId,
    sender:    senderId,
    type:      "follow",
  });
  if (existing) return; // ← duplicate engelle

  const sender = await User.findById(senderId)
    .select("username kullaniciAdi").lean();
  if (!sender) return;

  await Notification.create({
    recipient: receiverId,
    sender:    senderId,
    type:      "follow",
    text:      `${sender.kullaniciAdi || sender.username} seni takip etmeye başladı.`,
  });

  if (!receiverId) {
    console.error("receiverId eksik! Bildirim oluşturulmadı.");
    return;
  }
}

export const toggleFollow = async (req, res) => {
  try {
    const currentUserId = req.user.id; // Takip eden (Sen)
    const targetProfileId = req.params.id; // Takip edilen

    if (String(currentUserId) === String(targetProfileId)) {
      return res.status(400).json({ error: "Kendinizi takip edemezsiniz." });
    }

    const targetUser = await User.findById(targetProfileId);
    const currentUser = await User.findById(currentUserId);

    if (!targetUser || !currentUser) {
      return res.status(404).json({ error: "Kullanıcı bulunamadı." });
    }

    // Dizinin içinde var mıyım kontrolü
    const isFollowing = targetUser.followers.includes(currentUserId);

    if (isFollowing) {
      // ❌ Takipten Çık (Bildirim YOK)
      await User.findByIdAndUpdate(targetProfileId, { $pull: { followers: currentUserId } });
      await User.findByIdAndUpdate(currentUserId, { $pull: { following: targetProfileId } });
      
      return res.json({ 
        following: false, 
        followerCount: Math.max(0, targetUser.followers.length - 1) 
      });
    } else {
      // ✅ Takip Et
      await User.findByIdAndUpdate(targetProfileId, { $addToSet: { followers: currentUserId } });
      await User.findByIdAndUpdate(currentUserId, { $addToSet: { following: targetProfileId } });

      // 🔥 BİLDİRİMİ GÖNDER
      notifyFollow({ senderId: currentUserId, receiverId: targetProfileId }).catch(console.error);

      return res.json({ 
        following: true, 
        followerCount: targetUser.followers.length + 1 
      });
    }
  } catch (err) {
    console.error("Takip etme hatası:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
};