import jwt from 'jsonwebtoken';
import 'dotenv/config';

// JWT_SECRET rỗng/mặc định = token có thể bị giả mạo. Bắt buộc phải đặt trong production;
// ở dev cho phép fallback để tiện khởi động nhanh nhưng cảnh báo rõ.
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET chưa được cấu hình trong .env — bắt buộc khi chạy production.');
  }
  console.warn('[jwt] JWT_SECRET chưa cấu hình, đang dùng secret mặc định CHỈ DÀNH CHO DEV.');
}
const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Ký tạo token mới từ payload (thường là { sub: userId, role }) — token tự chứa hạn dùng
// (claim "exp"), không cần lưu trong DB/session để kiểm tra còn hạn hay không.
export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

// Giải mã + kiểm tra chữ ký bằng SECRET và hạn dùng; jwt.verify tự ném lỗi nếu token
// bị sửa đổi, ký sai secret, hoặc đã hết hạn — middleware auth() bắt lỗi này để trả 401.
export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

// Frontend (use-auth-store.js) mong đợi cả "access_token" + "expires_at" (ISO string)
// từ response đăng nhập/đăng ký, không chỉ "token". Hàm này giải mã lại claim "exp"
// vừa ký để trả về đúng định dạng, tránh phải tự tính toán lại thời hạn.
export function tokenExpiresAtIso(token) {
  const decoded = jwt.decode(token);
  if (!decoded?.exp) return null;
  return new Date(decoded.exp * 1000).toISOString();
}
