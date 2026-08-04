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

// Bật STRICT_TRANS_TABLES cho MỌI kết nối trong pool.
//
// Vì sao cần: MariaDB đi kèm XAMPP mặc định KHÔNG bật strict mode. Ở chế độ lỏng, dữ liệu
// sai kiểu/quá dài không báo lỗi mà bị ÂM THẦM ép về giá trị gần đúng:
//   - chuỗi dài hơn VARCHAR(n) bị cắt cụt (tên sản phẩm 500 ký tự -> lưu 200, mất phần đuôi);
//   - giá trị ENUM lạ thành chuỗi rỗng (tài khoản có role = '' không thuộc vai trò nào);
//   - "abc" gán vào cột INT thành 0 (ngưỡng cảnh báo tồn kho thành 0 -> tắt luôn cảnh báo).
// Người dùng thấy "lưu thành công" trong khi dữ liệu đã bị biến dạng — kiểu hỏng khó phát
// hiện nhất vì không có lỗi nào được ghi lại ở đâu cả.
//
// Bật strict mode biến các trường hợp đó thành lỗi thật, và middleware/errorHandler.js đã có
// sẵn nhánh dịch ER_DATA_TOO_LONG / ER_TRUNCATED_WRONG_VALUE sang thông báo 422 tiếng Việt.
// Đặt ở tầng kết nối thay vì sửa cấu hình my.ini để dự án chạy đúng trên MỌI máy, không phụ
// thuộc việc người cài đặt có chỉnh MariaDB hay không.
pool.on('connection', (connection) => {
  connection.query("SET SESSION sql_mode = CONCAT(@@sql_mode, ',STRICT_TRANS_TABLES')");
});

// Hàm helper dùng CHUNG cho toàn bộ backend thay vì gọi pool.query() trực tiếp:
// mysql2 trả về mảng [rows, fields] — hàm này chỉ lấy phần rows vì fields hiếm khi cần.
export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}
