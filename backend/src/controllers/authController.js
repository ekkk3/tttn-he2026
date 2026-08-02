import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../config/db.js';
import { signToken, tokenExpiresAtIso } from '../utils/jwt.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendMail } from '../utils/mailer.js';
import { verifyGoogleIdToken, verifyFacebookAccessToken } from '../utils/oauth.js';
import { validatePhone } from '../utils/validators.js';

// Frontend (use-auth-store.js) đọc "access_token" + "expires_at", không phải "token".
// Giữ cả "token" để tương thích ngược với công cụ/test khác có thể đang đọc trường này.
function authPayload(token, user) {
  return { token, access_token: token, expires_at: tokenExpiresAtIso(token), user };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Luồng đăng ký: validate input -> chặn trùng email/phone -> hash mật khẩu (bcrypt, không
// bao giờ lưu plaintext) -> tạo user role CUSTOMER -> ký token đăng nhập luôn (khỏi phải
// đăng ký xong rồi bắt đăng nhập lại lần nữa).
export const register = asyncHandler(async (req, res) => {
  const { full_name, email, phone, password } = req.body;
  if (!full_name || !email || !phone || !password) {
    return res.status(422).json({ message: 'full_name, email, phone, password là bắt buộc.' });
  }
  if (!EMAIL_REGEX.test(email)) {
    return res.status(422).json({ message: 'Email không hợp lệ.' });
  }
  // Trước đây chỉ kiểm tra "có nhập hay không", nên đăng ký được với phone = "abcxyz".
  const invalidPhone = validatePhone(phone);
  if (invalidPhone) return res.status(422).json({ message: invalidPhone });
  if (String(password).length < 8) {
    return res.status(422).json({ message: 'Mật khẩu phải có ít nhất 8 ký tự.' });
  }
  const existing = await query('SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1', [email, phone]);
  if (existing.length) {
    return res.status(422).json({ message: 'Email hoặc số điện thoại đã được đăng ký.' });
  }
  const password_hash = await bcrypt.hash(password, 10); // 10 = salt rounds (độ khó băm).
  const result = await query(
    `INSERT INTO users (full_name, email, phone, password_hash, role, is_active)
     VALUES (?, ?, ?, ?, 'CUSTOMER', 1)`,
    [full_name, email, phone, password_hash]
  );
  const userId = result.insertId;
  const token = signToken({ sub: userId, role: 'CUSTOMER' });
  const [user] = await query('SELECT id, full_name, email, phone, role FROM users WHERE id = ?', [userId]);
  res.status(201).json(authPayload(token, user));
});

// Luồng đăng nhập: tìm user theo email -> so khớp mật khẩu bằng bcrypt.compare (so hash,
// không so plaintext) -> chặn tài khoản bị khóa -> ký token mới.
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const [user] = await query('SELECT * FROM users WHERE email = ? AND is_deleted = 0 LIMIT 1', [email]);
  // Tài khoản tạo qua Google/Facebook không có password_hash — tránh gọi bcrypt.compare
  // với hash rỗng (có thể ném lỗi thay vì trả 401 gọn gàng).
  if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ message: 'Sai email hoặc mật khẩu.' });
  }
  if (!user.is_active) {
    return res.status(403).json({ message: 'Tài khoản đã bị vô hiệu hóa.' });
  }
  const token = signToken({ sub: user.id, role: user.role });
  delete user.password_hash;
  res.json(authPayload(token, user));
});

export const me = asyncHandler(async (req, res) => {
  const [user] = await query(
    `SELECT id, full_name, email, phone, address, city, favorite_region, avatar_url,
            role, reward_points, reward_tier
     FROM users WHERE id = ?`,
    [req.user.id]
  );
  if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
  res.json({ user });
});

export const logout = asyncHandler(async (req, res) => {
  // JWT stateless: không có gì để hủy trên server.
  // TODO: nếu cần thu hồi token ngay lập tức, lưu blacklist theo jti trong Redis kèm TTL = thời gian còn lại của token.
  res.json({ message: 'Đã đăng xuất.' });
});

// ---------------- Quên mật khẩu (bổ sung Tuần 1, ngoài phạm vi UC gốc) ----------------

// POST /api/password/forgot { email }
// Luôn trả về thông báo chung chung (không tiết lộ email có tồn tại hay không).
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(422).json({ message: 'email là bắt buộc.' });

  const [user] = await query('SELECT id FROM users WHERE email = ? AND is_deleted = 0 LIMIT 1', [email]);
  if (user) {
    // Sinh token ngẫu nhiên, nhưng chỉ lưu HASH của nó vào DB (giống cách lưu password) —
    // nếu DB bị lộ, kẻ tấn công vẫn không có được token gốc để tự đặt lại mật khẩu người khác.
    // Token gốc (rawToken) chỉ tồn tại trong email gửi đi, không lưu ở đâu khác.
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 giờ
    await query('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [
      user.id, tokenHash, expiresAt,
    ]);
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?email=${encodeURIComponent(email)}&token=${rawToken}`;
    await sendMail({
      to: email,
      subject: 'Đặt lại mật khẩu',
      html: `<p>Nhấn vào liên kết sau để đặt lại mật khẩu (hết hạn sau 1 giờ):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });
  }
  res.json({ message: 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.' });
});

// POST /api/password/reset { email, token, password }
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, token, password } = req.body;
  if (!email || !token || !password) {
    return res.status(422).json({ message: 'email, token, password là bắt buộc.' });
  }
  const [user] = await query('SELECT id FROM users WHERE email = ? AND is_deleted = 0 LIMIT 1', [email]);
  if (!user) return res.status(422).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });

  // Băm lại token client gửi lên bằng CÙNG thuật toán lúc tạo, rồi so khớp với hash đã lưu
  // — không bao giờ so sánh trực tiếp token gốc vì DB không lưu token gốc (xem forgotPassword).
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const [record] = await query(
    `SELECT * FROM password_reset_tokens
     WHERE user_id = ? AND token_hash = ? AND used_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [user.id, tokenHash]
  );
  if (!record) return res.status(422).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });

  const password_hash = await bcrypt.hash(password, 10);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, user.id]);
  await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?', [record.id]);
  res.json({ message: 'Đã đặt lại mật khẩu thành công.' });
});

// ---------------- Đăng nhập Google / Facebook (bổ sung Tuần 1) ----------------

// 3 bước theo thứ tự ưu tiên:
// 1) Đã từng đăng nhập bằng provider này trước đây (tìm theo google_id/facebook_id) -> dùng luôn.
// 2) Chưa từng dùng provider này, nhưng email trùng với 1 tài khoản có sẵn (vd đăng ký bằng
//    email/password trước đó) -> LIÊN KẾT tài khoản đó với provider (ghi thêm google_id/facebook_id).
// 3) Hoàn toàn mới -> tạo user mới, không có password_hash (chỉ đăng nhập được qua OAuth).
async function findOrCreateOAuthUser({ provider, providerId, email, fullName, avatarUrl }) {
  const column = provider === 'google' ? 'google_id' : 'facebook_id';
  const [byProviderId] = await query(`SELECT * FROM users WHERE ${column} = ? LIMIT 1`, [providerId]);
  if (byProviderId) return byProviderId;

  const [byEmail] = await query('SELECT * FROM users WHERE email = ? AND is_deleted = 0 LIMIT 1', [email]);
  if (byEmail) {
    await query(`UPDATE users SET ${column} = ? WHERE id = ?`, [providerId, byEmail.id]);
    return { ...byEmail, [column]: providerId };
  }

  const result = await query(
    `INSERT INTO users (full_name, email, password_hash, role, is_active, avatar_url, ${column})
     VALUES (?, ?, NULL, 'CUSTOMER', 1, ?, ?)`,
    [fullName || email, email, avatarUrl || null, providerId]
  );
  const [created] = await query('SELECT * FROM users WHERE id = ?', [result.insertId]);
  return created;
}

// POST /api/auth/google { id_token } — id_token do Google Identity Services cấp sẵn ở
// frontend; backend chỉ việc xác thực nó (verifyGoogleIdToken) rồi tìm/tạo user + ký JWT riêng.
export const loginWithGoogle = asyncHandler(async (req, res) => {
  const { id_token } = req.body;
  if (!id_token) return res.status(422).json({ message: 'id_token là bắt buộc.' });
  const profile = await verifyGoogleIdToken(id_token);
  const user = await findOrCreateOAuthUser({ provider: 'google', ...profile });
  if (!user.is_active) return res.status(403).json({ message: 'Tài khoản đã bị vô hiệu hóa.' });
  const token = signToken({ sub: user.id, role: user.role });
  delete user.password_hash;
  res.json(authPayload(token, user));
});

// POST /api/auth/facebook { access_token }
export const loginWithFacebook = asyncHandler(async (req, res) => {
  const { access_token } = req.body;
  if (!access_token) return res.status(422).json({ message: 'access_token là bắt buộc.' });
  const profile = await verifyFacebookAccessToken(access_token);
  const user = await findOrCreateOAuthUser({ provider: 'facebook', ...profile });
  if (!user.is_active) return res.status(403).json({ message: 'Tài khoản đã bị vô hiệu hóa.' });
  const token = signToken({ sub: user.id, role: user.role });
  delete user.password_hash;
  res.json(authPayload(token, user));
});
