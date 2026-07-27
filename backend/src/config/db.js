import mysql from 'mysql2/promise';
import 'dotenv/config';

// Dùng lại NGUYÊN schema MySQL của repo Laravel (database/ecommerce_schema_mysql.sql).
// Không đổi tên bảng/cột để tương thích dữ liệu đã có.
// Connection POOL (không phải 1 connection đơn) — cho phép nhiều request xử lý đồng thời
// mà không phải chờ nhau giành 1 kết nối duy nhất tới MySQL.
export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ecommerce_db',
  waitForConnections: true, // Hết connection rảnh thì xếp hàng chờ, thay vì báo lỗi ngay.
  connectionLimit: 10, // Tối đa 10 connection mở cùng lúc trong pool.
  dateStrings: true, // Trả cột DATE/DATETIME dạng chuỗi "YYYY-MM-DD..." thay vì object Date của JS.
  charset: 'utf8mb4', // Tiếng Việt có dấu: đảm bảo đọc/ghi đúng utf8mb4.
});

// Hàm helper dùng CHUNG cho toàn bộ backend thay vì gọi pool.query() trực tiếp:
// mysql2 trả về mảng [rows, fields] — hàm này chỉ lấy phần rows vì fields hiếm khi cần.
export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}
