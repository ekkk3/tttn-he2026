# TMDT Backend — Node.js + Express

Backend cho đề tài **"Xây dựng website thương mại điện tử bán đặc sản vùng miền Việt Nam"**
(Nhóm 23), viết bằng **Node.js + Express + MySQL** đúng theo Chương 6 (Công nghệ) của
tài liệu `NHÓM 2_TTTN.docx`. Frontend React (`../frontend`) chỉ cần trỏ `VITE_API_BASE_URL`
sang server này.

## 1. Cài đặt

```bash
cd backend
npm install
cp .env.example .env
```

Sửa `.env`: điền `DB_HOST/DB_USER/DB_PASSWORD/DB_NAME` trỏ vào MySQL của bạn.

## 2. Tạo database (schema tự chứa, KHÔNG cần repo ngoài)

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS ecommerce_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -u root -p --default-character-set=utf8mb4 ecommerce_db < sql/schema.sql
mysql -u root -p --default-character-set=utf8mb4 ecommerce_db < sql/seed.sql
```

> `sql/schema.sql` chứa toàn bộ 30+ bảng theo Chương 4 (Class Diagram + Thiết kế CSDL).
> `sql/seed.sql` tạo tài khoản mẫu để đăng nhập thử:
> - `admin@example.com` / `Admin@123` (ADMIN)
> - `customer@example.com` / `Customer@123` (CUSTOMER)
> - `supplier@example.com` / `Supplier@123` (SUPPLIER, đã duyệt)
> - Nhân viên kho tạo qua trang Admin (vai trò WAREHOUSE_STAFF).

## 3. Chạy server

```bash
npm run dev      # tự restart khi sửa code (node --watch)
# hoặc
npm start
```

Kiểm tra: `GET http://127.0.0.1:8000/backend-status` và `GET http://127.0.0.1:8000/api/test`.

## 4. Nối với Frontend

Trong `../frontend/.env`, đặt `VITE_API_BASE_URL=http://127.0.0.1:8000/api`.
Backend cho phép CORS từ `http://localhost:5173` và `http://127.0.0.1:5173`.

## 5. Tính năng đã làm & đã kiểm thử E2E

**Tuần 1 — Nền tảng & Người dùng**
- Auth (register/login/me/logout) JWT + bcrypt; middleware phân quyền 4 vai trò.
- Quên mật khẩu (reset qua email, fallback log console nếu chưa cấu hình SMTP).
- Đăng nhập Google/Facebook (google-auth-library + Graph API).
- Đăng ký Nhà cung cấp tự phục vụ (upload giấy phép) + Admin duyệt/từ chối.
- Admin quản lý người dùng.

**Tuần 2 — Sản phẩm & Mua hàng**
- Sản phẩm (list phân trang + Elasticsearch fuzzy search, fallback MySQL LIKE; quan hệ
  danh mục/NCC/vùng miền; nguồn gốc/QR truy xuất), danh mục, vùng miền.
- Giỏ hàng (Redis cache-aside, fallback MySQL) + kiểm tra tồn kho.
- Đặt hàng/Checkout (COD + chuyển khoản QR), trừ tồn kho, lịch sử trạng thái, thông báo.
- Wishlist, tài khoản (profile/địa chỉ/điểm thưởng).
- Admin CRUD sản phẩm/danh mục/NCC.

**Tuần 3 — Quản trị & Kiểm thử**
- Admin Dashboard (doanh thu, biểu đồ, hàng đợi xử lý, cảnh báo tồn kho, top khách).
- Quản lý đơn hàng/logistics (state machine PENDING→…→DELIVERED, tạo vận đơn, xử lý
  hàng loạt, hoàn kho khi hủy).
- Khiếu nại (khách gửi → Admin xử lý).
- Quản lý kho (tồn kho, phiếu nhập → nhập kho cộng tồn, giá nhập).
- AI Chatbot (`/api/chat`, OpenAI/Gemini; fallback tìm sản phẩm nội bộ khi chưa có API key).

## 6. Cấu hình tuỳ chọn (tính năng tự hạ cấp khi thiếu)

Các dịch vụ ngoài đều **tự fallback**, không làm sập server nếu chưa cấu hình:

| Biến `.env` | Khi bỏ trống |
|---|---|
| `REDIS_URL` | Giỏ hàng đọc/ghi thẳng MySQL (không cache). |
| `ELASTICSEARCH_NODE` | Tìm kiếm dùng MySQL LIKE thay vì fuzzy search. |
| `SMTP_HOST` | Email "quên mật khẩu" in ra console kèm link reset. |
| `GOOGLE_CLIENT_ID` / `FACEBOOK_APP_ID` | Endpoint OAuth trả 501 rõ ràng. |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | Chatbot trả lời dựa trên tìm kiếm sản phẩm thật trong DB. |
| `VNPAY_*` / `MOMO_*` | Checkout dùng COD + chuyển khoản ngân hàng (frontend đang dùng). |
| `GHN_TOKEN` | Tạo vận đơn thủ công (manual) + tracking mô phỏng. |

## 7. Ghi chú phạm vi (backend-ready, frontend chưa có UI riêng)

Một số tính năng có endpoint backend nhưng frontend chưa có trang UI để thao tác
(theo nguyên tắc "frontend là nguồn sự thật của contract"):
- Admin xử lý khiếu nại (`/api/admin/complaints`) — khách gửi + xem đã chạy; trang Admin
  duyệt chưa có trong frontend.
- Kiểm duyệt đánh giá sản phẩm, Voucher, Flash Sale, Refund/Return — chưa có UI trong
  frontend hiện tại nên chưa ghép.

## Cấu trúc thư mục

```
backend/
  src/
    app.js, server.js
    config/         # db (MySQL utf8mb4), redis (fail-fast), elasticsearch
    middleware/     # auth (JWT), role, upload (multer), errorHandler
    utils/          # jwt, serializers (shape contract), mailer, oauth, vnpay, momo, ghn
    controllers/    # auth, account, category, product, region, supplier, cart, order,
                    # ghnLocation, misc, operation (kho), chat
    controllers/admin/  # admin.controller.js (dashboard, users, products, orders, ...)
    routes/api.routes.js
  sql/
    schema.sql      # toàn bộ CSDL (tự chứa)
    seed.sql        # dữ liệu mẫu
    add_vouchers.sql
```
