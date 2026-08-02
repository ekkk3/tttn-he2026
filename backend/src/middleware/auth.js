import { verifyToken } from '../utils/jwt.js';
import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Tương đương middleware 'auth:sanctum' bên Laravel, nhưng dùng JWT stateless
// thay vì personal_access_tokens (bạn có thể bỏ bảng personal_access_tokens nếu muốn).
// Bọc asyncHandler vì hàm này là async (có truy vấn DB bên dưới): Express 4 KHÔNG tự bắt
// Promise bị reject từ middleware async — thiếu wrapper thì lúc DB lỗi request sẽ treo.
export const auth = asyncHandler(async (req, res, next) => {
  // Client phải gửi header "Authorization: Bearer <token>" — tách lấy phần token sau "Bearer ".
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: 'Unauthenticated.' });
  }
  let payload;
  try {
    // Giải mã + xác thực chữ ký token; ném lỗi nếu sai/hết hạn (rơi xuống catch bên dưới).
    payload = verifyToken(token);
  } catch (err) {
    // Token sai định dạng, sai chữ ký, hoặc đã hết hạn -> coi như chưa đăng nhập.
    return res.status(401).json({ message: 'Unauthenticated.' });
  }

  // Đọc lại tài khoản từ CSDL thay vì tin hoàn toàn vào nội dung token.
  // Vì sao cần: JWT là stateless và sống tới JWT_EXPIRES_IN (mặc định 7 ngày), nên nếu chỉ
  // đọc payload thì token đã cấp trước đó vẫn dùng được BÌNH THƯỜNG kể cả sau khi Admin đã
  // khóa tài khoản (UC 2.2.2 luồng phụ A2) hoặc đã hạ vai trò. Trước đây khóa một tài khoản
  // gian lận chỉ chặn được lần ĐĂNG NHẬP TIẾP THEO, còn phiên đang mở vẫn mua hàng/thao tác
  // thoải mái; hạ quyền ADMIN -> CUSTOMER cũng vậy, token cũ vẫn vào được /api/admin/*.
  // Đánh đổi: thêm 1 truy vấn nhẹ (tra theo khóa chính) cho mỗi request đã đăng nhập.
  const [user] = await query(
    'SELECT id, role, is_active FROM users WHERE id = ? AND is_deleted = 0 LIMIT 1',
    [payload.sub]
  );
  if (!user) {
    // Tài khoản đã bị xóa mềm sau khi token được cấp.
    return res.status(401).json({ message: 'Unauthenticated.' });
  }
  if (!user.is_active) {
    // Trả 401 (không phải 403) là có chủ đích: frontend coi 401 là "phiên không còn hợp lệ"
    // và tự đăng xuất (xem isUnauthorizedApiError trong shared/api/backend-client.js), đúng
    // với điều ta muốn ở đây. 403 sẽ chỉ hiện lỗi mà vẫn giữ người dùng ở trạng thái đăng nhập.
    return res.status(401).json({ message: 'Tài khoản đã bị vô hiệu hóa.' });
  }

  // Gắn thông tin user vào req để MỌI middleware/controller phía sau (chạy sau next())
  // đều đọc được req.user mà không cần truy vấn lại DB ở mỗi bước.
  // `role` lấy từ DB chứ không lấy từ token, nên Admin đổi vai trò là có hiệu lực NGAY.
  req.user = { id: user.id, role: user.role };
  next();
});
