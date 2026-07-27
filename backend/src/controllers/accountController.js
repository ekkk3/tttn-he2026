import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { PRODUCT_SELECT, serializeProducts } from '../utils/serializers.js';

// Frontend (use-account-store.js) đọc { data } với các field: name, avatar,
// reward_snapshot{tier,points,next_tier_points,perks}, addresses[], reward_history[].
async function loadProfilePayload(userId) {
  const [user] = await query(
    `SELECT id, full_name, email, phone, address, city, favorite_region, avatar_url,
            newsletter, sms_alerts, order_email, security_alerts,
            reward_points, reward_tier, next_tier_points, created_at
     FROM users WHERE id = ?`,
    [userId]
  );
  if (!user) return null;
  const addresses = await query(
    'SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC',
    [userId]
  );
  const rewardHistory = await query(
    'SELECT * FROM reward_redemptions WHERE user_id = ? ORDER BY id DESC',
    [userId]
  );
  return {
    id: user.id,
    name: user.full_name,
    email: user.email,
    phone: user.phone,
    address: user.address,
    city: user.city,
    favorite_region: user.favorite_region,
    avatar: user.avatar_url,
    member_since: user.created_at,
    newsletter: !!user.newsletter,
    sms_alerts: !!user.sms_alerts,
    order_email: !!user.order_email,
    security_alerts: !!user.security_alerts,
    reward_snapshot: {
      tier: user.reward_tier || 'Thành viên',
      points: user.reward_points || 0,
      next_tier_points: user.next_tier_points || 0,
      perks: [],
    },
    addresses: addresses.map((a) => ({
      id: a.id, label: a.label, recipient: a.recipient, phone: a.phone, line1: a.line1,
      city: a.city, note: a.note, is_default: !!a.is_default,
    })),
    reward_history: rewardHistory.map((r) => ({
      id: r.id, title: r.title, points_used: r.points_used, created_at: r.created_at, status: r.status,
    })),
  };
}

export const showProfile = asyncHandler(async (req, res) => {
  const profile = await loadProfilePayload(req.user.id);
  if (!profile) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
  res.json({ data: profile });
});

// Cập nhật PARTIAL (giống PATCH): chỉ những field client THỰC SỰ gửi lên (!== undefined)
// mới được đưa vào câu UPDATE — field không gửi thì giữ nguyên giá trị cũ trong DB.
export const updateProfile = asyncHandler(async (req, res) => {
  // Frontend gửi "name"/"avatar" (không phải full_name/avatar_url).
  const map = {
    name: 'full_name', phone: 'phone', address: 'address', city: 'city',
    favorite_region: 'favorite_region', avatar: 'avatar_url',
    newsletter: 'newsletter', sms_alerts: 'sms_alerts', order_email: 'order_email', security_alerts: 'security_alerts',
  };
  const updates = []; // Mảng chuỗi "cot = ?", nối lại thành "SET cot1 = ?, cot2 = ?, ...".
  const params = []; // Giá trị tương ứng, PHẢI cùng thứ tự với updates để khớp dấu ? .
  for (const [key, column] of Object.entries(map)) {
    if (req.body[key] !== undefined) {
      updates.push(`${column} = ?`);
      // Các cột boolean (tinyint) cần ép 1/0 tường minh — JS truthy/falsy không tự
      // chuyển đúng cho driver mysql2 trong mọi trường hợp.
      const value = ['newsletter', 'sms_alerts', 'order_email', 'security_alerts'].includes(key)
        ? (req.body[key] ? 1 : 0)
        : req.body[key];
      params.push(value);
    }
  }
  if (updates.length) {
    params.push(req.user.id); // Tham số cuối cùng khớp với "WHERE id = ?".
    await query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  }
  res.json({ data: await loadProfilePayload(req.user.id) });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;
  const [user] = await query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!user.password_hash || !(await bcrypt.compare(current_password, user.password_hash))) {
    return res.status(422).json({ message: 'Mật khẩu hiện tại không đúng.' });
  }
  const hash = await bcrypt.hash(new_password, 10);
  await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
  res.json({ message: 'Đã đổi mật khẩu.' });
});

export const listAddresses = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC', [req.user.id]);
  res.json({ data: rows });
});

export const storeAddress = asyncHandler(async (req, res) => {
  const { label, recipient, phone, line1, city, note, is_default } = req.body;
  const result = await query(
    `INSERT INTO user_addresses (user_id, label, recipient, phone, line1, city, note, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, label || null, recipient, phone, line1, city || null, note || null, is_default ? 1 : 0]
  );
  // `is_default = (id = ?)` là 1 mẹo SQL: so sánh id = ? trả về 1/0 ngay trong câu UPDATE,
  // nên chỉ ĐÚNG 1 dòng (địa chỉ vừa thêm) có is_default = 1, mọi địa chỉ khác tự động
  // thành 0 — đảm bảo mỗi user luôn có tối đa 1 địa chỉ mặc định mà không cần 2 câu lệnh riêng.
  if (is_default) {
    await query('UPDATE user_addresses SET is_default = (id = ?) WHERE user_id = ?', [result.insertId, req.user.id]);
  }
  res.status(201).json({ data: await loadProfilePayload(req.user.id) });
});

// Cùng kiểu "build UPDATE động" như updateProfile() ở trên, áp dụng cho bảng user_addresses.
export const updateAddress = asyncHandler(async (req, res) => {
  const fields = ['label', 'recipient', 'phone', 'line1', 'city', 'note'];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
  }
  if (updates.length) {
    params.push(req.params.address, req.user.id);
    await query(`UPDATE user_addresses SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`, params);
  }
  res.json({ data: await loadProfilePayload(req.user.id) });
});

export const destroyAddress = asyncHandler(async (req, res) => {
  await query('DELETE FROM user_addresses WHERE id = ? AND user_id = ?', [req.params.address, req.user.id]);
  res.json({ data: await loadProfilePayload(req.user.id) });
});

export const setDefaultAddress = asyncHandler(async (req, res) => {
  await query('UPDATE user_addresses SET is_default = (id = ?) WHERE user_id = ?', [req.params.address, req.user.id]);
  res.json({ data: await loadProfilePayload(req.user.id) });
});

// Đổi điểm thưởng lấy ưu đãi: trừ điểm trong bảng users + ghi lịch sử đổi thưởng.
export const redeemReward = asyncHandler(async (req, res) => {
  const { title, points_cost, points_used } = req.body;
  const cost = Number(points_cost ?? points_used ?? 0);
  const [user] = await query('SELECT reward_points FROM users WHERE id = ?', [req.user.id]);
  // Chặn đổi vượt quá số điểm đang có (kiểm tra ở server, không chỉ tin phía frontend).
  if (!user || user.reward_points < cost) {
    return res.status(422).json({ message: 'Không đủ điểm thưởng.' });
  }
  await query('UPDATE users SET reward_points = reward_points - ? WHERE id = ?', [cost, req.user.id]);
  await query(
    "INSERT INTO reward_redemptions (user_id, title, points_used, status) VALUES (?, ?, ?, 'COMPLETED')",
    [req.user.id, title, cost]
  );
  res.status(201).json({ data: await loadProfilePayload(req.user.id) });
});

// --- Wishlist: frontend đọc { data: { product_ids: [...], products: [...] } } ---
async function loadWishlistPayload(userId) {
  const rows = await query(
    `${PRODUCT_SELECT}
     JOIN wishlist_items w ON w.product_id = p.id
     WHERE w.user_id = ? AND p.is_deleted = 0
     ORDER BY w.id DESC`,
    [userId]
  );
  const products = serializeProducts(rows);
  return { product_ids: products.map((p) => p.id), products };
}

export const wishlist = asyncHandler(async (req, res) => {
  res.json({ data: await loadWishlistPayload(req.user.id) });
});

export const storeWishlistItem = asyncHandler(async (req, res) => {
  const { product_id } = req.body;
  await query('INSERT IGNORE INTO wishlist_items (user_id, product_id) VALUES (?, ?)', [req.user.id, product_id]);
  res.status(201).json({ data: await loadWishlistPayload(req.user.id) });
});

export const destroyWishlistItem = asyncHandler(async (req, res) => {
  await query('DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?', [req.user.id, req.params.product]);
  res.json({ data: await loadWishlistPayload(req.user.id) });
});
