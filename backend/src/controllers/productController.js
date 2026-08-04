import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { esClient, PRODUCTS_INDEX } from '../config/elasticsearch.js';
import { PRODUCT_SELECT, serializeProduct, serializeProducts, paginated, parsePagination } from '../utils/serializers.js';
import { escapeLike } from '../utils/sql.js';

// GET /api/products?keyword=&category_id=&region_id=&supplier_id=&max_price=&sort=&page=&per_page=
// Frontend (use-storefront-catalog-store.js) gửi "keyword", "category_id" (có thể CSV),
// "supplier_id", "max_price", "sort" và đọc { data, current_page, last_page, per_page, total }.
// Nếu có Elasticsearch và có keyword -> fuzzy search; nếu ES lỗi/không cấu hình -> fallback MySQL LIKE.
export const index = asyncHandler(async (req, res) => {
  const { keyword, q, category_id, region_id, supplier_id, min_price, max_price, sort } = req.query;
  const searchTerm = keyword || q;
  const { page, perPage, offset } = parsePagination(req.query);

  // Hỗ trợ CSV (frontend gửi "category_id=1,2"): tách thành mảng.
  const csv = (value) => String(value).split(',').map((v) => v.trim()).filter(Boolean);

  // Build câu WHERE ĐỘNG: mỗi bộ lọc client gửi lên (category, supplier, giá, từ khóa...)
  // thêm 1 điều kiện vào mảng `where` + giá trị tương ứng vào `params` (cùng thứ tự với
  // dấu ? trong `where`); cuối cùng join tất cả bằng AND. Không lọc gì thì chỉ còn 2 điều
  // kiện mặc định (active + chưa xóa).
  const where = ['p.is_active = 1', 'p.is_deleted = 0'];
  const params = [];

  // Ưu tiên Elasticsearch fuzzy search khi có keyword.
  let esProductIds = null;
  if (searchTerm && esClient) {
    try {
      const result = await esClient.search({
        index: PRODUCTS_INDEX,
        size: 200,
        query: {
          bool: {
            // fuzziness AUTO -> chịu được lỗi gõ/sai chính tả; multi_match tìm trên nhiều
            // trường (tên ưu tiên cao nhất, rồi nguồn gốc/vùng miền/mô tả).
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
      console.warn('[elasticsearch] search thất bại, fallback về MySQL LIKE:', err.message);
      esProductIds = null;
    }
  }

  if (esProductIds && esProductIds.length) {
    where.push(`p.id IN (${esProductIds.map(() => '?').join(',')})`);
    params.push(...esProductIds);
  } else if (searchTerm) {
    // escapeLike: trong cú pháp LIKE, '%' khớp mọi chuỗi và '_' khớp mọi ký tự đơn. Tham số
    // hóa (dấu ?) chỉ chống SQL injection chứ KHÔNG vô hiệu hóa 2 ký tự này, nên khách gõ
    // đúng 1 dấu gạch dưới vào ô tìm kiếm là nhận về TOÀN BỘ sản phẩm thay vì "không tìm
    // thấy" — kết quả sai và gây hiểu nhầm. Escape để chúng được hiểu là ký tự thường.
    const term = escapeLike(searchTerm);
    where.push('(p.name LIKE ? OR p.description LIKE ? OR p.origin LIKE ?)');
    params.push(`%${term}%`, `%${term}%`, `%${term}%`);
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
  // Từ đây, whereSql dùng chung cho cả câu COUNT (đếm tổng để tính last_page) lẫn câu
  // SELECT thật (lấy đúng 1 trang) — đảm bảo 2 câu luôn lọc cùng 1 tập dữ liệu.

  // sort: frontend gửi 'popular' (mặc định), 'price-asc', 'price-desc', 'newest'.
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
  if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm.' });
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
