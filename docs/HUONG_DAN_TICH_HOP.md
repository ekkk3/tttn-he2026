# Hướng dẫn cấu hình tích hợp bên ngoài

Tài liệu này hướng dẫn **từng bước** để bật các tích hợp cần credential/khoá của bên thứ ba.
Toàn bộ hệ thống đã được thiết kế **tự hạ cấp an toàn**: khi chưa cấu hình, tính năng vẫn
chạy ở chế độ fallback (không sập). Khi điền đủ biến `.env` (và với 3 mục cần thêm code
frontend/callback thì dán các đoạn ở cuối tài liệu), các luồng sẽ hoạt động thật.

> Mọi biến đặt trong `backend/.env` (copy từ `backend/.env.example`). Sau khi sửa `.env`,
> khởi động lại backend (`npm run dev` tự restart).

Bảng tổng quan mức độ sẵn sàng:

| Tích hợp | Chỉ cần điền `.env`? | Ghi chú |
|---|---|---|
| AI Chatbot (Gemini/OpenAI) | ✅ Có | Điền key là chạy thật; không có key thì fallback tìm SP nội bộ |
| Email quên mật khẩu (SMTP) | ✅ Có | Không có SMTP thì in link reset ra console |
| Tìm kiếm Elasticsearch | ✅ Có | Không có thì fallback MySQL LIKE |
| Giỏ hàng Redis | ✅ Có | Không có thì đọc/ghi thẳng MySQL |
| **Đăng nhập Google/Facebook** | ⚠️ Gần đủ | Điền `.env` + dán nút đăng nhập ở frontend (mục 1) |
| **VNPay / MoMo** | ⚠️ Gần đủ | Điền `.env` + thêm tùy chọn thanh toán + route callback (mục 2) |
| **GHN (vận đơn thật)** | ⚠️ Gần đủ | Tra cứu tỉnh/huyện/xã chạy ngay; tạo vận đơn/phí cần hoàn thiện `storeShipment` (mục 3) |

---

## 0. Các mục CHỈ CẦN điền `.env` (chạy ngay)

### 0.1. AI Chatbot — OpenAI hoặc Gemini
```env
AI_PROVIDER=gemini            # hoặc 'openai'
GEMINI_API_KEY=<key>          # lấy tại https://aistudio.google.com/app/apikey
# hoặc
OPENAI_API_KEY=<key>          # lấy tại https://platform.openai.com/api-keys
```
- Điền xong: widget chat (góc phải storefront) gọi API thật. Chưa có key: fallback tìm
  sản phẩm trong DB (đã hoạt động).
- Code liên quan: `backend/src/controllers/chatController.js`.

### 0.2. Email "Quên mật khẩu" — SMTP
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<email>
SMTP_PASSWORD=<app-password>   # Gmail: tạo App Password tại https://myaccount.google.com/apppasswords
SMTP_FROM=no-reply@dacsanvungmien.local
```
- Chưa có SMTP: backend in link reset ra console (vẫn test được luồng). Có SMTP: gửi email thật.
- Code: `backend/src/utils/mailer.js`.

### 0.3. Elasticsearch (tìm kiếm mờ) & Redis (cache giỏ hàng) — tuỳ chọn
```env
ELASTICSEARCH_NODE=http://127.0.0.1:9200
REDIS_URL=redis://127.0.0.1:6379
```
- Bỏ trống hoàn toàn OK (fallback MySQL). Muốn dùng ES fuzzy search cần chạy script
  index sản phẩm sang ES (chưa có sẵn — xem `backend/src/config/elasticsearch.js`).

---

## 1. Đăng nhập Google / Facebook

### 1.1. Lấy credential

**Google:**
1. Vào https://console.cloud.google.com/apis/credentials → *Create Credentials* → *OAuth client ID*.
2. Application type: **Web application**.
3. *Authorized JavaScript origins*: `http://localhost:5173` (và domain thật khi deploy).
4. Copy **Client ID** (dạng `xxxx.apps.googleusercontent.com`).

**Facebook:**
1. Vào https://developers.facebook.com/apps → *Create App* → loại *Consumer*.
2. Thêm sản phẩm **Facebook Login** → Settings → *Valid OAuth Redirect URIs*: `http://localhost:5173`.
3. Copy **App ID** (mục Settings → Basic).

### 1.2. Điền `.env` (backend)
```env
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
FACEBOOK_APP_ID=1234567890
```

### 1.3. Trạng thái code
- **Backend đã sẵn sàng**: `POST /api/auth/google { id_token }` và `POST /api/auth/facebook { access_token }`
  đã verify token thật (google-auth-library / Graph API) → tạo/đăng nhập user → trả JWT.
  Xem `backend/src/controllers/authController.js` (`loginWithGoogle`, `loginWithFacebook`).
- **Frontend cần thêm nút** để lấy `id_token`/`access_token` rồi gọi 2 endpoint trên. Dán đoạn
  dưới đây vào trang đăng nhập.

### 1.4. Đoạn code cần dán — nút "Đăng nhập với Google"

**(a) Thêm action vào auth store** `frontend/src/shared/lib/store/use-auth-store.js`
(đặt cạnh action `login`, dùng lại `applyAuthenticatedBackendSession`):
```js
loginWithGoogle: async (idToken) => {
    set({ isSubmitting: true });
    try {
        const response = await apiRequest("/auth/google", {
            method: "POST",
            body: { id_token: idToken },
        });
        return await applyAuthenticatedBackendSession(response, set);
    } catch (error) {
        set({ isSubmitting: false });
        return { success: false, error: error instanceof Error ? error.message : "Đăng nhập Google thất bại." };
    }
},
```

**(b) Nạp thư viện Google Identity Services** — thêm vào `frontend/index.html` trong `<head>`:
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

**(c) Nút trên trang đăng nhập** `frontend/src/pages/login/ui/login-page.jsx`
(thêm `useEffect` render nút, đặt một `<div id="google-signin">` trong form):
```jsx
useEffect(() => {
    if (!window.google || !import.meta.env.VITE_GOOGLE_CLIENT_ID) return;
    window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: async (resp) => {
            const result = await useAuthStore.getState().loginWithGoogle(resp.credential);
            if (result.success) navigate(routes.accountProfile);
        },
    });
    window.google.accounts.id.renderButton(document.getElementById("google-signin"), { theme: "outline", size: "large" });
}, [navigate]);
```
Và thêm biến `VITE_GOOGLE_CLIENT_ID` vào `frontend/.env` (bằng đúng Client ID ở trên).

> Facebook tương tự: nạp Facebook JS SDK, gọi `FB.login`, lấy `authResponse.accessToken`, rồi
> `useAuthStore.getState().loginWithFacebook(accessToken)` (thêm action tương ứng như 1.4a).

---

## 2. Thanh toán VNPay / MoMo

### 2.1. Lấy credential (sandbox)

**VNPay:** đăng ký merchant test tại https://sandbox.vnpayment.vn → nhận **TmnCode** và **HashSecret**.

**MoMo:** đăng ký tại https://business.momo.vn (hoặc dùng bộ test công khai của MoMo) → nhận
**PartnerCode**, **AccessKey**, **SecretKey**.

### 2.2. Điền `.env` (backend)
```env
# VNPay
VNPAY_TMN_CODE=<TmnCode>
VNPAY_HASH_SECRET=<HashSecret>
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:5173/checkout/vnpay-return

# MoMo
MOMO_PARTNER_CODE=<PartnerCode>
MOMO_ACCESS_KEY=<AccessKey>
MOMO_SECRET_KEY=<SecretKey>
MOMO_ENDPOINT=https://test-payment.momo.vn/v2/gateway/api/create
MOMO_RETURN_URL=http://localhost:5173/checkout/momo-return
MOMO_NOTIFY_URL=http://127.0.0.1:8000/api/payments/momo/ipn
```

### 2.3. Trạng thái code
- **Backend tạo URL thanh toán đã sẵn**: khi `POST /api/orders/checkout` với
  `payment_method: "VNPAY"` hoặc `"MOMO"`, hệ thống ký HMAC đúng chuẩn và trả về
  `data.payment_redirect_url`. Xem `backend/src/utils/vnpay.js`, `momo.js`,
  `orderController.checkout()`.
- **Còn cần 2 mảnh**:
  1. **Frontend**: thêm 2 tùy chọn thanh toán VNPAY/MoMo ở checkout và **redirect** người
     dùng sang `payment_redirect_url`.
  2. **Backend**: route nhận **callback** từ cổng để xác minh chữ ký và cập nhật trạng thái
     thanh toán đơn hàng.

### 2.4. Đoạn code cần dán

**(a) Frontend — thêm tùy chọn + redirect** `frontend/src/pages/checkout/ui/checkout-page.jsx`:
```js
// Thêm vào mảng paymentOptions:
{ id: "VNPAY", label: "Ví VNPay / Thẻ ATM", description: "Thanh toán online qua cổng VNPay" },
{ id: "MOMO",  label: "Ví MoMo", description: "Thanh toán qua ví điện tử MoMo" },

// Trong handlePlaceOrder, sau khi checkout thành công, TRƯỚC khi navigate:
if (result.data.payment_redirect_url) {
    window.location.href = result.data.payment_redirect_url;
    return;
}
```

**(b) Backend — route callback** tạo `backend/src/controllers/paymentController.js`:
```js
import crypto from 'crypto';
import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// VNPay redirect về: xác minh vnp_SecureHash rồi cập nhật payment.
export const vnpayReturn = asyncHandler(async (req, res) => {
  const params = { ...req.query };
  const secureHash = params.vnp_SecureHash;
  delete params.vnp_SecureHash; delete params.vnp_SecureHashType;
  const sorted = Object.keys(params).sort().reduce((a, k) => (a[k] = params[k], a), {});
  const signData = new URLSearchParams(sorted).toString();
  const signed = crypto.createHmac('sha512', process.env.VNPAY_HASH_SECRET)
    .update(Buffer.from(signData, 'utf-8')).digest('hex');
  const ok = signed === secureHash && params.vnp_ResponseCode === '00';
  const orderId = params.vnp_TxnRef;
  if (ok) {
    await query("UPDATE payments SET payment_status='SUCCESS', paid_at=NOW() WHERE order_id=?", [orderId]);
    await query("UPDATE orders SET status='CONFIRMED' WHERE id=? AND status='PENDING'", [orderId]);
  }
  // Điều hướng người dùng về trang kết quả của frontend:
  res.redirect(`${process.env.FRONTEND_URL}/checkout/success/${orderId}?paid=${ok ? 1 : 0}`);
});

// MoMo gọi IPN (server-to-server): xác minh chữ ký, cập nhật payment.
export const momoIpn = asyncHandler(async (req, res) => {
  const { orderId, resultCode } = req.body; // orderId dạng "<orderId>-<requestId>"
  const realOrderId = String(orderId).split('-')[0];
  if (String(resultCode) === '0') {
    await query("UPDATE payments SET payment_status='SUCCESS', paid_at=NOW() WHERE order_id=?", [realOrderId]);
    await query("UPDATE orders SET status='CONFIRMED' WHERE id=? AND status='PENDING'", [realOrderId]);
  }
  res.status(204).end();
});
```
Rồi khai báo route (public, KHÔNG qua `auth`) trong `backend/src/routes/api.routes.js`,
đặt phía trên `router.use(auth)`:
```js
import * as payment from '../controllers/paymentController.js';
router.get('/payments/vnpay/return', payment.vnpayReturn);
router.post('/payments/momo/ipn', payment.momoIpn);
```
> Lưu ý: đổi `VNPAY_RETURN_URL` thành `http://127.0.0.1:8000/api/payments/vnpay/return`
> để VNPay gọi thẳng backend xác minh (route ở trên sẽ redirect tiếp về frontend).

---

## 3. Vận chuyển GHN (Giao Hàng Nhanh)

### 3.1. Lấy credential
1. Đăng ký tài khoản dev tại https://5sao.ghn.dev (môi trường test của GHN).
2. Lấy **Token** (API token) và **ShopID** (mã cửa hàng).

### 3.2. Điền `.env` (backend)
```env
GHN_TOKEN=<token>
GHN_SHOP_ID=<shop_id>
GHN_API_URL=https://online-gateway.ghn.vn/shiip/public-api   # hoặc dev-online-gateway.ghn.vn cho test
```

### 3.3. Trạng thái code
- **Chạy ngay sau khi có token**: tra cứu Tỉnh/Huyện/Xã tại checkout & màn tạo vận đơn admin
  (`GET /api/shipping/ghn/provinces|districts|wards`) — xem `backend/src/utils/ghn.js`.
- **Cần hoàn thiện**: tính phí thật + tạo vận đơn thật. Hiện `storeShipment` tạo vận đơn
  **thủ công/mô phỏng** (tracking sinh nội bộ). Bổ sung 2 hàm dưới rồi gọi trong
  `admin.controller.js → storeShipment()`.

### 3.4. Đoạn code cần thêm vào `backend/src/utils/ghn.js`
```js
// Tính phí vận chuyển thật.
export async function calculateFee({ toDistrictId, toWardCode, weight = 1000, ...dims }) {
  const { data } = await ghn.post('/v2/shipping-order/fee', {
    shop_id: Number(process.env.GHN_SHOP_ID),
    service_type_id: 2,
    to_district_id: toDistrictId,
    to_ward_code: toWardCode,
    weight, length: dims.length || 20, width: dims.width || 20, height: dims.height || 10,
  }, { headers: { ShopId: process.env.GHN_SHOP_ID } });
  return data.data; // { total, service_fee, ... }
}

// Tạo vận đơn thật -> trả tracking code.
export async function createGhnOrder(payload) {
  const { data } = await ghn.post('/v2/shipping-order/create', {
    shop_id: Number(process.env.GHN_SHOP_ID),
    payment_type_id: 1, required_note: 'KHONGCHOXEMHANG', service_type_id: 2,
    ...payload, // to_name, to_phone, to_address, to_ward_code, to_district_id, weight, items...
  }, { headers: { ShopId: process.env.GHN_SHOP_ID } });
  return data.data; // { order_code, total_fee, expected_delivery_time }
}
```
Trong `admin.controller.js → storeShipment()`, khi carrier là GHN thì gọi `createGhnOrder(...)`,
lưu `order_code` trả về vào `order_shipments.tracking_code` thay cho mã sinh nội bộ; dùng
`calculateFee(...)` lúc checkout nếu muốn phí GHN thật thay cho công thức phí hiện tại.

---

## 4. Kiểm thử sau khi cấu hình

| Tích hợp | Cách test nhanh |
|---|---|
| Gemini/OpenAI | Mở widget chat, hỏi 1 câu → nhận trả lời từ AI (source: gemini/openai) |
| SMTP | Trang Quên mật khẩu → nhập email → kiểm tra hộp thư nhận link reset |
| Google login | Trang đăng nhập → bấm nút Google → chọn tài khoản → vào thẳng /account/profile |
| VNPay | Checkout chọn "Ví VNPay" → redirect sang sandbox → thanh toán → quay lại trang kết quả |
| MoMo | Checkout chọn "Ví MoMo" → quét QR sandbox → MoMo gọi IPN → đơn chuyển CONFIRMED |
| GHN | Admin → Điều phối đơn → tạo vận đơn carrier GHN → nhận `order_code` thật từ GHN |

> Tất cả biến bí mật (`*_SECRET`, `*_KEY`, `*_TOKEN`) chỉ đặt trong `.env` (đã nằm trong
> `.gitignore`) — **không commit** lên git.
