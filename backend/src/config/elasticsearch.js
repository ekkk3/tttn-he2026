import { Client } from '@elastic/elasticsearch';
import 'dotenv/config';

// Nếu không cấu hình ELASTICSEARCH_NODE, esClient = null và productController
// sẽ tự fallback sang MySQL LIKE search (vẫn chạy được, chỉ không có fuzzy search).
export const esClient = process.env.ELASTICSEARCH_NODE
  ? new Client({ node: process.env.ELASTICSEARCH_NODE })
  : null;

export const PRODUCTS_INDEX = process.env.ELASTICSEARCH_PRODUCTS_INDEX || 'products';

// Việc tạo index + đồng bộ dữ liệu nằm trong utils/productIndex.js:
//  - bootstrapProductIndex(): gọi lúc khởi động server (app.js) để tạo index & auto-reindex.
//  - indexProduct()/removeProductFromIndex(): gọi trong CRUD sản phẩm (admin + NCC).
//  - reindexAllProducts(): dùng bởi script `npm run reindex`.
