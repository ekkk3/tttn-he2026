// Chay truoc MOI file test, va truoc khi file test do import bat ky module nao cua app
// (vd app.js -> config/db.js) - day la cho DUY NHAT dam bao DB_NAME tro toi ecommerce_test
// truoc khi pool ket noi MySQL duoc tao (config/db.js tao pool ngay luc import, khong the
// doi den luc test chay).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '../..');

dotenv.config({ path: path.join(backendRoot, '.env.test'), override: true });

// Lap lai dung 1 dieu kien an toan nhu vitest.global-setup.js: khong bao gio de test chay
// nham vao CSDL that. Rieng cho tung file test vi globalSetup chi chay 1 lan o tien trinh
// khac, khong bao ve duoc neu file test tu y doi bien moi truong.
if (!process.env.DB_NAME || !process.env.DB_NAME.endsWith('_test')) {
  throw new Error(`An toan: DB_NAME="${process.env.DB_NAME}" khong hop le cho moi truong test.`);
}
