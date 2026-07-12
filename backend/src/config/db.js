import mysql from 'mysql2/promise';
import 'dotenv/config';

// Dung lai NGUYEN schema MySQL cua repo Laravel (database/ecommerce_schema_mysql.sql).
// Khong doi ten bang/cot de tuong thich du lieu da co.
export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ecommerce_db',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
});

export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}
