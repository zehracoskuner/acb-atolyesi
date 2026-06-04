// backend/services/notificationService.js
import Notification from "../models/Notification.js";
import User         from "../models/User.js";
import Work         from "../models/Work.js";

/* ─── Ortak yardımcı ─── */
const createNotification = async ({ recipientId, senderId, type, workId, logId, text }) => {
  if (senderId && String(recipientId) === String(senderId)) return;

  await Notification.create({
    recipient: recipientId,
    sender:    senderId || null,
    type,
    work:      workId || null,
    log:       logId  || null,
    text,
    read:      false,
  });
};

/* ═══════════════════════════════════════════
   Tüm admin ve moderatörlere bildirim gönder
   (chapter_pending, chapter_rejected vb. sistem olayları için)
═══════════════════════════════════════════ */
export const notifyStaff = async ({ type, workId, text, excludeUserId = null }) => {
  try {
    const staff = await User.find({ role: { $in: ["admin", "moderator"] } })
      .select("_id")
      .lean();

    await Promise.all(
      staff
        .filter(u => !excludeUserId || String(u._id) !== String(excludeUserId))
        .map(u =>
          Notification.create({
            recipient: u._id,
            sender:    null,
            type,
            work:      workId || null,
            text,
            read:      false,
          }).catch(() => {}) // tek bir kullanıcı patlarsa diğerleri etkilenmesin
        )
    );
  } catch (err) {
    console.error("notifyStaff hatası:", err.message);
  }
};

/* ═══════════════════════════════════════════
   Sadece adminlere bildirim
   (ban bildirimi, kritik sistem olayları)
═══════════════════════════════════════════ */
export const notifyAdmins = async ({ type, workId, text }) => {
  try {
    const admins = await User.find({ role: "admin" }).select("_id").lean();

    await Promise.all(
      admins.map(u =>
        Notification.create({
          recipient: u._id,
          sender:    null,
          type,
          work:      workId || null,
          text,
          read:      false,
        }).catch(() => {})
      )
    );
  } catch (err) {
    console.error("notifyAdmins hatası:", err.message);
  }
};

/* ═══════════════════════════════════════════
   Eser beğeni bildirimi
═══════════════════════════════════════════ */
export const notifyLike = async ({ senderId, workId }) => {
  const [sender, work] = await Promise.all([
    User.findById(senderId).select("username kullaniciAdi").lean(),
    Work.findById(workId).select("title user").lean(),
  ]);
  if (!work?.user) return;

  const senderName = sender?.kullaniciAdi || sender?.username || "Bir okur";
  const workTitle  = work.title || "bir eser";

  await createNotification({
    recipientId: work.user,
    senderId,
    type:   "like",
    workId,
    text:   `${senderName}, "${workTitle}" adlı eserini beğendi.`,
  });
};

/* ═══════════════════════════════════════════
   Eser yorum bildirimi (eser sahibine)
═══════════════════════════════════════════ */
export const notifyComment = async ({ senderId, workId, commentPreview }) => {
  const [sender, work] = await Promise.all([
    User.findById(senderId).select("username kullaniciAdi").lean(),
    Work.findById(workId).select("title user").lean(),
  ]);
  if (!work?.user) return;

  const senderName = sender?.kullaniciAdi || sender?.username || "Bir okur";
  const workTitle  = work.title || "bir eser";
  const preview    = commentPreview?.slice(0, 50) || "";

  await createNotification({
    recipientId: work.user,
    senderId,
    type:   "comment",
    workId,
    text:   `${senderName}, "${workTitle}" eserine yorum yaptı${preview ? `: "${preview}…"` : "."}`,
  });
};

/* ═══════════════════════════════════════════
   Yorum yanıt bildirimi (yanıtlanan yorumun sahibine)
   — type olarak "comment" kullanıyoruz (frontend zaten tanıyor);
     metinle yanıt olduğu belli. İstersen enum'a "comment_reply" ekleyip
     burada değiştirebilirsin.
═══════════════════════════════════════════ */
export const notifyReply = async ({ senderId, recipientId, workId }) => {
  if (String(senderId) === String(recipientId)) return;

  const sender = await User.findById(senderId).select("username kullaniciAdi").lean();
  const senderName = sender?.kullaniciAdi || sender?.username || "Bir okur";

  await createNotification({
    recipientId,
    senderId,
    type:   "comment",
    workId,
    text:   `${senderName} bir yorumunuza yanıt verdi.`,
  });
};

/* ═══════════════════════════════════════════
   Yorum kaldırıldı bildirimi (moderasyon — sistem, sender: null)
   moderateComment / deleteComment / adminReports comment silme
═══════════════════════════════════════════ */
export const notifyCommentRemoved = async ({ recipientId, workId = null }) => {
  await createNotification({
    recipientId,
    senderId: null,
    type:    "comment_removed",
    workId,
    text:    "Bir yorumunuz moderatör kararıyla kaldırıldı.",
  });
};

/* ═══════════════════════════════════════════
   Kullanıcı uyarısı (adminReports /warn — sistem, sender: null)
═══════════════════════════════════════════ */
export const notifyWarning = async ({ recipientId, message, context = "bir içeriğiniz", workId = null }) => {
  await createNotification({
    recipientId,
    senderId: null,
    type:    "warning",
    workId,
    text:    `Şikayet edilen ${context} nedeniyle uyarı aldınız: ${message}`,
  });
};

/* ═══════════════════════════════════════════
   Takip bildirimi — duplicate korumalı
═══════════════════════════════════════════ */
export const notifyFollow = async ({ senderId, receiverId }) => {
  if (String(senderId) === String(receiverId)) return;

  const existing = await Notification.findOne({
    recipient: receiverId,
    sender:    senderId,
    type:      "follow",
  });

  if (existing) {
    existing.read      = false;
    existing.createdAt = new Date();
    await existing.save();
    return;
  }

  const sender = await User.findById(senderId).select("username kullaniciAdi").lean();
  if (!sender) return;

  await Notification.create({
    recipient: receiverId,
    sender:    senderId,
    type:      "follow",
    text:      `${sender.kullaniciAdi || sender.username} seni takip etmeye başladı.`,
    read:      false,
  });
};

/* ═══════════════════════════════════════════
   Günlük beğeni bildirimi
═══════════════════════════════════════════ */
export const notifyLogLike = async ({ senderId, logId, logAuthorId }) => {
  if (String(senderId) === String(logAuthorId)) return;

  const existing = await Notification.findOne({
    recipient: logAuthorId,
    sender:    senderId,
    type:      "log_like",
    log:       logId,
  });
  if (existing) return;

  const sender = await User.findById(senderId).select("username kullaniciAdi").lean();
  if (!sender) return;

  await createNotification({
    recipientId: logAuthorId,
    senderId,
    type:  "log_like",
    logId,
    text:  `${sender.kullaniciAdi || sender.username} günlük girdini beğendi.`,
  });
};

/* ═══════════════════════════════════════════
   Günlük yorum bildirimi
═══════════════════════════════════════════ */
export const notifyLogComment = async ({ senderId, logId, logAuthorId, commentPreview }) => {
  if (String(senderId) === String(logAuthorId)) return;

  const sender = await User.findById(senderId).select("username kullaniciAdi").lean();
  if (!sender) return;

  const preview    = commentPreview?.slice(0, 50) || "";
  const senderName = sender.kullaniciAdi || sender.username;

  await createNotification({
    recipientId: logAuthorId,
    senderId,
    type:  "log_comment",
    logId,
    text:  preview
      ? `${senderName} günlük girdine yorum yaptı: "${preview}…"`
      : `${senderName} günlük girdine yorum yaptı.`,
  });
};