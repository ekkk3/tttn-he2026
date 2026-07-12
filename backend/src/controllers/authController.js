import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { signToken } from '../utils/jwt.js';
import { asyncHandler } from '../utils/asyncHandler.js';

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
  res.status(201).json({ token, user });
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
  res.json({ token, user });
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
