import { esClient, PRODUCTS_INDEX } from '../config/elasticsearch.js';
import { query } from '../config/db.js';

// ==================================================================
// Elasticsearch: đồng bộ bảng `products` (MySQL) sang index để fuzzy search.
// Toàn bộ hàm đều no-op khi esClient === null (chưa cấu hình ELASTICSEARCH_NODE)
// -> hệ thống vẫn chạy bình thường với MySQL LIKE (xem productController.index).
// ==================================================================

// Cấu hình analyzer bỏ dấu tiếng Việt (asciifolding) + lowercase để tìm kiếm
// không dấu và chịu được lỗi gõ dấu vẫn khớp ("banh dau xanh" ~ "bánh đậu xanh").
const INDEX_SETTINGS = {
  analysis: {
    analyzer: {
      vi_folded: { type: 'custom', tokenizer: 'standard', filter: ['lowercase', 'asciifolding'] },
    },
  },
};

const INDEX_MAPPINGS = {
  properties: {
    id: { type: 'long' },
    name: { type: 'text', analyzer: 'vi_folded' },
    sku: { type: 'keyword' },
    origin: { type: 'text', analyzer: 'vi_folded' },
    short_description: { type: 'text', analyzer: 'vi_folded' },
    description: { type: 'text', analyzer: 'vi_folded' },
    region_name: { type: 'text', analyzer: 'vi_folded' },
    category_name: { type: 'text', analyzer: 'vi_folded' },
    supplier_name: { type: 'text', analyzer: 'vi_folded' },
    sale_price: { type: 'double' },
    is_active: { type: 'boolean' },
    is_deleted: { type: 'boolean' },
  },
};

// Tạo index nếu chưa tồn tại (idempotent). Trả về false nếu chưa cấu hình ES.
export async function ensureProductsIndex() {
  if (!esClient) return false;
  const exists = await esClient.indices.exists({ index: PRODUCTS_INDEX });
  if (exists) return true;
  await esClient.indices.create({
    index: PRODUCTS_INDEX,
    settings: INDEX_SETTINGS,
    mappings: INDEX_MAPPINGS,
  });
  return true;
}

// Cột dữ liệu để đưa vào document ES: JOIN thêm tên vùng/danh mục/NCC để tìm kiếm rộng hơn.
const PRODUCT_DOC_SQL = `
  SELECT p.id, p.name, p.sku, p.origin, p.short_description, p.description, p.sale_price,
         p.is_active, p.is_deleted,
         r.name AS region_name, c.name AS category_name, s.name AS supplier_name
  FROM products p
  LEFT JOIN regions r ON r.id = p.region_id
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN suppliers s ON s.id = p.supplier_id
`;

// Chuẩn hóa 1 row MySQL (đã JOIN region/category/supplier) thành đúng shape document
// sẽ lưu vào Elasticsearch — dùng chung cho cả indexProduct() (1 sản phẩm) lẫn
// reindexAllProducts() (toàn bộ, qua bulk API).
function toDoc(row) {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    origin: row.origin,
    short_description: row.short_description,
    description: row.description,
    region_name: row.region_name,
    category_name: row.category_name,
    supplier_name: row.supplier_name,
    sale_price: row.sale_price != null ? Number(row.sale_price) : 0,
    is_active: !!row.is_active,
    is_deleted: !!row.is_deleted,
  };
}

// Thêm mới / cập nhật 1 sản phẩm trong index. Gọi sau mỗi thao tác CRUD sản phẩm
// (admin.controller + supplierController). Lỗi ES không làm hỏng request gốc.
export async function indexProduct(productId) {
  if (!esClient) return;
  try {
    await ensureProductsIndex();
    const [row] = await query(`${PRODUCT_DOC_SQL} WHERE p.id = ?`, [productId]);
    if (!row) return;
    await esClient.index({
      index: PRODUCTS_INDEX,
      id: String(row.id),
      document: toDoc(row),
      refresh: 'wait_for', // kết quả tìm kiếm thấy ngay sau khi tạo/sửa.
    });
  } catch (err) {
    console.error('[elasticsearch] indexProduct thất bại:', err.message);
  }
}

// Xóa hẳn 1 sản phẩm khỏi index (khi hard-delete). CRUD hiện tại dùng soft-delete nên
// thường chỉ cần indexProduct lại (search đã lọc is_active/is_deleted).
export async function removeProductFromIndex(productId) {
  if (!esClient) return;
  try {
    await esClient.delete({ index: PRODUCTS_INDEX, id: String(productId), refresh: 'wait_for' });
  } catch (err) {
    if (err.meta?.statusCode !== 404) {
      console.error('[elasticsearch] removeProductFromIndex thất bại:', err.message);
    }
  }
}

// Index lại TOÀN BỘ bảng products (dùng bởi script `npm run reindex`).
export async function reindexAllProducts() {
  if (!esClient) {
    console.warn('[elasticsearch] ELASTICSEARCH_NODE chưa cấu hình — bỏ qua reindex.');
    return 0;
  }
  // Tạo lại index sạch để mapping luôn đúng (xóa nếu đã tồn tại).
  const exists = await esClient.indices.exists({ index: PRODUCTS_INDEX });
  if (exists) await esClient.indices.delete({ index: PRODUCTS_INDEX });
  await ensureProductsIndex();

  const rows = await query(PRODUCT_DOC_SQL);
  if (!rows.length) return 0;

  const operations = rows.flatMap((row) => [
    { index: { _index: PRODUCTS_INDEX, _id: String(row.id) } },
    toDoc(row),
  ]);
  const bulk = await esClient.bulk({ operations, refresh: true });
  if (bulk.errors) {
    const firstErr = bulk.items.find((i) => i.index?.error)?.index?.error;
    console.error('[elasticsearch] bulk có lỗi (ví dụ đầu tiên):', firstErr);
  }
  return rows.length;
}

// Gọi lúc khởi động server: tạo index nếu thiếu, và tự index nếu index đang rỗng
// (tiện lợi sau khi nạp seed.sql). Best-effort, không làm sập server.
export async function bootstrapProductIndex() {
  if (!esClient) return;
  try {
    await ensureProductsIndex();
    const count = await esClient.count({ index: PRODUCTS_INDEX });
    if ((count.count ?? 0) === 0) {
      const n = await reindexAllProducts();
      console.log(`[elasticsearch] Index rỗng -> đã tự động index ${n} sản phẩm.`);
    } else {
      console.log(`[elasticsearch] Sẵn sàng (index đang có ${count.count} sản phẩm).`);
    }
  } catch (err) {
    console.error('[elasticsearch] bootstrap thất bại (vẫn chạy với MySQL LIKE):', err.message);
  }
}
