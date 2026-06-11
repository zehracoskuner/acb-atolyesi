// backend/services/emailService.js
import nodemailer from "nodemailer";
import User       from "../models/User.js";

const transporter = nodemailer.createTransport({
  host:       process.env.SMTP_HOST || "smtp.gmail.com",
  port:       Number(process.env.SMTP_PORT) || 587,
  secure:     false,
  requireTLS: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  logger: true,
});

export const SITE_URL =
  process.env.SITE_URL ||
  process.env.CLIENT_URL ||
  (process.env.NODE_ENV === "production" ? "https://xn--acbatlyesi-icb.com" : "http://localhost:5173");

// Doğrulama linki backend'e gider (redirect-temelli endpoint), frontend'e değil.
const API_BASE_URL =
  process.env.API_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api` : null) ||
  "http://localhost:5000/api";

const FROM     = `"ACB Atölyesi" <${process.env.SMTP_USER}>`;

/* ── Generic mail ── */
export async function sendMail({ to, subject, html, text }) {
  await transporter.sendMail({
    from: FROM, to, subject, html,
    ...(text ? { text } : {}),
  });
}

/* ════════════════════════════════════════════
   TÜM STAFF'A (admin + moderatör) mail gönder
   chapter_pending, yeni şikayet gibi olaylarda kullanılır.
   Her moderatörün mailini DB'den çeker.
════════════════════════════════════════════ */
export async function sendStaffMail({ subject, html, urgency = "normal" }) {
  try {
    const staff = await User.find({ role: { $in: ["admin", "moderator"] } })
      .select("email")
      .lean();

    const emails = staff.map(u => u.email).filter(Boolean);
    if (!emails.length) return;

    // Aciliyete göre başlık öneki
    const prefix = urgency === "high" ? "🔴 " : urgency === "medium" ? "⚠️ " : "📋 ";

    await transporter.sendMail({
      from:    FROM,
      to:      emails.join(", "),
      subject: `${prefix}${subject}`,
      html,
    });
  } catch (err) {
    console.error("sendStaffMail hatası:", err.message);
  }
}

/* ════════════════════════════════════════════
   SADECE ADMİNLERE mail gönder
   Ban bildirimleri, kritik sistem olayları için.
════════════════════════════════════════════ */
export async function sendAdminMail({ subject, html }) {
  try {
    const admins = await User.find({ role: "admin" })
      .select("email")
      .lean();

    const emails = admins.map(u => u.email).filter(Boolean);
    if (!emails.length) return;

    await transporter.sendMail({
      from:    FROM,
      to:      emails.join(", "),
      subject: `🛡️ ${subject}`,
      html,
    });
  } catch (err) {
    console.error("sendAdminMail hatası:", err.message);
  }
}

/* ── E-posta doğrulama ── */
export async function sendVerificationEmail(email, token) {
  const link = `${API_BASE_URL}/auth/verify-email?token=${token}`;
  await transporter.sendMail({
    from:    FROM,
    to:      email,
    headers: { "X-Priority": "1", "X-Mailer": "ACB Atölyesi Mailer" },
    subject: "E-posta adresini doğrula — ACB Atölyesi",
    html: `
      <!DOCTYPE html><html lang="tr">
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#f0ebe2;font-family:'Georgia',serif">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ebe2;padding:40px 0">
          <tr><td align="center">
            <table width="520" cellpadding="0" cellspacing="0" style="background:#faf8f4;border:1px solid #e2ddd6;border-radius:8px;overflow:hidden">
              <tr><td style="background:#1a1209;padding:28px 40px">
                <span style="font-family:'Georgia',serif;font-size:18px;font-weight:bold;color:#f5f0e8;letter-spacing:-.01em">ACB Atölyesi</span>
                <div style="width:32px;height:2px;background:#8b2500;margin-top:8px"></div>
              </td></tr>
              <tr><td style="padding:40px">
                <h1 style="font-family:'Georgia',serif;font-size:24px;font-weight:bold;color:#1a1209;margin:0 0 8px;line-height:1.3">
                  E-posta adresini<br/><em style="color:#8b2500;font-weight:normal">doğrula.</em>
                </h1>
                <p style="font-size:14px;color:#7a6e5f;line-height:1.7;margin:16px 0 28px">
                  ACB Atölyesi'ne hoş geldin! Hesabını aktifleştirmek için aşağıdaki butona tıkla. Bağlantı <strong>24 saat</strong> geçerlidir.
                </p>
                <a href="${link}" style="display:inline-block;padding:12px 28px;background:#1a1209;color:#f5f0e8;text-decoration:none;border-radius:4px;font-size:13px;font-family:sans-serif;letter-spacing:.06em;text-transform:uppercase;font-weight:500">
                  E-postamı Doğrula
                </a>
                <p style="font-size:12px;color:#b0a898;margin-top:28px;line-height:1.6">
                  Butona tıklayamıyorsan şu bağlantıyı tarayıcına yapıştır:<br/>
                  <a href="${link}" style="color:#8b2500;word-break:break-all">${link}</a>
                </p>
                <hr style="border:none;border-top:1px solid #e2ddd6;margin:28px 0 16px"/>
                <p style="font-size:12px;color:#c4bdb2;margin:0">Bu e-postayı sen istemediysen güvenle görmezden gelebilirsin.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body></html>
    `,
  });
}

/* ── Şifre sıfırlama ── */
export async function sendPasswordResetEmail(email, token) {
  const link = `${SITE_URL}/sifre-sifirla?token=${token}`;
  await transporter.sendMail({
    from:    FROM,
    to:      email,
    subject: "Şifre sıfırlama — ACB Atölyesi",
    html: `
      <!DOCTYPE html><html lang="tr">
      <body style="margin:0;padding:0;background:#f0ebe2;font-family:'Georgia',serif">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ebe2;padding:40px 0">
          <tr><td align="center">
            <table width="520" cellpadding="0" cellspacing="0" style="background:#faf8f4;border:1px solid #e2ddd6;border-radius:8px;overflow:hidden">
              <tr><td style="background:#1a1209;padding:28px 40px">
                <span style="font-family:'Georgia',serif;font-size:18px;font-weight:bold;color:#f5f0e8">ACB Atölyesi</span>
                <div style="width:32px;height:2px;background:#8b2500;margin-top:8px"></div>
              </td></tr>
              <tr><td style="padding:40px">
                <h1 style="font-family:'Georgia',serif;font-size:24px;font-weight:bold;color:#1a1209;margin:0 0 8px">
                  Şifreni<br/><em style="color:#8b2500;font-weight:normal">sıfırla.</em>
                </h1>
                <p style="font-size:14px;color:#7a6e5f;line-height:1.7;margin:16px 0 28px">
                  Şifre sıfırlama talebinde bulundun. Aşağıdaki butona tıklayarak yeni şifreni belirleyebilirsin. Bağlantı <strong>1 saat</strong> geçerlidir.
                </p>
                <a href="${link}" style="display:inline-block;padding:12px 28px;background:#8b2500;color:#f5f0e8;text-decoration:none;border-radius:4px;font-size:13px;font-family:sans-serif;letter-spacing:.06em;text-transform:uppercase;font-weight:500">
                  Şifremi Sıfırla
                </a>
                <hr style="border:none;border-top:1px solid #e2ddd6;margin:28px 0 16px"/>
                <p style="font-size:12px;color:#c4bdb2;margin:0">Bu isteği sen yapmadıysan güvenle görmezden gelebilirsin.</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body></html>
    `,
  });
}
