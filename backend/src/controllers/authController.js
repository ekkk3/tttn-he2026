import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../config/db.js';
import { signToken, tokenExpiresAtIso } from '../utils/jwt.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendMail } from '../utils/mailer.js';
import { verifyGoogleIdToken, verifyFacebookAccessToken } from '../utils/oauth.js';

// Frontend (use-auth-store.js) doc "access_token" + "expires_at", khong phai "token".
// Giu ca "token" de tuong thich nguoc voi cong cu/test khac co the dang doc truong nay.
function authPayload(token, user) {
  return { token, access_token: token, expires_at: tokenExpiresAtIso(token), user };
}

export const register = asyncHandler(async (req, res) => {
  const { full_name, email, phone, password } = req.body;
  if (!full_name || !email || !phone || !password) {
    return res.status(422).json({ message: 'full_name, email, phone, password la bat buoc.' });
  }
  const existing = await query('SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1', [email, phone]);
  if (existing.length) {
    return res.status(422).json({ message: 'Email hoac so dien thoai da duoc dang ky.' });
  }
  const password_hash = await bcrypt.hash(password, 10);
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

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const [user] = await query('SELECT * FROM users WHERE email = ? AND is_deleted = 0 LIMIT 1', [email]);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ message: 'Sai email hoac mat khau.' });
  }
  if (!user.is_active) {
    return res.status(403).json({ message: 'Tai khoan da bi vo hieu hoa.' });
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
  if (!user) return res.status(404).json({ message: 'Khong tim thay nguoi dung.' });
  res.json({ user });
});

export const logout = asyncHandler(async (req, res) => {
  // JWT stateless: khong co gi de huy tren server.
  // TODO: neu can thu hoi token ngay lap tuc, luu blacklist theo jti trong Redis kem TTL = thoi gian con lai cua token.
  res.json({ message: 'Da dang xuat.' });
});

// ---------------- Quen mat khau (bo sung Tuan 1, ngoai pham vi UC goc) ----------------

// POST /api/password/forgot { email }
// Luon tra ve thong bao chung chung (khong tiet lo email co ton tai hay khong).
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(422).json({ message: 'email la bat buoc.' });

  const [user] = await query('SELECT id FROM users WHERE email = ? AND is_deleted = 0 LIMIT 1', [email]);
  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 gio
    await query('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [
      user.id, tokenHash, expiresAt,
    ]);
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?email=${encodeURIComponent(email)}&token=${rawToken}`;
    await sendMail({
      to: email,
      subject: 'Dat lai mat khau',
      html: `<p>Nhan vao lien ket sau de dat lai mat khau (het han sau 1 gio):</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });
  }
  res.json({ message: 'Neu email ton tai trong he thong, huong dan dat lai mat khau da duoc gui.' });
});

// POST /api/password/reset { email, token, password }
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, token, password } = req.body;
  if (!email || !token || !password) {
    return res.status(422).json({ message: 'email, token, password la bat buoc.' });
  }
  const [user] = await query('SELECT id FROM users WHERE email = ? AND is_deleted = 0 LIMIT 1', [email]);
  if (!user) return res.status(422).json({ message: 'Token khong hop le hoac da het han.' });

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const [record] = await query(
    `SELECT * FROM password_reset_tokens
     WHERE user_id = ? AND token_hash = ? AND used_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [user.id, tokenHash]
  );
  if (!record) return res.status(422).json({ message: 'Token khong hop le hoac da het han.' });

  const password_hash = await bcrypt.hash(password, 10);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, user.id]);
  await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?', [record.id]);
  res.json({ message: 'Da dat lai mat khau thanh cong.' });
});

// ---------------- Dang nhap Google / Facebook (bo sung Tuan 1) ----------------

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

// POST /api/auth/google { id_token }
export const loginWithGoogle = asyncHandler(async (req, res) => {
  const { id_token } = req.body;
  if (!id_token) return res.status(422).json({ message: 'id_token la bat buoc.' });
  const profile = await verifyGoogleIdToken(id_token);
  const user = await findOrCreateOAuthUser({ provider: 'google', ...profile });
  if (!user.is_active) return res.status(403).json({ message: 'Tai khoan da bi vo hieu hoa.' });
  const token = signToken({ sub: user.id, role: user.role });
  delete user.password_hash;
  res.json(authPayload(token, user));
});

// POST /api/auth/facebook { access_token }
export const loginWithFacebook = asyncHandler(async (req, res) => {
  const { access_token } = req.body;
  if (!access_token) return res.status(422).json({ message: 'access_token la bat buoc.' });
  const profile = await verifyFacebookAccessToken(access_token);
  const user = await findOrCreateOAuthUser({ provider: 'facebook', ...profile });
  if (!user.is_active) return res.status(403).json({ message: 'Tai khoan da bi vo hieu hoa.' });
  const token = signToken({ sub: user.id, role: user.role });
  delete user.password_hash;
  res.json(authPayload(token, user));
});
