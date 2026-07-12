import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Frontend doc { data: [...] } cho danh sach vung mien.
export const index = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM regions WHERE is_active = 1 ORDER BY name');
  res.json({ data: rows });
});
