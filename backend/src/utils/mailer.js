import nodemailer from 'nodemailer';
import 'dotenv/config';

// Chỉ tạo transporter (kết nối SMTP thật) nếu có cấu hình SMTP_HOST trong .env;
// nếu không, transporter giữ nguyên null và sendMail() bên dưới sẽ tự fallback.
let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true', // true = dùng TLS ngay từ đầu (thường cổng 465).
    auth: process.env.SMTP_USER // Không phải SMTP nào cũng cần đăng nhập (vd MailHog local).
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
}

// Nếu chưa cấu hình SMTP_HOST trong .env, fallback log ra console (dev-friendly),
// dùng pattern giống Redis/Elasticsearch: không lỗi cứng, chỉ tự động hạ cấp tính năng.
export async function sendMail({ to, subject, html }) {
  if (!transporter) {
    console.log(`[mailer] SMTP chưa cấu hình, in nội dung email ra console thay vì gửi thật.`);
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
