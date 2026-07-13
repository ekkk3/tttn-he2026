import 'dotenv/config';
import { reindexAllProducts } from '../utils/productIndex.js';
import { pool } from '../config/db.js';

// Script CLI: `npm run reindex` — index lai toan bo bang products vao Elasticsearch.
// Chay sau khi nap seed.sql hoac khi muon dong bo lai index thu cong.
(async () => {
  try {
    const n = await reindexAllProducts();
    console.log(`[reindex] Da index ${n} san pham vao Elasticsearch.`);
  } catch (err) {
    console.error('[reindex] Loi:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
    process.exit(process.exitCode || 0);
  }
})();
