# Website Thương mại điện tử bán đặc sản vùng miền Việt Nam

Đề tài thực tập tốt nghiệp — Nhóm 23 (Học viện Công nghệ Bưu chính Viễn thông).
Hệ thống TMĐT đầy đủ cho 4 vai trò: **Khách hàng, Quản trị viên (Admin), Nhân viên kho,
Nhà cung cấp**.

## 1. Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Backend | Node.js + Express |
| CSDL | MySQL 8 (utf8mb4) |
| Frontend | ReactJS (Vite) + Tailwind CSS |
| Cache giỏ hàng | Redis *(tuỳ chọn — fallback MySQL)* |
| Tìm kiếm | Elasticsearch *(tuỳ chọn — fallback MySQL LIKE)* |
| Thanh toán | COD, chuyển khoản (QR); VNPay/MoMo *(có sẵn code)* |
| Vận chuyển | GHN *(tra cứu địa chỉ; tạo vận đơn xem hướng dẫn)* |
| AI Chatbot | OpenAI / Gemini *(fallback tìm sản phẩm nội bộ)* |

## 2. Yêu cầu môi trường

- **Node.js ≥ 18** (khuyến nghị 20/22) và **npm ≥ 9**
- **MySQL 8** (hoặc **MariaDB** qua XAMPP/WAMP)
- *(Tuỳ chọn)* Redis, Elasticsearch — không có vẫn chạy bình thường

Kiểm tra: `node -v`, `npm -v`, `mysql --version`.

## 3. Cấu trúc thư mục

```
tttn-he2026/
├── backend/            # API Node.js + Express
│   ├── src/            # app, config, middleware, controllers, routes, utils
│   ├── sql/            # schema.sql (CSDL) + seed.sql (dữ liệu mẫu)
│   └── .env.example
├── frontend/           # Ứng dụng React (Vite + Tailwind)
│   ├── src/
│   └── .env.example
└── docs/
    └── HUONG_DAN_TICH_HOP.md   # cấu hình Google/FB login, VNPay/MoMo, GHN
```

## 4. Cài đặt & chạy

Mở **2 cửa sổ terminal** (một cho backend, một cho frontend). Chạy backend trước.

### 4.1. Backend + Database

```bash
cd backend
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Sửa `backend/.env` cho khớp MySQL của bạn (tối thiểu `DB_USER`, `DB_PASSWORD`):

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=ecommerce_db
DB_USER=root
DB_PASSWORD=
JWT_SECRET=doi_thanh_chuoi_ngau_nhien_that_dai
CORS_ORIGIN=http://localhost:5173
```

Tạo database và nạp schema + dữ liệu mẫu:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS ecommerce_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
mysql -u root -p --default-character-set=utf8mb4 ecommerce_db < sql/schema.sql
mysql -u root -p --default-character-set=utf8mb4 ecommerce_db < sql/seed.sql
```

> **Dùng XAMPP?** Bật MySQL trong XAMPP Control Panel, rồi dùng client tại
> `C:\xampp\mysql\bin\mysql.exe` (mặc định user `root`, không mật khẩu).

Chạy server:

```bash
npm run dev      # tự restart khi sửa code
# hoặc: npm start
```

Backend chạy tại **http://127.0.0.1:8000**. Kiểm tra: mở `http://127.0.0.1:8000/backend-status`
→ trả `{"status":"ok"}`.

### 4.2. Frontend

```bash
cd frontend
npm install
cp .env.example .env        # Windows: copy .env.example .env
npm run dev
```

Frontend chạy tại **http://localhost:5173**. `frontend/.env` mặc định đã trỏ
`VITE_API_BASE_URL=http://127.0.0.1:8000/api` — không cần sửa nếu backend chạy cổng 8000.

Mở trình duyệt: **http://localhost:5173**

## 5. Tài khoản đăng nhập mẫu

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Quản trị viên | `admin@example.com` | `Admin@123` |
| Khách hàng | `customer@example.com` | `Customer@123` |
| Nhà cung cấp | `supplier@example.com` | `Supplier@123` |
| Nhân viên kho | *(tạo trong trang Admin → Người dùng, vai trò WAREHOUSE_STAFF)* | |

Sau khi đăng nhập, hệ thống tự điều hướng theo vai trò (khách → storefront/tài khoản,
admin → `/admin`, NCC → `/supplier`, kho → `/warehouse`).

## 6. Tích hợp tuỳ chọn

Các dịch vụ bên ngoài đều **tự hạ cấp an toàn** khi chưa cấu hình (không làm sập hệ thống):

| Biến `.env` (backend) | Khi bỏ trống |
|---|---|
| `REDIS_URL` | Giỏ hàng đọc/ghi thẳng MySQL |
| `ELASTICSEARCH_NODE` | Tìm kiếm dùng MySQL LIKE |
| `SMTP_HOST` | Email "quên mật khẩu" in link ra console |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | Chatbot fallback tìm sản phẩm trong DB |
| `GOOGLE_CLIENT_ID` / `FACEBOOK_APP_ID` | Ẩn/tắt đăng nhập mạng xã hội |
| `VNPAY_*` / `MOMO_*` | Checkout dùng COD + chuyển khoản |
| `GHN_TOKEN` | Vận đơn thủ công + tracking mô phỏng |

👉 Hướng dẫn lấy credential và bật từng tích hợp: **[docs/HUONG_DAN_TICH_HOP.md](docs/HUONG_DAN_TICH_HOP.md)**.

## 7. Kiểm thử

```bash
cd frontend
npm test            # chạy test (vitest)
npm run lint        # kiểm tra lint
```

## 8. Chức năng chính

- **Khách hàng**: đăng ký/đăng nhập (+ quên mật khẩu), tìm/xem sản phẩm, giỏ hàng, đặt hàng,
  thanh toán, voucher, wishlist, đánh giá sản phẩm, theo dõi đơn, thông báo, khiếu nại, AI chatbot.
- **Admin**: dashboard doanh thu, quản lý người dùng/sản phẩm/danh mục/NCC/đơn hàng, xử lý
  khiếu nại, kiểm duyệt đánh giá, quản lý voucher, duyệt đăng ký NCC.
- **Nhân viên kho**: tồn kho, phiếu nhập, xử lý đơn, quản lý giá nhập.
- **Nhà cung cấp**: đăng ký, quản lý sản phẩm của mình, xem đơn/tồn kho, xác nhận phiếu nhập,
  báo cáo doanh thu.

---

> Chi tiết backend (API, cấu trúc, fallback) xem thêm [`backend/README.md`](backend/README.md).
