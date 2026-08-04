// Giới hạn tần suất gọi API cho các endpoint nhạy cảm (đăng nhập, đăng ký, quên mật khẩu).
//
// Vì sao cần: trước đây gửi bao nhiêu request đăng nhập sai cũng được, không có bất kỳ chốt
// chặn nào. Đã kiểm chứng: 15 lần sai liên tiếp vẫn nhận đủ 15 lần HTTP 401, nghĩa là có thể
// dò mật khẩu bằng từ điển với tốc độ tùy ý. Mục 2.3 "Tính bảo mật" của báo cáo yêu cầu bảo
// vệ phiên đăng nhập, mà chống dò mật khẩu là phần cơ bản nhất.
// Endpoint /password/forgot cũng cần chặn: mỗi lần gọi là 1 bản ghi token + 1 email gửi đi,
// để trống thì thành công cụ spam hòm thư người khác.
//
// Cách làm: đếm theo CỬA SỔ THỜI GIAN CỐ ĐỊNH, lưu trong bộ nhớ tiến trình.
// Đủ dùng cho đề tài này vì hệ thống chạy 1 tiến trình Node duy nhất. Nếu sau này chạy nhiều
// tiến trình / nhiều máy thì phải chuyển bộ đếm sang Redis (dự án đã có sẵn config/redis.js)
// để các tiến trình dùng chung một bộ đếm, nếu không mỗi tiến trình lại cho phép riêng một hạn mức.

// Công tắc tắt/bật toàn bộ giới hạn tần suất qua biến môi trường RATE_LIMIT_ENABLED.
// Mặc định BẬT — chỉ đặt 'false' cho môi trường chạy kiểm thử tự động hoặc khi cần đo tải,
// vì các kịch bản đó gửi hàng trăm request từ CÙNG một IP và sẽ tự khóa chính mình.
// TUYỆT ĐỐI không đặt 'false' trên môi trường thật.
const ENABLED = String(process.env.RATE_LIMIT_ENABLED ?? 'true').toLowerCase() !== 'false';

const buckets = new Map(); // khóa -> { count, resetAt }

// Dọn các bản ghi đã hết hạn. Không có bước này thì Map phình mãi theo số IP từng gọi API
// (rò rỉ bộ nhớ chậm). Quét toàn bộ Map chỉ khi nó vượt ngưỡng để không phải quét ở mọi request.
const CLEANUP_THRESHOLD = 5000;
function cleanup(now) {
  if (buckets.size < CLEANUP_THRESHOLD) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * @param {object}   options
 * @param {number}   options.windowMs        Độ dài cửa sổ đếm (mili-giây).
 * @param {number}   options.max             Số request tối đa cho phép trong 1 cửa sổ.
 * @param {string}   options.message         Thông báo trả về khi vượt hạn mức.
 * @param {string}   options.name            Tên để tách bộ đếm giữa các endpoint khác nhau
 *                                           (nếu không, đăng nhập và đăng ký dùng chung hạn mức).
 * @param {boolean}  options.skipSuccessful  Không tính các request THÀNH CÔNG vào hạn mức.
 */
export function rateLimit({ windowMs, max, message, name = 'default', skipSuccessful = false }) {
  return (req, res, next) => {
    if (!ENABLED) return next();
    const now = Date.now();
    cleanup(now);
    // Đếm theo địa chỉ IP. Lưu ý khi triển khai thật sau proxy/nginx: phải bật
    // app.set('trust proxy', 1) thì req.ip mới là IP thật của khách, nếu không mọi request
    // đều mang IP của proxy và cả hệ thống dùng chung một hạn mức.
    const key = `${name}:${req.ip}`;
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
      // Retry-After là header chuẩn HTTP: nói cho client (và cả trình duyệt/công cụ) biết
      // phải chờ bao lâu, thay vì để họ thử lại liên tục trong vô vọng.
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        message: message || `Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ${retryAfterSeconds} giây.`,
      });
    }
    if (skipSuccessful) {
      // Chỉ tính những lần THẤT BẠI vào hạn mức.
      // Quan trọng với /login: tấn công dò mật khẩu toàn là request thất bại nên mức bảo vệ
      // không đổi, nhưng người dùng thật (và các màn hình chuyển đổi vai trò khi kiểm thử)
      // đăng nhập đúng bao nhiêu lần cũng không bao giờ bị khóa oan.
      // Phải trừ ở sự kiện 'finish' vì lúc này controller còn chưa chạy, chưa biết kết quả.
      res.on('finish', () => {
        if (res.statusCode < 400) bucket.count = Math.max(bucket.count - 1, 0);
      });
    }
    return next();
  };
}

// Đăng nhập: 10 lần SAI / 5 phút / IP. Người dùng thật gõ nhầm vài lần vẫn thoải mái, còn
// dò từ điển thì chậm lại tới mức vô nghĩa.
export const loginRateLimit = rateLimit({
  name: 'login',
  windowMs: 5 * 60 * 1000,
  max: 10,
  skipSuccessful: true,
  message: 'Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút.',
});

// Đăng ký: 20 tài khoản / giờ / IP.
// Không đặt thấp hơn vì rất nhiều người dùng thật đi chung một địa chỉ IP công cộng
// (mạng ký túc xá, văn phòng, quán cà phê đều NAT chung 1 IP ra ngoài) — hạn mức quá chặt
// sẽ chặn nhầm khách thật. 20 vẫn đủ để bot tạo hàng loạt tài khoản rác bị chặn ngay.
export const registerRateLimit = rateLimit({
  name: 'register',
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Bạn đã tạo quá nhiều tài khoản từ thiết bị này. Vui lòng thử lại sau.',
});

// Quên mật khẩu: 5 email / giờ / IP.
export const forgotPasswordRateLimit = rateLimit({
  name: 'forgot-password',
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Bạn đã yêu cầu đặt lại mật khẩu quá nhiều lần. Vui lòng thử lại sau.',
});

// Chỉ dùng cho kiểm thử tự động: xóa toàn bộ bộ đếm giữa các ca test.
export function resetRateLimits() {
  buckets.clear();
}
