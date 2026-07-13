import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { esClient, PRODUCTS_INDEX } from '../config/elasticsearch.js';
import { PRODUCT_SELECT, serializeProduct, serializeProducts, paginated, parsePagination } from '../utils/serializers.js';

// GET /api/products?keyword=&category_id=&region_id=&supplier_id=&max_price=&sort=&page=&per_page=
// Frontend (use-storefront-catalog-store.js) gui "keyword", "category_id" (co the CSV),
// "supplier_id", "max_price", "sort" va doc { data, current_page, last_page, per_page, total }.
// Neu co Elasticsearch va co keyword -> fuzzy search; neu ES loi/khong cau hinh -> fallback MySQL LIKE.
export const index = asyncHandler(async (req, res) => {
  const { keyword, q, category_id, region_id, supplier_id, min_price, max_price, sort } = req.query;
  const searchTerm = keyword || q;
  const { page, perPage, offset } = parsePagination(req.query);

  // Ho tro CSV (frontend gui "category_id=1,2"): tach thanh mang.
  const csv = (value) => String(value).split(',').map((v) => v.trim()).filter(Boolean);

  const where = ['p.is_active = 1', 'p.is_deleted = 0'];
  const params = [];

  // Uu tien Elasticsearch fuzzy search khi co keyword.
  let esProductIds = null;
  if (searchTerm && esClient) {
    try {
      const result = await esClient.search({
        index: PRODUCTS_INDEX,
        size: 200,
        query: {
          bool: {
            // fuzziness AUTO -> chiu duoc loi go/sai chinh ta; multi_match tim tren nhieu
            // truong (ten uu tien cao nhat, roi nguon goc/vung mien/mo ta).
            must: [{
              multi_match: {
                query: searchTerm,
                fields: ['name^3', 'origin^2', 'region_name^2', 'short_description', 'category_name', 'description'],
                fuzziness: 'AUTO',
                type: 'best_fields',
              },
            }],
            filter: [{ term: { is_active: true } }, { term: { is_deleted: false } }],
          },
        },
      });
      esProductIds = result.hits.hits.map((h) => h._source.id);
      if (esProductIds.length === 0) {
        return res.json(paginated([], { page, perPage, total: 0 }));
      }
    } catch (err) {
      console.warn('[elasticsearch] search that bai, fallback ve MySQL LIKE:', err.message);
      esProductIds = null;
    }
  }

  if (esProductIds && esProductIds.length) {
    where.push(`p.id IN (${esProductIds.map(() => '?').join(',')})`);
    params.push(...esProductIds);
  } else if (searchTerm) {
    where.push('(p.name LIKE ? OR p.description LIKE ? OR p.origin LIKE ?)');
    params.push(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
  }

  if (category_id) {
    const ids = csv(category_id);
    where.push(`p.category_id IN (${ids.map(() => '?').join(',')})`);
    params.push(...ids);
  }
  if (supplier_id) {
    const ids = csv(supplier_id);
    where.push(`p.supplier_id IN (${ids.map(() => '?').join(',')})`);
    params.push(...ids);
  }
  if (region_id) { where.push('p.region_id = ?'); params.push(region_id); }
  if (min_price) { where.push('p.sale_price >= ?'); params.push(min_price); }
  if (max_price) { where.push('p.sale_price <= ?'); params.push(max_price); }

  const whereSql = where.join(' AND ');

  // sort: frontend gui 'popular' (mac dinh), 'price-asc', 'price-desc', 'newest'.
  let orderBy = 'p.id DESC';
  if (sort === 'price-asc') orderBy = 'p.sale_price ASC';
  else if (sort === 'price-desc') orderBy = 'p.sale_price DESC';
  else if (sort === 'newest') orderBy = 'p.created_at DESC';

  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM products p WHERE ${whereSql}`, params);
  const rows = await query(
    `${PRODUCT_SELECT} WHERE ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...params, perPage, offset]
  );

  res.json(paginated(serializeProducts(rows), { page, perPage, total }));
});

export const show = asyncHandler(async (req, res) => {
  const [product] = await query(`${PRODUCT_SELECT} WHERE p.id = ? AND p.is_deleted = 0`, [req.params.id]);
  if (!product) return res.status(404).json({ message: 'Khong tim thay san pham.' });
  const images = await query('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order', [product.id]);
  const [{ avg_rating, review_count }] = await query(
    "SELECT COALESCE(AVG(rating),0) AS avg_rating, COUNT(*) AS review_count FROM product_reviews WHERE product_id = ? AND status = 'VISIBLE'",
    [product.id]
  );
  res.json({
    data: {
      ...serializeProduct(product),
      images,
      rating: Number(Number(avg_rating).toFixed(1)),
      review_count,
    },
  });
});
