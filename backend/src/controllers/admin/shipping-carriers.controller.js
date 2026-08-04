import { query } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

// ---------------- Shipping carriers ----------------
export const listShippingCarriers = asyncHandler(async (req, res) => {
  const onlyActive = req.query.active_only === 'true' || req.query.active_only === '1';
  const rows = await query(
    `SELECT * FROM shipping_carriers WHERE is_deleted = 0 ${onlyActive ? 'AND is_active = 1' : ''} ORDER BY id DESC`
  );
  res.json({ data: rows });
});
export const storeShippingCarrier = asyncHandler(async (req, res) => {
  const { code, name, provider = 'MANUAL' } = req.body;
  const result = await query('INSERT INTO shipping_carriers (code, name, provider) VALUES (?, ?, ?)', [
    code, name, provider,
  ]);
  const [carrier] = await query('SELECT * FROM shipping_carriers WHERE id = ?', [result.insertId]);
  res.status(201).json({ data: carrier });
});
// Cùng lý do với ensureProductExists bên admin/products.controller.js: UPDATE với id không
// tồn tại không phải lỗi SQL, nên nếu không kiểm tra trước thì endpoint trả 200 { data: null }
// và người dùng tưởng thao tác đã thành công.
async function ensureCarrierExists(id, res) {
  const [carrier] = await query('SELECT id FROM shipping_carriers WHERE id = ? AND is_deleted = 0', [id]);
  if (!carrier) {
    res.status(404).json({ message: 'Không tìm thấy đơn vị vận chuyển.' });
    return false;
  }
  return true;
}

export const updateShippingCarrier = asyncHandler(async (req, res) => {
  if (!(await ensureCarrierExists(req.params.carrier, res))) return;
  const { name, is_active } = req.body;
  await query(
    'UPDATE shipping_carriers SET name = COALESCE(?, name), is_active = COALESCE(?, is_active) WHERE id = ?',
    [name ?? null, is_active === undefined ? null : (is_active ? 1 : 0), req.params.carrier]
  );
  const [carrier] = await query('SELECT * FROM shipping_carriers WHERE id = ?', [req.params.carrier]);
  res.json({ data: carrier });
});
export const destroyShippingCarrier = asyncHandler(async (req, res) => {
  if (!(await ensureCarrierExists(req.params.carrier, res))) return;
  await query('UPDATE shipping_carriers SET is_deleted = 1 WHERE id = ?', [req.params.carrier]);
  const [carrier] = await query('SELECT * FROM shipping_carriers WHERE id = ?', [req.params.carrier]);
  res.json({ data: carrier });
});
