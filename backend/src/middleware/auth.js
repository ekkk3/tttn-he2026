import { verifyToken } from '../utils/jwt.js';

// Tương đương middleware 'auth:sanctum' bên Laravel, nhưng dùng JWT stateless
// thay vì personal_access_tokens (bạn có thể bỏ bảng personal_access_tokens nếu muốn).
export function auth(req, res, next) {
  // Client phải gửi header "Authorization: Bearer <token>" — tách lấy phần token sau "Bearer ".
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: 'Unauthenticated.' });
  }
  try {
    // Giải mã + xác thực chữ ký token; ném lỗi nếu sai/hết hạn (rơi xuống catch bên dưới).
    const payload = verifyToken(token);
    // Gắn thông tin user vào req để MỌI middleware/controller phía sau (chạy sau next())
    // đều đọc được req.user mà không cần truy vấn lại DB ở mỗi bước.
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    // Token sai định dạng, sai chữ ký, hoặc đã hết hạn -> coi như chưa đăng nhập.
    return res.status(401).json({ message: 'Unauthenticated.' });
  }
}
