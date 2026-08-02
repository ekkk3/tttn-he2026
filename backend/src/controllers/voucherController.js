import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// UC 2.2.9a Áp dụng Voucher khi thanh toán + 2.2.14a Admin quản lý Voucher.

// Tính số tiền giảm cho một voucher hợp lệ. Ném lỗi { status: 422 } nếu không hợp lệ.
export function computeVoucherDiscount(voucher, subtotal) {
  const now = new Date();
  if (!voucher || !voucher.is_active) throw Object.assign(new Error('Mã giảm giá không tồn tại hoặc đã tắt.'), { status: 422 });
  if (voucher.starts_at && new Date(voucher.starts_at) > now) throw Object.assign(new Error('Mã giảm giá chưa có hiệu lực.'), { status: 422 });
  if (voucher.expires_at && new Date(voucher.expires_at) < now) throw Object.assign(new Error('Mã giảm giá đã hết hạn.'), { status: 422 });
  if (voucher.usage_limit != null && voucher.used_count >= voucher.usage_limit) {
    throw Object.assign(new Error('Mã giảm giá đã hết lượt sử dụng.'), { status: 422 });
  }
  if (subtotal < Number(voucher.min_order_amount)) {
    throw Object.assign(new Error(`Đơn hàng tối thiểu ${Number(voucher.min_order_amount).toLocaleString('vi-VN')}đ để dùng mã này.`), { status: 422 });
  }
  // Tính số tiền giảm theo loại: PERCENT = % trên subtotal, còn lại (FIXED) = số tiền cố định.
  let discount = voucher.discount_type === 'PERCENT'
    ? Math.round(subtotal * Number(voucher.discount_value) / 100)
    : Number(voucher.discount_value);
  // Giảm % có thể ra số rất lớn với đơn to -> voucher có thể quy định trần giảm tối đa.
  if (voucher.max_discount_amount != null) discount = Math.min(discount, Number(voucher.max_discount_amount));
  // Chốt lại: discount không bao giờ được vượt quá chính subtotal (tránh đơn hàng âm tiền).
  return Math.min(discount, subtotal);
}

// Trả lại lượt sử dụng voucher khi một đơn hàng bị HỦY.
//
// Vì sao cần: checkout tăng vouchers.used_count ngay lúc tạo đơn, nhưng lúc hủy đơn thì
// trước đây chỉ hoàn tồn kho mà bỏ quên con số này. Hậu quả với voucher có usage_limit: mã
// giới hạn 100 lượt mà khách đặt rồi hủy 100 lần là mã "cháy" hoàn toàn dù chưa ai thực sự
// dùng — và với mã giới hạn 1 lượt thì chính khách vừa hủy cũng không đặt lại được nữa.
//
// GIỮ LẠI dòng order_vouchers để không mất dấu vết "đơn này từng áp mã nào, giảm bao nhiêu"
// (cần cho đối soát và cho báo cáo khuyến mãi sau này) — chỉ trả lại lượt đếm.
// `exec` là hàm chạy truy vấn: truyền `query` khi gọi ngoài transaction, hoặc một hàm bọc
// connection.query khi cần chạy TRONG transaction hủy đơn (xem orderController#cancel).
export async function releaseOrderVoucher(orderId, exec = query) {
  const rows = await exec('SELECT voucher_id FROM order_vouchers WHERE order_id = ?', [orderId]);
  for (const row of rows) {
    // GREATEST(...,0): phòng trường hợp dữ liệu cũ có used_count = 0 mà vẫn còn dòng
    // order_vouchers — cột used_count là INT UNSIGNED nên trừ xuống dưới 0 sẽ lỗi tràn số.
    await exec('UPDATE vouchers SET used_count = GREATEST(CAST(used_count AS SIGNED) - 1, 0) WHERE id = ?', [row.voucher_id]);
  }
  return rows.length;
}

// POST /api/vouchers/apply { code, subtotal } (auth) — kiểm tra + trả số tiền giảm.
export const apply = asyncHandler(async (req, res) => {
  const { code, subtotal = 0 } = req.body;
  if (!code) return res.status(422).json({ message: 'Vui lòng nhập mã giảm giá.' });
  const [voucher] = await query('SELECT * FROM vouchers WHERE code = ? LIMIT 1', [code]);
  if (!voucher) return res.status(422).json({ message: 'Mã giảm giá không tồn tại.' });
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

// Kiểm tra tính hợp lệ của voucher THEO GIÁ TRỊ CUỐI CÙNG sẽ lưu vào DB (UC 2.2.20 bước 4:
// "mã không trùng, ngày kết thúc sau ngày bắt đầu, giá trị lớn hơn 0").
// Nhận `v` là bản ghi đã gộp (giá trị cũ + giá trị client vừa gửi) chứ không phải riêng req.body —
// vì adminUpdate là cập nhật MỘT PHẦN: đổi mỗi discount_type từ FIXED sang PERCENT trong khi
// discount_value cũ là 500000 sẽ tạo ra voucher giảm 500000% nếu chỉ soi các field vừa gửi.
// Trả về chuỗi thông báo lỗi đầu tiên tìm được, hoặc null nếu hợp lệ.
function validateVoucher(v) {
  if (!['PERCENT', 'FIXED'].includes(v.discount_type)) {
    return 'Loại giảm giá phải là PERCENT hoặc FIXED.';
  }
  const value = Number(v.discount_value);
  // Voucher giá trị âm sẽ làm TĂNG tổng tiền khách phải trả (total = subtotal + ship - discount),
  // giá trị 0 thì vô nghĩa — chặn cả hai ngay từ khâu tạo.
  if (!Number.isFinite(value) || value <= 0) {
    return 'Giá trị giảm phải lớn hơn 0.';
  }
  // Giảm quá 100% khiến đơn hàng về 0đ (computeVoucherDiscount kẹp trần bằng subtotal).
  if (v.discount_type === 'PERCENT' && value > 100) {
    return 'Giảm theo phần trăm không được vượt quá 100%.';
  }
  const minOrder = Number(v.min_order_amount ?? 0);
  if (!Number.isFinite(minOrder) || minOrder < 0) {
    return 'Giá trị đơn hàng tối thiểu không được âm.';
  }
  // Hai trường tùy chọn: coi null/chuỗi rỗng là "không đặt giới hạn", chỉ kiểm tra khi có giá trị.
  if (v.max_discount_amount != null && v.max_discount_amount !== '' && !(Number(v.max_discount_amount) > 0)) {
    return 'Mức giảm tối đa phải lớn hơn 0.';
  }
  if (v.usage_limit != null && v.usage_limit !== '' && !(Number(v.usage_limit) > 0)) {
    return 'Số lượng phát hành phải lớn hơn 0.';
  }
  if (v.starts_at && v.expires_at && new Date(v.expires_at) <= new Date(v.starts_at)) {
    return 'Ngày kết thúc phải sau ngày bắt đầu.';
  }
  return null;
}

export const adminStore = asyncHandler(async (req, res) => {
  const { code, description, discount_type = 'PERCENT', discount_value, min_order_amount = 0,
    max_discount_amount, usage_limit, starts_at, expires_at, is_active = true } = req.body;
  if (!code || discount_value === undefined || discount_value === null || discount_value === '') {
    return res.status(422).json({ message: 'Mã và giá trị giảm là bắt buộc.' });
  }
  const invalid = validateVoucher({
    discount_type, discount_value, min_order_amount,
    max_discount_amount: max_discount_amount ?? null, usage_limit: usage_limit ?? null,
    starts_at: starts_at || null, expires_at: expires_at || null,
  });
  if (invalid) return res.status(422).json({ message: invalid });
  const [existing] = await query('SELECT id FROM vouchers WHERE code = ?', [code]);
  if (existing) return res.status(422).json({ message: 'Mã giảm giá đã tồn tại.' });
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
// Build UPDATE động (chỉ field client gửi) — cùng kiểu pattern như accountController.updateProfile.
export const adminUpdate = asyncHandler(async (req, res) => {
  const fields = ['description', 'discount_type', 'discount_value', 'min_order_amount',
    'max_discount_amount', 'usage_limit', 'starts_at', 'expires_at'];
  const [current] = await query('SELECT * FROM vouchers WHERE id = ?', [req.params.voucher]);
  if (!current) return res.status(404).json({ message: 'Không tìm thấy mã giảm giá.' });
  // Gộp bản ghi hiện tại với các field client vừa gửi rồi mới kiểm tra — xem ghi chú ở validateVoucher().
  const invalid = validateVoucher({ ...current, ...Object.fromEntries(
    fields.filter((f) => req.body[f] !== undefined).map((f) => [f, req.body[f]])
  ) });
  if (invalid) return res.status(422).json({ message: invalid });
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
