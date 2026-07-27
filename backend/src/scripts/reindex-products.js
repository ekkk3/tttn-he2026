import 'dotenv/config';
import { reindexAllProducts } from '../utils/productIndex.js';
import { pool } from '../config/db.js';

// Script CLI: `npm run reindex` — index lại toàn bộ bảng products vào Elasticsearch.
// Chạy sau khi nạp seed.sql hoặc khi muốn đồng bộ lại index thủ công.
(async () => {
  try {
    const n = await reindexAllProducts();
    console.log(`[reindex] Đã index ${n} sản phẩm vào Elasticsearch.`);
  } catch (err) {
    console.error('[reindex] Lỗi:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
    process.exit(process.exitCode || 0);
  }
})();
