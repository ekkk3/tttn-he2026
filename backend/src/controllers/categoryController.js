import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { PRODUCT_SELECT, serializeProducts } from '../utils/serializers.js';

// Frontend đọc { data: [...] } cho danh sách danh mục.
export const index = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM categories WHERE is_active = 1 AND is_deleted = 0 ORDER BY name');
  res.json({ data: rows });
});

export const show = asyncHandler(async (req, res) => {
  const [category] = await query('SELECT * FROM categories WHERE id = ? AND is_deleted = 0', [req.params.category]);
  if (!category) return res.status(404).json({ message: 'Không tìm thấy danh mục.' });
  res.json({ data: category });
});

export const getProducts = asyncHandler(async (req, res) => {
  const rows = await query(
    `${PRODUCT_SELECT} WHERE p.category_id = ? AND p.is_active = 1 AND p.is_deleted = 0 ORDER BY p.id DESC`,
    [req.params.category]
  );
  res.json({ data: serializeProducts(rows) });
});

// --- Admin (protected, mounted dưới /api/admin/categories) ---
export const adminIndex = asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM categories WHERE is_deleted = 0 ORDER BY id DESC');
  res.json({ data: rows });
});

// UC 2.2.17 luồng phụ A2: "Danh mục đã tồn tại".
// Bảng categories KHÔNG có UNIQUE KEY trên `name` nên phải tự kiểm tra ở tầng ứng dụng.
// So sánh chuỗi trong MySQL với collation utf8mb4_unicode_ci vốn đã KHÔNG phân biệt hoa
// thường lẫn dấu thanh, nên "Nông sản khô" và "nong san kho" cũng bị coi là trùng — đúng ý
// đồ, vì mục tiêu là chặn 2 dòng mà người dùng nhìn vào không phân biệt nổi.
// `excludeId` dùng khi ĐỔI TÊN: bỏ qua chính bản ghi đang sửa, nếu không thì lưu lại tên cũ
// cũng bị báo trùng với chính nó.
async function findDuplicateCategoryName(name, excludeId = null) {
  const [row] = await query(
    `SELECT id FROM categories WHERE name = ? AND is_deleted = 0 ${excludeId ? 'AND id <> ?' : ''} LIMIT 1`,
    excludeId ? [String(name).trim(), excludeId] : [String(name).trim()]
  );
  return row || null;
}

export const store = asyncHandler(async (req, res) => {
  const { name, description, is_active = true } = req.body;
  if (!name || !String(name).trim()) return res.status(422).json({ message: 'Tên danh mục là bắt buộc.' });
  if (await findDuplicateCategoryName(name)) {
    return res.status(422).json({ message: 'Danh mục đã tồn tại.' });
  }
  const result = await query('INSERT INTO categories (name, description, is_active) VALUES (?, ?, ?)', [
    String(name).trim(), description || null, is_active ? 1 : 0,
  ]);
  const [category] = await query('SELECT * FROM categories WHERE id = ?', [result.insertId]);
  res.status(201).json({ data: category });
});

// Update kiểu khác với accountController (COALESCE thay vì build câu động): truyền NULL
// cho tham số nào thì COALESCE(?, cot) giữ nguyên giá trị cũ của cột đó, chỉ field nào có
// giá trị thật mới được ghi đè — cùng mục đích "chỉ sửa field client gửi" nhưng gọn hơn khi
// số cột ít và cố định (khác productController nơi phải build WHERE động vì filter tùy ý).
export const update = asyncHandler(async (req, res) => {
  const { name, description, is_active, is_deleted } = req.body;
  // Trả 404 thay vì âm thầm chạy UPDATE không khớp dòng nào rồi trả 200 kèm data rỗng —
  // frontend nhận data undefined sẽ hiện form trắng mà không báo gì (UC "không tìm thấy").
  const [current] = await query('SELECT id FROM categories WHERE id = ?', [req.params.category]);
  if (!current) return res.status(404).json({ message: 'Không tìm thấy danh mục.' });
  // Đổi tên cũng phải chặn trùng, nếu không thì tạo mới bị chặn nhưng sửa tên lại lách được.
  if (name !== undefined && name !== null && String(name).trim() !== '') {
    if (await findDuplicateCategoryName(name, req.params.category)) {
      return res.status(422).json({ message: 'Danh mục đã tồn tại.' });
    }
  }
  await query(
    `UPDATE categories SET name = COALESCE(?, name), description = COALESCE(?, description),
       is_active = COALESCE(?, is_active), is_deleted = COALESCE(?, is_deleted) WHERE id = ?`,
    [name ?? null, description ?? null, is_active === undefined ? null : (is_active ? 1 : 0),
      is_deleted === undefined ? null : (is_deleted ? 1 : 0), req.params.category]
  );
  const [category] = await query('SELECT * FROM categories WHERE id = ?', [req.params.category]);
  res.json({ data: category });
});

export const destroy = asyncHandler(async (req, res) => {
  const [category] = await query('SELECT id FROM categories WHERE id = ?', [req.params.category]);
  if (!category) return res.status(404).json({ message: 'Không tìm thấy danh mục.' });
  // UC 2.2.17 luồng phụ A3: "Danh mục đang chứa sản phẩm đang bán -> không cho phép xóa".
  // Trước đây ngừng sử dụng được danh mục bất kể đang chứa gì, và các sản phẩm bên trong vẫn
  // tiếp tục bày bán ở storefront (productController không lọc theo trạng thái danh mục) —
  // để lại một nhóm sản phẩm "mồ côi": khách vẫn mua được nhưng không lọc ra được theo danh mục.
  const [{ product_count }] = await query(
    'SELECT COUNT(*) AS product_count FROM products WHERE category_id = ? AND is_active = 1 AND is_deleted = 0',
    [req.params.category]
  );
  if (product_count > 0) {
    return res.status(409).json({
      message: `Không thể ngừng sử dụng danh mục này vì đang có ${product_count} sản phẩm đang bán. Vui lòng chuyển danh mục hoặc ngừng bán các sản phẩm đó trước.`,
    });
  }
  await query('UPDATE categories SET is_active = 0 WHERE id = ?', [req.params.category]);
  const [updated] = await query('SELECT * FROM categories WHERE id = ?', [req.params.category]);
  res.json({ data: updated });
});
