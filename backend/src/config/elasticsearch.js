import { Client } from '@elastic/elasticsearch';
import 'dotenv/config';

// Neu khong cau hinh ELASTICSEARCH_NODE, esClient = null va productController
// se tu fallback sang MySQL LIKE search (van chay duoc, chi khong co fuzzy search).
export const esClient = process.env.ELASTICSEARCH_NODE
  ? new Client({ node: process.env.ELASTICSEARCH_NODE })
  : null;

export const PRODUCTS_INDEX = process.env.ELASTICSEARCH_PRODUCTS_INDEX || 'products';

// TODO: viet mot script index toan bo bang `products` vao Elasticsearch khi khoi tao,
// va goi esClient.index(...) moi khi admin tao/sua san pham (xem controllers/admin/admin.controller.js).
