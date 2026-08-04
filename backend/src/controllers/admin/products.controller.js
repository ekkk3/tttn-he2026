import { query } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { PRODUCT_SELECT, serializeProduct, serializeProducts } from '../../utils/serializers.js';
import { indexProduct } from '../../utils/productIndex.js';
import { validateProductPricing } from '../../utils/validators.js';

// ---------------- Products (admin CRUD) ----------------
// Frontend (use-admin-catalog-store.js) đọc { data } và cần quan hệ lồng
// (product.category, product.supplier) để hiện tên trong bảng.
async function loadAdminProduct(id) {
  const [product] = await query(`${PRODUCT_SELECT} WHERE p.id = ?`, [id]);
  return product ? serializeProduct(product) : null;
}
// Chuyển tên có dấu thành slug URL-safe (cùng cách làm với supplierController.js#slugify):
// tách dấu thanh bằng normalize('NFD') rồi xóa, xử lý riêng "đ", cuối cùng gom ký tự lạ thành "-".
function slugify(input) {
  return String(input).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
export const listProducts = asyncHandler(async (req, res) => {
  const rows = await query(`${PRODUCT_SELECT} WHERE p.is_deleted = 0 ORDER BY p.id DESC`);
  res.json({ data: serializeProducts(rows) });
});
export const showProduct = asyncHandler(async (req, res) => {
  const product = await loadAdminProduct(req.params.id);
  if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm.' });
  res.json({ data: product });
});
export const storeProduct = asyncHandler(async (req, res) => {
  const {
    category_id, supplier_id, region_id, sku, name, description, short_description,
    origin, image_url, sale_price, stock_quantity = 0, is_active = true,
  } = req.body;
  let { slug } = req.body;
  if (!name || !category_id) return res.status(422).json({ message: 'Tên và danh mục là bắt buộc.' });
  // Bắt buộc có giá bán: trước đây `sale_price || 0` cho phép tạo sản phẩm 0đ khi bỏ trống.
  const invalid = validateProductPricing({ sale_price, stock_quantity }, { requireSalePrice: true });
  if (invalid) return res.status(422).json({ message: invalid });
  slug = slug || `${slugify(name)}-${Date.now()}`;
  const finalSku = (sku && String(sku).trim()) || `SP${Date.now().toString().slice(-6)}`;
  const result = await query(
    `INSERT INTO products (category_id, supplier_id, region_id, sku, slug, name, description,
       short_description, origin, image_url, sale_price, stock_quantity, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [category_id, supplier_id || null, region_id || null, finalSku, slug, name,
      description || null, short_description || null, origin || null, image_url || null,
      sale_price, stock_quantity, is_active ? 1 : 0]
  );
  await indexProduct(result.insertId); // Đồng bộ Elasticsearch để fuzzy search cập nhật ngay.
  res.status(201).json({ data: await loadAdminProduct(result.insertId) });
});
// Kiểm tra sản phẩm có tồn tại không TRƯỚC khi sửa/xóa.
// Trước đây các hàm bên dưới chạy thẳng câu UPDATE với id bất kỳ: không khớp dòng nào thì
// MySQL coi là bình thường (affectedRows = 0), rồi câu SELECT sau đó trả về undefined và
// endpoint đáp lại 200 kèm { data: null }. Với người gọi, "sửa thành công nhưng không có dữ
// liệu" và "không tìm thấy bản ghi" trông giống hệt nhau — frontend hiện form trắng, không
// báo lỗi gì. Mọi UC quản trị đều có luồng phụ "không tìm thấy -> hiển thị thông báo".
async function ensureProductExists(id, res) {
  const [product] = await query('SELECT id FROM products WHERE id = ?', [id]);
  if (!product) {
    res.status(404).json({ message: 'Không tìm thấy sản phẩm.' });
    return false;
  }
  return true;
}

export const updateProduct = asyncHandler(async (req, res) => {
  if (!(await ensureProductExists(req.params.id, res))) return;
  const fields = ['category_id', 'supplier_id', 'region_id', 'sku', 'name', 'description',
    'short_description', 'origin', 'image_url', 'sale_price', 'stock_quantity'];
  const invalid = validateProductPricing(req.body);
  if (invalid) return res.status(422).json({ message: invalid });
  const updates = [];
  const params = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
  }
  if (req.body.is_active !== undefined) { updates.push('is_active = ?'); params.push(req.body.is_active ? 1 : 0); }
  if (req.body.is_deleted !== undefined) { updates.push('is_deleted = ?'); params.push(req.body.is_deleted ? 1 : 0); }
  if (updates.length) {
    params.push(req.params.id);
    await query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, params);
  }
  await indexProduct(req.params.id);
  res.json({ data: await loadAdminProduct(req.params.id) });
});
export const updateProductStatus = asyncHandler(async (req, res) => {
  if (!(await ensureProductExists(req.params.id, res))) return;
  await query('UPDATE products SET is_active = ? WHERE id = ?', [req.body.is_active ? 1 : 0, req.params.id]);
  await indexProduct(req.params.id);
  res.json({ data: await loadAdminProduct(req.params.id) });
});
export const destroyProduct = asyncHandler(async (req, res) => {
  if (!(await ensureProductExists(req.params.id, res))) return;
  // "Xóa" = ẩn sản phẩm (is_active=0) để vẫn hiện trong danh sách admin với trạng thái Tạm dừng.
  await query('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
  await indexProduct(req.params.id); // is_active=false -> search sẽ lọc ra khỏi kết quả.
  res.json({ data: await loadAdminProduct(req.params.id) });
});
