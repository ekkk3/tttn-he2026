import { query } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { PRODUCT_SELECT, serializeProduct, serializeProducts } from '../../utils/serializers.js';
import { indexProduct } from '../../utils/productIndex.js';

// ---------------- Products (admin CRUD) ----------------
// Frontend (use-admin-catalog-store.js) doc { data } va can quan he long
// (product.category, product.supplier) de hien ten trong bang.
async function loadAdminProduct(id) {
  const [product] = await query(`${PRODUCT_SELECT} WHERE p.id = ?`, [id]);
  return product ? serializeProduct(product) : null;
}
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
  if (!product) return res.status(404).json({ message: 'Khong tim thay san pham.' });
  res.json({ data: product });
});
export const storeProduct = asyncHandler(async (req, res) => {
  const {
    category_id, supplier_id, region_id, sku, name, description, short_description,
    origin, image_url, sale_price, stock_quantity = 0, is_active = true,
  } = req.body;
  let { slug } = req.body;
  if (!name || !category_id) return res.status(422).json({ message: 'Ten va danh muc la bat buoc.' });
  slug = slug || `${slugify(name)}-${Date.now()}`;
  const finalSku = (sku && String(sku).trim()) || `SP${Date.now().toString().slice(-6)}`;
  const result = await query(
    `INSERT INTO products (category_id, supplier_id, region_id, sku, slug, name, description,
       short_description, origin, image_url, sale_price, stock_quantity, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [category_id, supplier_id || null, region_id || null, finalSku, slug, name,
      description || null, short_description || null, origin || null, image_url || null,
      sale_price || 0, stock_quantity, is_active ? 1 : 0]
  );
  await indexProduct(result.insertId); // Dong bo Elasticsearch de fuzzy search cap nhat ngay.
  res.status(201).json({ data: await loadAdminProduct(result.insertId) });
});
export const updateProduct = asyncHandler(async (req, res) => {
  const fields = ['category_id', 'supplier_id', 'region_id', 'sku', 'name', 'description',
    'short_description', 'origin', 'image_url', 'sale_price', 'stock_quantity'];
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
  await query('UPDATE products SET is_active = ? WHERE id = ?', [req.body.is_active ? 1 : 0, req.params.id]);
  await indexProduct(req.params.id);
  res.json({ data: await loadAdminProduct(req.params.id) });
});
export const destroyProduct = asyncHandler(async (req, res) => {
  // "Xoa" = an san pham (is_active=0) de van hien trong danh sach admin voi trang thai Tam dung.
  await query('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
  await indexProduct(req.params.id); // is_active=false -> search se loc ra khoi ket qua.
  res.json({ data: await loadAdminProduct(req.params.id) });
});
