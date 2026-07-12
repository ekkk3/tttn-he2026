import nodemailer from 'nodemailer';
import 'dotenv/config';

let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
}

// Neu chua cau hinh SMTP_HOST trong .env, fallback log ra console (dev-friendly),
// dung pattern giong Redis/Elasticsearch: khong loi cung, chi tu dong ha cap tinh nang.
export async function sendMail({ to, subject, html }) {
  if (!transporter) {
    console.log(`[mailer] SMTP chua cau hinh, in noi dung email ra console thay vi gui that.`);
    console.log(`[mailer] To: ${to}\n[mailer] Subject: ${subject}\n[mailer] Body:\n${html}`);
    return { delivered: false };
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'no-reply@dacsanvungmien.local',
    to,
    subject,
    html,
  });
  return { delivered: true };
}
