import { Client } from '@elastic/elasticsearch';
import 'dotenv/config';

// Neu khong cau hinh ELASTICSEARCH_NODE, esClient = null va productController
// se tu fallback sang MySQL LIKE search (van chay duoc, chi khong co fuzzy search).
export const esClient = process.env.ELASTICSEARCH_NODE
  ? new Client({ node: process.env.ELASTICSEARCH_NODE })
  : null;

export const PRODUCTS_INDEX = process.env.ELASTICSEARCH_PRODUCTS_INDEX || 'products';

// Viec tao index + dong bo du lieu nam trong utils/productIndex.js:
//  - bootstrapProductIndex(): goi luc khoi dong server (app.js) de tao index & auto-reindex.
//  - indexProduct()/removeProductFromIndex(): goi trong CRUD san pham (admin + NCC).
//  - reindexAllProducts(): dung boi script `npm run reindex`.
