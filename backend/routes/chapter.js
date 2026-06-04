// backend/routes/chapter.js
import express      from "express";
import ensureAuth   from "../middlewares/ensureAuth.js";
import Chapter      from "../models/Chapter.js";
import Work         from "../models/Work.js";
import Notification from "../models/Notification.js";
import User         from "../models/User.js";
import { sendMail, sendStaffMail } from "../services/emailService.js";
import { moderateChapter }         from "../utils/aiModerator.js";
import { sanitizeChapterHtml } from "../utils/sanitizeHtml.js";

const router = express.Router();

async function assertWorkOwner(workId, userId) {
  const work = await Work.findOne({ _id: workId, user: userId });
  if (!work) throw Object.assign(new Error("Erişim reddedildi."), { status: 403 });
  return work;
}

/* ── Work.status senkronize — TEK KURAL: 0 published → draft, 1+ → published ── */
async function syncWorkStatus(workId) {
  const work = await Work.findById(workId);
  if (!work) return;
  const hasPublished = (work.publishedChapterIds?.length ?? 0) > 0;
  const newStatus    = hasPublished ? "published" : "draft";
  if (work.status !== newStatus) { work.status = newStatus; await work.save(); }
}

async function notifyAuthor({ userId, workId, type, text }) {
  try {
    await Notification.create({ recipient: userId, sender: null, type, work: workId, text, read: false });
  } catch (err) { console.error("Bildirim oluşturulamadı:", err.message); }
}

async function notifyStaff({ workId, type, text }) {
  try {
    const staff = await User.find({ role: { $in: ["admin", "moderator"] } }).select("_id").lean();
    await Promise.all(
      staff.map(u =>
        Notification.create({ recipient: u._id, sender: null, type, work: workId, text, read: false })
      )
    );
  } catch (err) { console.error("Staff bildirimi oluşturulamadı:", err.message); }
}

function buildReviewNote(modResult) {
  return [
    modResult.reason,
    modResult.violations?.length ? `(${modResult.violations.join(", ")})` : null,
  ].filter(Boolean).join(" ") || "";
}

// ════════════════════════════════════════════
// 1. BÖLÜMLERİ GETİR — GET /api/chapters?workId=...
// ════════════════════════════════════════════
router.get("/", ensureAuth, async (req, res) => {
  try {
    const { workId } = req.query;
    const userId = req.user?.id || req.userId;
    if (!workId) return res.status(400).json({ message: "workId gerekli." });
    await assertWorkOwner(workId, userId);
    const chapters = await Chapter.find({ work: workId })
      .select("title order status content updatedAt reviewNote")
      .sort({ order: 1 });
    res.json({ items: chapters });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Bölümler yüklenemedi." });
  }
});

// ════════════════════════════════════════════
// 2. TEK BÖLÜM GETİR — GET /api/chapters/:id
// ════════════════════════════════════════════
router.get("/:id", ensureAuth, async (req, res) => {
  try {
    const userId  = req.user?.id || req.userId;
    const chapter = await Chapter.findById(req.params.id);
    if (!chapter) return res.status(404).json({ message: "Bölüm bulunamadı." });
    await assertWorkOwner(chapter.work, userId);
    res.json({ item: chapter });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Bölüm yüklenemedi." });
  }
});

// ════════════════════════════════════════════
// 3. YENİ BÖLÜM — POST /api/chapters
// ════════════════════════════════════════════
router.post("/", ensureAuth, async (req, res) => {
  try {
    const { workId, title } = req.body;
    const userId = req.user?.id || req.userId;
    if (!workId) return res.status(400).json({ message: "workId gerekli." });
    await assertWorkOwner(workId, userId);
    const lastChapter = await Chapter.findOne({ work: workId }).sort({ order: -1 });
    const newOrder    = lastChapter ? lastChapter.order + 1 : 1;
    const newChapter  = await Chapter.create({
      work: workId, title: title?.trim() || `Bölüm ${newOrder}`,
      content: "", order: newOrder, status: "draft",
    });
    res.status(201).json({ item: newChapter });
  } catch (err) {
    console.error("Create Chapter Error:", err);
    res.status(err.status || 500).json({ message: err.message || "Bölüm oluşturulamadı." });
  }
});

// ════════════════════════════════════════════
// 4. BÖLÜM GÜNCELLE — PUT /api/chapters/:id
// ════════════════════════════════════════════
router.put("/:id", ensureAuth, async (req, res) => {
  try {
    const { title, content } = req.body;
    const userId  = req.user?.id || req.userId;
    const chapter = await Chapter.findById(req.params.id);
    if (!chapter) return res.status(404).json({ message: "Bölüm bulunamadı." });
    await assertWorkOwner(chapter.work, userId);

    // FIX: published + rejected + pending_review — hepsi içerik değişince draft'a düşer
    const wasModerated = ["published", "rejected", "pending_review"].includes(chapter.status);

    if (title   !== undefined) chapter.title   = title.trim() || chapter.title;
    if (content !== undefined) chapter.content = sanitizeChapterHtml(content);

    if (wasModerated && content !== undefined) {
      chapter.status     = "draft";
      chapter.reviewNote = "";
      await Work.findByIdAndUpdate(chapter.work, { $pull: { publishedChapterIds: chapter._id } });
      await syncWorkStatus(chapter.work);
    }

    await chapter.save();
    res.json({
      item: chapter,
      message: wasModerated && content !== undefined
        ? "Kaydedildi. Değişikliklerin yayına girmesi için bölümü tekrar yayınlaman gerekiyor."
        : "Kaydedildi.",
      draftedFromPublished: wasModerated && content !== undefined,
    });
  } catch (err) {
    console.error("Update Error:", err);
    res.status(err.status || 500).json({ message: err.message || "Kaydedilemedi." });
  }
});

// ════════════════════════════════════════════
// 5. DURUM GÜNCELLE — PATCH /api/chapters/:id/status
// ════════════════════════════════════════════
router.patch("/:id/status", ensureAuth, async (req, res) => {
  try {
    const { status, workId } = req.body;
    const userId = req.user?.id || req.userId;

    if (!["draft", "published"].includes(status))
      return res.status(400).json({ message: "Geçersiz status. 'draft' veya 'published' olmalı." });

    const chapter = await Chapter.findById(req.params.id);
    if (!chapter) return res.status(404).json({ message: "Bölüm bulunamadı." });

    const targetWorkId = workId || chapter.work;
    const work         = await assertWorkOwner(targetWorkId, userId);

    // ── Taslağa al ──────────────────────────────────────────────────────
    if (status === "draft") {
      chapter.status = "draft";
      await chapter.save();
      await Work.findByIdAndUpdate(targetWorkId, { $pull: { publishedChapterIds: chapter._id } });
      await syncWorkStatus(targetWorkId);
      return res.json({ item: chapter, message: "Bölüm taslağa alındı." });
    }

    if (!chapter.content?.trim())
      return res.status(400).json({ message: "Bölüm içeriği boş, yayınlanamaz." });

    // ── contentBanned: ensureAuth token'ında YOK — DB'den oku ───────────
    const dbUser = await User.findById(userId).select("contentBanned").lean();
    if (dbUser?.contentBanned) {
      chapter.status     = "pending_review";
      chapter.reviewNote = "Kullanıcının içerik kısıtlaması var — moderatör onayı bekleniyor.";
      await chapter.save();

      await notifyStaff({
        workId: targetWorkId, type: "chapter_pending",
        text: `"${chapter.title}" bölümü moderatör onayı bekliyor (içerik kısıtlamalı kullanıcı).`,
      });
      await notifyAuthor({
        userId, workId: targetWorkId, type: "chapter_pending",
        text: `"${chapter.title}" bölümünüz moderatör onayına gönderildi. Onaylandıktan sonra yayına alınacak.`,
      });

      try {
        await sendStaffMail({
          subject: `Moderasyon Kuyruğu: "${chapter.title}" — İçerik Kısıtlı Kullanıcı`,
          urgency: "medium",
          html: `
            <h3>Yeni Kuyruk Girdisi</h3>
            <p><strong>Bölüm:</strong> ${chapter.title}</p>
            <p><strong>Hikaye:</strong> ${work.title}</p>
            <p><strong>Sebep:</strong> Kullanıcının içerik kısıtlaması var.</p>
            <br>
            <a href="${process.env.CLIENT_URL}/moderator"
               style="background:#3a8080;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px">
              Moderatör Panelinde İncele
            </a>
          `,
        });
      } catch (e) { console.error("Staff mail gönderilemedi:", e.message); }

      return res.status(202).json({
        item: chapter, status: "pending_review", pending: true,
        message: "Bölümünüz moderatör onayına gönderildi. Onaylandıktan sonra yayına alınacak.",
      });
    }

    // ── Normal akış: AI moderasyon ───────────────────────────────────────
    const modResult = await moderateChapter(chapter.title, chapter.content);

    // ── CLEAN ────────────────────────────────────────────────────────────
    if (modResult.severity === "clean") {
      chapter.status     = "published";
      chapter.reviewNote = "";
      await chapter.save();
      await Work.findByIdAndUpdate(targetWorkId, { $addToSet: { publishedChapterIds: chapter._id } });
      await syncWorkStatus(targetWorkId);
      return res.json({ item: chapter, message: "Bölüm yayınlandı.", status: "published" });
    }

    // ── REVIEW ───────────────────────────────────────────────────────────
    if (modResult.severity === "review") {
      chapter.status     = "pending_review";
      chapter.reviewNote = buildReviewNote(modResult);
      await chapter.save();

      await notifyAuthor({
        userId, workId: targetWorkId, type: "chapter_pending",
        text: `"${chapter.title}" bölümünüz incelemeye alındı. En geç 6 saat içinde size geri dönüş yapılacaktır.`,
      });
      await notifyStaff({
        workId: targetWorkId, type: "chapter_pending",
        text: `"${chapter.title}" bölümü inceleme bekliyor. (AI: ${modResult.reason || "belirsiz"})`,
      });

      try {
        await sendStaffMail({
          subject: `İnceleme Bekliyor: "${chapter.title}"`,
          urgency: "medium",
          html: `
            <h3>Yeni İnceleme Talebi</h3>
            <p><strong>Bölüm:</strong> ${chapter.title}</p>
            <p><strong>Hikaye:</strong> ${work.title}</p>
            <p><strong>Şüphe:</strong> ${modResult.reason || "Belirsiz içerik"}</p>
            <p><strong>Kategoriler:</strong> ${modResult.violations?.join(", ") || "—"}</p>
            <br>
            <a href="${process.env.CLIENT_URL}/moderator"
               style="background:#3a8080;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px">
              Moderatör Panelinde İncele
            </a>
          `,
        });
      } catch (e) { console.error("Staff mail gönderilemedi:", e.message); }

      return res.status(202).json({
        item: chapter, status: "pending_review", pending: true,
        message: "Bölümünüz incelemeye alındı. 6 saat içinde size geri dönüş yapılacaktır.",
      });
    }

    // ── REJECT ───────────────────────────────────────────────────────────
    chapter.status     = "rejected";
    chapter.reviewNote = buildReviewNote(modResult) || "İçerik politikamıza aykırı içerik tespit edildi.";
    await chapter.save();

    await notifyAuthor({
      userId, workId: targetWorkId, type: "chapter_rejected",
      text: `"${chapter.title}" bölümünüz içerik politikamıza aykırı olduğu için yayınlanamadı.`,
    });

    try {
      const yazar = await User.findById(userId).select("email kullaniciAdi").lean();
      if (yazar?.email) {
        await sendMail({
          to: yazar.email,
          subject: `"${chapter.title}" bölümünüz yayınlanamıyor`,
          html: `
            <p>Merhaba ${yazar.kullaniciAdi || "yazar"},</p>
            <p><strong>"${chapter.title}"</strong> başlıklı bölümünüz içerik politikamıza aykırı içerik barındırdığı için yayınlanamıyor.</p>
            <p><strong>Sebep:</strong> ${modResult.reason || "İçerik politikası ihlali"}</p>
            <p>Bölümü düzenleyerek tekrar yayınlamayı deneyebilirsiniz.</p>
            <p>ACB Atölyesi ekibi</p>
          `,
        });
      }
    } catch (e) { console.error("Red maili gönderilemedi:", e.message); }

    try {
      await sendStaffMail({
        subject: `Otomatik Reddedildi: "${chapter.title}"`,
        urgency: "high",
        html: `
          <h3>İçerik Otomatik Reddedildi</h3>
          <p><strong>Bölüm:</strong> ${chapter.title}</p>
          <p><strong>Hikaye:</strong> ${work.title}</p>
          <p><strong>Sebep:</strong> ${modResult.reason}</p>
          <p><strong>Kategoriler:</strong> ${modResult.violations?.join(", ") || "—"}</p>
        `,
      });
    } catch (e) { console.error("Staff reject maili gönderilemedi:", e.message); }

    return res.status(422).json({
      item: chapter, status: "rejected", rejected: true,
      message: "Bölüm içerik politikamıza aykırı olduğu için yayınlanamıyor. Düzenleyerek tekrar deneyebilirsiniz.",
    });

  } catch (err) {
    console.error("Status Update Error:", err);
    res.status(err.status || 500).json({ message: err.message || "Durum güncellenemedi." });
  }
});

// ════════════════════════════════════════════
// 6. ONAYLA — PATCH /api/chapters/:id/approve
// ════════════════════════════════════════════
router.patch("/:id/approve", ensureAuth, async (req, res) => {
  try {
    if (!["admin", "moderator"].includes(req.user?.role))
      return res.status(403).json({ message: "Yetkiniz yok." });

    const chapter = await Chapter.findById(req.params.id);
    if (!chapter) return res.status(404).json({ message: "Bölüm bulunamadı." });

    chapter.status = "published"; chapter.reviewNote = "";
    await chapter.save();
    await Work.findByIdAndUpdate(chapter.work, { $addToSet: { publishedChapterIds: chapter._id } });
    await syncWorkStatus(chapter.work);

    const work = await Work.findById(chapter.work).select("user title");
    if (work?.user) {
      await notifyAuthor({
        userId: work.user, workId: chapter.work, type: "chapter_approved",
        text: `"${chapter.title}" bölümünüz onaylandı ve yayına alındı! ✓`,
      });
      try {
        const yazar = await User.findById(work.user).select("email kullaniciAdi").lean();
        if (yazar?.email) {
          await sendMail({
            to: yazar.email,
            subject: `"${chapter.title}" bölümünüz onaylandı ✅`,
            html: `
              <p>Merhaba ${yazar.kullaniciAdi || "yazar"},</p>
              <p><strong>"${chapter.title}"</strong> başlıklı bölümünüz incelendi ve yayına alındı.</p>
              <p>ACB Atölyesi ekibi</p>
            `,
          });
        }
      } catch (e) { console.error("Onay maili gönderilemedi:", e.message); }
    }

    return res.json({ item: chapter, message: "Bölüm onaylandı ve yayınlandı." });
  } catch (err) {
    console.error("Approve Error:", err);
    res.status(err.status || 500).json({ message: err.message || "Onaylama başarısız." });
  }
});

// ════════════════════════════════════════════
// 7. REDDET — PATCH /api/chapters/:id/reject
// ════════════════════════════════════════════
router.patch("/:id/reject", ensureAuth, async (req, res) => {
  try {
    if (!["admin", "moderator"].includes(req.user?.role))
      return res.status(403).json({ message: "Yetkiniz yok." });

    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ message: "Red sebebi zorunludur." });

    const chapter = await Chapter.findById(req.params.id);
    if (!chapter) return res.status(404).json({ message: "Bölüm bulunamadı." });

    chapter.status = "rejected"; chapter.reviewNote = reason.trim();
    await chapter.save();
    await Work.findByIdAndUpdate(chapter.work, { $pull: { publishedChapterIds: chapter._id } });
    await syncWorkStatus(chapter.work);

    const work = await Work.findById(chapter.work).select("user title");
    if (work?.user) {
      await notifyAuthor({
        userId: work.user, workId: chapter.work, type: "chapter_rejected",
        text: `"${chapter.title}" bölümünüz yayınlanamadı. Sebep: ${reason}`,
      });
      try {
        const yazar = await User.findById(work.user).select("email kullaniciAdi").lean();
        if (yazar?.email) {
          await sendMail({
            to: yazar.email,
            subject: `"${chapter.title}" bölümünüz reddedildi`,
            html: `
              <p>Merhaba ${yazar.kullaniciAdi || "yazar"},</p>
              <p><strong>"${chapter.title}"</strong> başlıklı bölümünüz incelendi ancak yayınlanamaz.</p>
              <p><strong>Sebep:</strong> ${reason}</p>
              <p>Bölümü düzenleyerek tekrar yayınlayabilirsiniz.</p>
              <p>ACB Atölyesi ekibi</p>
            `,
          });
        }
      } catch (e) { console.error("Red maili gönderilemedi:", e.message); }
    }

    return res.json({ item: chapter, message: "Bölüm reddedildi." });
  } catch (err) {
    console.error("Reject Error:", err);
    res.status(err.status || 500).json({ message: err.message || "Reddetme başarısız." });
  }
});

// ════════════════════════════════════════════
// 8. SİL — DELETE /api/chapters/:id
// ════════════════════════════════════════════
router.delete("/:id", ensureAuth, async (req, res) => {
  try {
    const userId  = req.user?.id || req.userId;
    const chapter = await Chapter.findById(req.params.id);
    if (!chapter) return res.status(404).json({ message: "Bölüm bulunamadı." });
    await assertWorkOwner(chapter.work, userId);
    await chapter.deleteOne();
    await Work.findByIdAndUpdate(chapter.work, { $pull: { publishedChapterIds: chapter._id } });
    await syncWorkStatus(chapter.work);
    res.json({ message: "Bölüm silindi." });
  } catch (err) {
    console.error("Delete Error:", err);
    res.status(err.status || 500).json({ message: err.message || "Silinemedi." });
  }
});

export default router;