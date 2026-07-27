import { createClient } from 'redis';
import 'dotenv/config';

let client = null; // Singleton: instance Redis đã kết nối thành công, tái dùng cho mọi lần gọi sau.
let connecting = null; // Promise của lần kết nối đang chạy dở — tránh mở nhiều kết nối cùng lúc
// nếu nhiều request gọi getRedis() gần như đồng thời trước khi kết nối đầu tiên xong.

// Cache-aside cho giỏ hàng (carts). Nếu REDIS_URL không được cấu hình hoặc kết nối
// thất bại, mọi nơi gọi getRedis() sẽ trả về null và code gọi sẽ tự fallback về MySQL.
export async function getRedis() {
  if (!process.env.REDIS_URL) return null; // Chưa cấu hình Redis -> luôn null, gọi code fallback MySQL.
  if (client) return client; // Đã có kết nối sẵn -> trả về luôn, không kết nối lại.
  if (!connecting) {
    // reconnectStrategy:false + connectTimeout ngắn: nếu Redis không chạy, connect()
    // thất bại NGAY thay vì retry vô hạn (tránh treo request path khi máy không có Redis).
    const c = createClient({
      url: process.env.REDIS_URL,
      socket: { reconnectStrategy: false, connectTimeout: 1000 },
    });
    c.on('error', (err) => console.error('[redis] error:', err.message));
    connecting = c
      .connect()
      .then(() => {
        client = c;
        return client;
      })
      .catch((err) => {
        console.error('[redis] connection failed, cart sẽ dùng MySQL trực tiếp:', err.message);
        client = null;
        return null;
      });
  }
  // Trả về Promise (dù đang kết nối dở hay đã xong) để nơi gọi luôn `await getRedis()` được.
  return connecting;
}
