// Chay DUY NHAT 1 LAN truoc toan bo file test (Vitest globalSetup), KHONG chia se scope
// voi cac file test (khong import duoc bien/module tu day sang do) - chi dung de chuan bi
// moi truong: nap lai schema.sql SACH vao ecommerce_test truoc khi bat dau chay.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, '../..');

export async function setup() {
  dotenv.config({ path: path.join(backendRoot, '.env.test'), override: true });

  const dbName = process.env.DB_NAME;
  // Chan tuyet doi: neu vi ly do gi do .env.test khong nap duoc (vd bi xoa nham) va
  // DB_NAME roi lai ve 'ecommerce_db' (gia tri mac dinh trong config/db.js), buoc DROP
  // DATABASE ben duoi se XOA SACH DU LIEU DEMO THAT. Ten CSDL test phai luon co hau to
  // "_test" - day la dieu kien tien quyet, khong phai goi y.
  if (!dbName || !dbName.endsWith('_test')) {
    throw new Error(
      `An toan: tu choi chay test vi DB_NAME="${dbName}" khong ket thuc bang "_test". ` +
        'Kiem tra file backend/.env.test co ton tai va DB_NAME=ecommerce_test hay khong.'
    );
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\`;`);
  await connection.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4;`);
  await connection.query(`USE \`${dbName}\`;`);

  const schemaSql = readFileSync(path.join(backendRoot, 'sql', 'schema.sql'), 'utf8');
  await connection.query(schemaSql);

  await connection.end();
}
