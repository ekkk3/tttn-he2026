# Hướng dẫn cấu hình tích hợp bên ngoài

Tài liệu này hướng dẫn **từng bước** để bật các tích hợp cần credential/khoá của bên thứ ba.
Toàn bộ hệ thống đã được thiết kế **tự hạ cấp an toàn**: khi chưa cấu hình, tính năng vẫn
chạy ở chế độ fallback (không sập). Hầu hết chỉ cần điền `.env` là chạy thật (bao gồm
VNPay/MoMo và GHN — đã tích hợp sẵn callback + tạo vận đơn). Riêng đăng nhập Google/Facebook
cần dán thêm nút ở frontend (mục 1).

> Mọi biến đặt trong `backend/.env` (copy từ `backend/.env.example`). Sau khi sửa `.env`,
> khởi động lại backend (`npm run dev` tự restart).

Bảng tổng quan mức độ sẵn sàng:

| Tích hợp | Chỉ cần điền `.env`? | Ghi chú |
|---|---|---|
| AI Chatbot (Gemini/OpenAI) | ✅ Có | Điền key là chạy thật; không có key thì fallback tìm SP nội bộ |
| Email quên mật khẩu (SMTP) | ✅ Có | Không có SMTP thì in link reset ra console |
| Tìm kiếm Elasticsearch (fuzzy) | ✅ Có | Index tự tạo + tự đồng bộ khi CRUD; `npm run reindex` để index lại. Không có ES thì fallback MySQL LIKE |
| Giỏ hàng Redis | ✅ Có | Không có thì đọc/ghi thẳng MySQL |
| **VNPay / MoMo** | ✅ Có (điền `.env`) | Cổng thanh toán + **callback return/IPN** đã tích hợp sẵn; cập nhật trạng thái đơn tự động (mục 2) |
| **GHN (vận đơn + phí thật)** | ✅ Có (điền `.env`) | Tra cứu địa chỉ + **tính phí + tạo/huỷ/đồng bộ vận đơn** đã tích hợp sẵn (mục 3) |
| **Đăng nhập Google/Facebook** | ⚠️ Gần đủ | Điền `.env` + dán nút đăng nhập ở frontend (mục 1) |

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
- Bỏ trống hoàn toàn OK (fallback MySQL LIKE). Khi có `ELASTICSEARCH_NODE`:
  - Backend **tự tạo index và tự nạp dữ liệu** lúc khởi động nếu index rỗng
    (`bootstrapProductIndex` trong `backend/src/utils/productIndex.js`).
  - Mỗi lần admin/NCC tạo–sửa sản phẩm, sản phẩm được **đồng bộ ngay** vào ES.
  - Muốn index lại toàn bộ (ví dụ sau khi nạp lại `seed.sql`): `cd backend && npm run reindex`.
  - Tìm kiếm dùng `multi_match` + `fuzziness: AUTO` (chịu lỗi gõ/sai chính tả, có bỏ dấu).

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

### 2.3. Trạng thái code — ĐÃ TÍCH HỢP SẴN
Chỉ cần điền `.env` ở trên là chạy full luồng, **không phải dán thêm code**:
- **Tạo URL thanh toán**: `POST /api/orders/checkout` với `payment_method: "VNPAY"|"MOMO"`
  ký HMAC đúng chuẩn, trả `data.payment_redirect_url` (`utils/vnpay.js`, `utils/momo.js`).
- **Frontend**: trang checkout đã có 2 tuỳ chọn VNPay/MoMo và tự `window.location` sang cổng
  (`pages/checkout/ui/checkout-page.jsx`). Nếu chưa cấu hình `.env`, hệ thống báo và tạo đơn
  chờ để khách chọn cách khác.
- **Callback**: `backend/src/controllers/paymentController.js` xác minh chữ ký (return + IPN),
  cập nhật `payments.payment_status`, ghi `payment_status_history`, chuyển đơn PENDING→CONFIRMED,
  gửi thông báo cho khách. Cập nhật **idempotent** (return và IPN gọi cùng lúc không ghi trùng).
- **Route** (đã khai báo public trong `routes/api.routes.js`, trên `router.use(auth)`):
  ```
  GET  /api/payments/vnpay/return   GET  /api/payments/vnpay/ipn
  GET  /api/payments/momo/return    POST /api/payments/momo/ipn
  ```
- **Trang kết quả** cho khách: `/checkout/vnpay-return`, `/checkout/momo-return`
  (`pages/payment-result/ui/payment-result-page.jsx`) — gọi endpoint return để xác minh và hiển thị.

> `VNPAY_RETURN_URL`/`MOMO_RETURN_URL` trỏ về trang FE (đã đặt sẵn trong `.env.example`).
> Trang FE gọi backend xác minh. Muốn VNPay gọi IPN server→server, khai báo thêm
> `http://127.0.0.1:8000/api/payments/vnpay/ipn` trên cổng VNPay (biến `VNPAY_IPN_URL` gợi ý trong `.env.example`).

---

## 3. Vận chuyển GHN (Giao Hàng Nhanh)

### 3.1. Lấy credential
1. Đăng ký tài khoản dev tại https://5sao.ghn.dev (môi trường test của GHN).
2. Lấy **Token** (API token) và **ShopID** (mã cửa hàng).

### 3.2. Điền `.env` (backend)
```env
GHN_TOKEN=<token>
GHN_SHOP_ID=<shop_id>
GHN_FROM_DISTRICT_ID=<district_id kho lấy hàng>   # dùng để tính phí (from_district_id)
GHN_API_URL=https://online-gateway.ghn.vn/shiip/public-api   # hoặc dev-online-gateway.ghn.vn cho test
```
> Cần **cả** `GHN_TOKEN` và `GHN_SHOP_ID` thì tính phí/tạo vận đơn thật mới bật
> (`ghnConfigured()`); thiếu một trong hai sẽ tự quay về vận đơn thủ công.

### 3.3. Trạng thái code — ĐÃ TÍCH HỢP SẴN
- **Tra cứu địa chỉ**: `GET /api/shipping/ghn/provinces|districts|wards` (checkout dùng để chọn
  Tỉnh/Huyện/Xã; các ID được lưu vào đơn hàng khi đặt).
- **Tính phí**: `POST /api/shipping/ghn/fee` (checkout) và
  `POST /api/admin/orders/:order/shipment/fee-preview` (admin xem trước phí).
- **Tạo vận đơn**: khi admin tạo vận đơn với carrier có `provider = 'GHN'`, `storeShipment`
  gọi GHN `/v2/shipping-order/create` → lưu `order_code`, `tracking_url`, `shipping_fee`,
  `cod_amount`, `expected_delivery_time`. Nếu chưa cấu hình GHN → tự tạo vận đơn thủ công.
- **Đồng bộ / huỷ**: `syncShipment` gọi `/v2/shipping-order/detail` cập nhật trạng thái;
  `destroyShipment` gọi `/v2/switch-status/cancel` huỷ vận đơn trên GHN.
- Các hàm GHN: `backend/src/utils/ghn.js` (`calculateFee`, `createShippingOrder`,
  `getShippingOrderDetail`, `cancelShippingOrder`, `ghnConfigured`).

> Lưu ý dữ liệu: đơn đặt sau khi thêm tính năng này sẽ lưu `shipping_district_id` /
> `shipping_ward_code` để tạo vận đơn GHN. Với DB cũ, chạy `sql/upgrade-shipping-payment.sql`
> để thêm các cột mới (đơn cũ chưa có địa chỉ GHN thì admin nhập tay `to_district_id`/`to_ward_code`).

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
