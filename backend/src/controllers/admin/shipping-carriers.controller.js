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
export const updateShippingCarrier = asyncHandler(async (req, res) => {
  const { name, is_active } = req.body;
  await query(
    'UPDATE shipping_carriers SET name = COALESCE(?, name), is_active = COALESCE(?, is_active) WHERE id = ?',
    [name ?? null, is_active === undefined ? null : (is_active ? 1 : 0), req.params.carrier]
  );
  const [carrier] = await query('SELECT * FROM shipping_carriers WHERE id = ?', [req.params.carrier]);
  res.json({ data: carrier });
});
export const destroyShippingCarrier = asyncHandler(async (req, res) => {
  await query('UPDATE shipping_carriers SET is_deleted = 1 WHERE id = ?', [req.params.carrier]);
  const [carrier] = await query('SELECT * FROM shipping_carriers WHERE id = ?', [req.params.carrier]);
  res.json({ data: carrier });
});
