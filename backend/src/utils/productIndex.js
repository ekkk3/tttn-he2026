import { esClient, PRODUCTS_INDEX } from '../config/elasticsearch.js';
import { query } from '../config/db.js';

// ==================================================================
// Elasticsearch: dong bo bang `products` (MySQL) sang index de fuzzy search.
// Toan bo ham deu no-op khi esClient === null (chua cau hinh ELASTICSEARCH_NODE)
// -> he thong van chay binh thuong voi MySQL LIKE (xem productController.index).
// ==================================================================

// Cau hinh analyzer bo dau tieng Viet (asciifolding) + lowercase de tim kiem
// khong dau va chiu duoc loi go dau van khop ("banh dau xanh" ~ "bánh đậu xanh").
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

// Tao index neu chua ton tai (idempotent). Tra ve false neu chua cau hinh ES.
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

// Cot du lieu de dua vao document ES: JOIN them ten vung/danh muc/NCC de tim kiem rong hon.
const PRODUCT_DOC_SQL = `
  SELECT p.id, p.name, p.sku, p.origin, p.short_description, p.description, p.sale_price,
         p.is_active, p.is_deleted,
         r.name AS region_name, c.name AS category_name, s.name AS supplier_name
  FROM products p
  LEFT JOIN regions r ON r.id = p.region_id
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN suppliers s ON s.id = p.supplier_id
`;

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

// Them moi / cap nhat 1 san pham trong index. Goi sau moi thao tac CRUD san pham
// (admin.controller + supplierController). Loi ES khong lam hong request goc.
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
      refresh: 'wait_for', // ket qua tim kiem thay ngay sau khi tao/sua.
    });
  } catch (err) {
    console.error('[elasticsearch] indexProduct that bai:', err.message);
  }
}

// Xoa han 1 san pham khoi index (khi hard-delete). CRUD hien tai dung soft-delete nen
// thuong chi can indexProduct lai (search da loc is_active/is_deleted).
export async function removeProductFromIndex(productId) {
  if (!esClient) return;
  try {
    await esClient.delete({ index: PRODUCTS_INDEX, id: String(productId), refresh: 'wait_for' });
  } catch (err) {
    if (err.meta?.statusCode !== 404) {
      console.error('[elasticsearch] removeProductFromIndex that bai:', err.message);
    }
  }
}

// Index lai TOAN BO bang products (dung boi script `npm run reindex`).
export async function reindexAllProducts() {
  if (!esClient) {
    console.warn('[elasticsearch] ELASTICSEARCH_NODE chua cau hinh — bo qua reindex.');
    return 0;
  }
  // Tao lai index sach de mapping luon dung (xoa neu da ton tai).
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
    console.error('[elasticsearch] bulk co loi (vi du dau tien):', firstErr);
  }
  return rows.length;
}

// Goi luc khoi dong server: tao index neu thieu, va tu index neu index dang rong
// (tien loi sau khi nap seed.sql). Best-effort, khong lam sap server.
export async function bootstrapProductIndex() {
  if (!esClient) return;
  try {
    await ensureProductsIndex();
    const count = await esClient.count({ index: PRODUCTS_INDEX });
    if ((count.count ?? 0) === 0) {
      const n = await reindexAllProducts();
      console.log(`[elasticsearch] Index rong -> da tu dong index ${n} san pham.`);
    } else {
      console.log(`[elasticsearch] San sang (index dang co ${count.count} san pham).`);
    }
  } catch (err) {
    console.error('[elasticsearch] bootstrap that bai (van chay voi MySQL LIKE):', err.message);
  }
}
