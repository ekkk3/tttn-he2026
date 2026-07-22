import { query } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

// ---------------- Settings ---------------- (frontend adaptSettings doc { data } voi
// nhieu field; bang admin_settings chi co 4 cot nen bo sung default cho phan con lai).
function serializeSettings(s) {
  return {
    store_name: s?.store_name ?? 'Heritage Harvest',
    support_email: s?.support_email ?? '',
    support_phone: s?.support_phone ?? '',
    low_stock_threshold: s?.low_stock_threshold ?? 10,
    dashboard_refresh_seconds: 60,
    order_auto_confirm: false,
    send_daily_summary: true,
    maintenance_mode: false,
    notes: '',
    updated_at: s?.updated_at ?? null,
  };
}
export const showSettings = asyncHandler(async (req, res) => {
  const [settings] = await query('SELECT * FROM admin_settings WHERE user_id = ?', [req.user.id]);
  res.json({ data: serializeSettings(settings) });
});
export const updateSettings = asyncHandler(async (req, res) => {
  const { store_name, support_email, support_phone, low_stock_threshold } = req.body;
  await query(
    `INSERT INTO admin_settings (user_id, store_name, support_email, support_phone, low_stock_threshold)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE store_name = VALUES(store_name), support_email = VALUES(support_email),
       support_phone = VALUES(support_phone), low_stock_threshold = VALUES(low_stock_threshold)`,
    [req.user.id, store_name, support_email, support_phone, low_stock_threshold]
  );
  const [settings] = await query('SELECT * FROM admin_settings WHERE user_id = ?', [req.user.id]);
  res.json({ data: serializeSettings(settings) });
});
