import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { esClient, PRODUCTS_INDEX } from '../config/elasticsearch.js';

// GET /api/products?q=&category_id=&region_id=&supplier_id=&min_price=&max_price=&page=&limit=
// Neu co Elasticsearch va co tu khoa q -> fuzzy search. Neu ES loi/khong cau hinh -> fallback MySQL LIKE.
export const index = asyncHandler(async (req, res) => {
  const { q, category_id, region_id, supplier_id, min_price, max_price, page = 1, limit = 20 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  if (q && esClient) {
    try {
      const result = await esClient.search({
        index: PRODUCTS_INDEX,
        query: { fuzzy: { name: { value: q, fuzziness: 'AUTO' } } },
        size: Number(limit),
        from: offset,
      });
      const ids = result.hits.hits.map((h) => h._source.id);
      if (!ids.length) return res.json({ products: [], source: 'elasticsearch' });
      const placeholders = ids.map(() => '?').join(',');
      const rows = await query(
        `SELECT * FROM products WHERE id IN (${placeholders}) AND is_active = 1 AND is_deleted = 0`,
        ids
      );
      return res.json({ products: rows, source: 'elasticsearch' });
    } catch (err) {
      console.warn('[elasticsearch] search that bai, fallback ve MySQL LIKE:', err.message);
    }
  }

  const where = ['is_active = 1', 'is_deleted = 0'];
  const params = [];
  if (q) { where.push('(name LIKE ? OR description LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (category_id) { where.push('category_id = ?'); params.push(category_id); }
  if (region_id) { where.push('region_id = ?'); params.push(region_id); }
  if (supplier_id) { where.push('supplier_id = ?'); params.push(supplier_id); }
  if (min_price) { where.push('sale_price >= ?'); params.push(min_price); }
  if (max_price) { where.push('sale_price <= ?'); params.push(max_price); }

  const rows = await query(
    `SELECT * FROM products WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), offset]
  );
  res.json({ products: rows, source: 'mysql' });
});

export const show = asyncHandler(async (req, res) => {
  const [product] = await query('SELECT * FROM products WHERE id = ? AND is_deleted = 0', [req.params.id]);
  if (!product) return res.status(404).json({ message: 'Khong tim thay san pham.' });
  const images = await query('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order', [product.id]);
  res.json({ product: { ...product, images } });
});
