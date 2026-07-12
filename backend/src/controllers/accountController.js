import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const showProfile = asyncHandler(async (req, res) => {
  const [user] = await query(
    `SELECT id, full_name, email, phone, address, city, favorite_region, avatar_url,
            newsletter, sms_alerts, order_email, security_alerts,
            reward_points, reward_tier, next_tier_points
     FROM users WHERE id = ?`,
    [req.user.id]
  );
  res.json({ user });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const fields = [
    'full_name', 'phone', 'address', 'city', 'favorite_region', 'avatar_url',
    'newsletter', 'sms_alerts', 'order_email', 'security_alerts',
  ];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(req.body[f]);
    }
  }
  if (!updates.length) return res.status(422).json({ message: 'Khong co truong nao de cap nhat.' });
  params.push(req.user.id);
  await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  const [user] = await query('SELECT id, full_name, email, phone, address, city FROM users WHERE id = ?', [req.user.id]);
  res.json({ user });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;
  const [user] = await query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(current_password, user.password_hash))) {
    return res.status(422).json({ message: 'Mat khau hien tai khong dung.' });
  }
  const hash = await bcrypt.hash(new_password, 10);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
  res.json({ message: 'Da doi mat khau.' });
});

export const listAddresses = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC', [req.user.id]);
  res.json({ addresses: rows });
});

export const storeAddress = asyncHandler(async (req, res) => {
  const { label, recipient, phone, line1, city, note, is_default } = req.body;
  const result = await query(
    `INSERT INTO user_addresses (user_id, label, recipient, phone, line1, city, note, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, label, recipient, phone, line1, city, note || null, !!is_default]
  );
  if (is_default) {
    await query('UPDATE user_addresses SET is_default = (id = ?) WHERE user_id = ?', [result.insertId, req.user.id]);
  }
  res.status(201).json({ id: result.insertId });
});

export const updateAddress = asyncHandler(async (req, res) => {
  const fields = ['label', 'recipient', 'phone', 'line1', 'city', 'note'];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(req.body[f]);
    }
  }
  if (!updates.length) return res.status(422).json({ message: 'Khong co truong nao de cap nhat.' });
  params.push(req.params.address, req.user.id);
  await query(`UPDATE user_addresses SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);
  res.json({ message: 'Da cap nhat dia chi.' });
});

export const destroyAddress = asyncHandler(async (req, res) => {
  await query('DELETE FROM user_addresses WHERE id = ? AND user_id = ?', [req.params.address, req.user.id]);
  res.json({ message: 'Da xoa dia chi.' });
});

export const setDefaultAddress = asyncHandler(async (req, res) => {
  await query('UPDATE user_addresses SET is_default = (id = ?) WHERE user_id = ?', [req.params.address, req.user.id]);
  res.json({ message: 'Da dat lam dia chi mac dinh.' });
});

export const redeemReward = asyncHandler(async (req, res) => {
  const { title, points_used } = req.body;
  const [user] = await query('SELECT reward_points FROM users WHERE id = ?', [req.user.id]);
  if (!user || user.reward_points < points_used) {
    return res.status(422).json({ message: 'Khong du diem thuong.' });
  }
  await query('UPDATE users SET reward_points = reward_points - ? WHERE id = ?', [points_used, req.user.id]);
  const result = await query(
    "INSERT INTO reward_redemptions (user_id, title, points_used, status) VALUES (?, ?, ?, 'COMPLETED')",
    [req.user.id, title, points_used]
  );
  res.status(201).json({ id: result.insertId });
});

export const wishlist = asyncHandler(async (req, res) => {
  const rows = await query(
    'SELECT w.id AS wishlist_item_id, p.* FROM wishlist_items w JOIN products p ON p.id = w.product_id WHERE w.user_id = ?',
    [req.user.id]
  );
  res.json({ items: rows });
});

export const storeWishlistItem = asyncHandler(async (req, res) => {
  const { product_id } = req.body;
  await query('INSERT IGNORE INTO wishlist_items (user_id, product_id) VALUES (?, ?)', [req.user.id, product_id]);
  res.status(201).json({ message: 'Da them vao wishlist.' });
});

export const destroyWishlistItem = asyncHandler(async (req, res) => {
  await query('DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?', [req.user.id, req.params.product]);
  res.json({ message: 'Da xoa khoi wishlist.' });
});
