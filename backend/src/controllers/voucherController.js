import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// UC 2.2.9a Ap dung Voucher khi thanh toan + 2.2.14a Admin quan ly Voucher.

// Tinh so tien giam cho mot voucher hop le. Nem loi { status: 422 } neu khong hop le.
export function computeVoucherDiscount(voucher, subtotal) {
  const now = new Date();
  if (!voucher || !voucher.is_active) throw Object.assign(new Error('Ma giam gia khong ton tai hoac da tat.'), { status: 422 });
  if (voucher.starts_at && new Date(voucher.starts_at) > now) throw Object.assign(new Error('Ma giam gia chua co hieu luc.'), { status: 422 });
  if (voucher.expires_at && new Date(voucher.expires_at) < now) throw Object.assign(new Error('Ma giam gia da het han.'), { status: 422 });
  if (voucher.usage_limit != null && voucher.used_count >= voucher.usage_limit) {
    throw Object.assign(new Error('Ma giam gia da het luot su dung.'), { status: 422 });
  }
  if (subtotal < Number(voucher.min_order_amount)) {
    throw Object.assign(new Error(`Don hang toi thieu ${Number(voucher.min_order_amount).toLocaleString('vi-VN')}d de dung ma nay.`), { status: 422 });
  }
  let discount = voucher.discount_type === 'PERCENT'
    ? Math.round(subtotal * Number(voucher.discount_value) / 100)
    : Number(voucher.discount_value);
  if (voucher.max_discount_amount != null) discount = Math.min(discount, Number(voucher.max_discount_amount));
  return Math.min(discount, subtotal);
}

// POST /api/vouchers/apply { code, subtotal } (auth) — kiem tra + tra so tien giam.
export const apply = asyncHandler(async (req, res) => {
  const { code, subtotal = 0 } = req.body;
  if (!code) return res.status(422).json({ message: 'Vui long nhap ma giam gia.' });
  const [voucher] = await query('SELECT * FROM vouchers WHERE code = ? LIMIT 1', [code]);
  if (!voucher) return res.status(422).json({ message: 'Ma giam gia khong ton tai.' });
  const discount = computeVoucherDiscount(voucher, Number(subtotal));
  res.json({
    data: {
      code: voucher.code, voucher_id: voucher.id, discount_amount: discount,
      discount_type: voucher.discount_type, discount_value: Number(voucher.discount_value),
      description: voucher.description,
    },
  });
});

// --- Admin CRUD (UC 2.2.14a) ---
function serializeVoucher(v) {
  return {
    id: v.id, code: v.code, description: v.description,
    discount_type: v.discount_type, discount_value: Number(v.discount_value),
    min_order_amount: Number(v.min_order_amount), max_discount_amount: v.max_discount_amount != null ? Number(v.max_discount_amount) : null,
    usage_limit: v.usage_limit, used_count: v.used_count,
    starts_at: v.starts_at, expires_at: v.expires_at, is_active: !!v.is_active, created_at: v.created_at,
  };
}
export const adminList = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM vouchers ORDER BY id DESC');
  res.json({ data: rows.map(serializeVoucher) });
});
export const adminStore = asyncHandler(async (req, res) => {
  const { code, description, discount_type = 'PERCENT', discount_value, min_order_amount = 0,
    max_discount_amount, usage_limit, starts_at, expires_at, is_active = true } = req.body;
  if (!code || !discount_value) return res.status(422).json({ message: 'Ma va gia tri giam la bat buoc.' });
  const [existing] = await query('SELECT id FROM vouchers WHERE code = ?', [code]);
  if (existing) return res.status(422).json({ message: 'Ma giam gia da ton tai.' });
  const result = await query(
    `INSERT INTO vouchers (code, description, discount_type, discount_value, min_order_amount,
       max_discount_amount, usage_limit, starts_at, expires_at, is_active, created_by_admin_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [code, description || null, discount_type, discount_value, min_order_amount,
      max_discount_amount || null, usage_limit || null, starts_at || null, expires_at || null,
      is_active ? 1 : 0, req.user.id]
  );
  const [row] = await query('SELECT * FROM vouchers WHERE id = ?', [result.insertId]);
  res.status(201).json({ data: serializeVoucher(row) });
});
export const adminUpdate = asyncHandler(async (req, res) => {
  const fields = ['description', 'discount_type', 'discount_value', 'min_order_amount',
    'max_discount_amount', 'usage_limit', 'starts_at', 'expires_at'];
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
  }
  if (req.body.is_active !== undefined) { updates.push('is_active = ?'); params.push(req.body.is_active ? 1 : 0); }
  if (updates.length) {
    params.push(req.params.voucher);
    await query(`UPDATE vouchers SET ${updates.join(', ')} WHERE id = ?`, params);
  }
  const [row] = await query('SELECT * FROM vouchers WHERE id = ?', [req.params.voucher]);
  res.json({ data: row ? serializeVoucher(row) : null });
});
export const adminDestroy = asyncHandler(async (req, res) => {
  await query('UPDATE vouchers SET is_active = 0 WHERE id = ?', [req.params.voucher]);
  const [row] = await query('SELECT * FROM vouchers WHERE id = ?', [req.params.voucher]);
  res.json({ data: row ? serializeVoucher(row) : null });
});
