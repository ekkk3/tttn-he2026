# TMDT Backend — Node.js + Express

Backend moi, viet lai bang **Node.js + Express + MySQL** (thay cho ban Laravel/PHP cu),
de dung dung nhu de cuong da ghi (muc 2.1 Backend). Frontend React (`5_9_TMDT_Frontend`)
khong doi gi ca — chi can tro `VITE_API_URL` sang server nay.

Da kiem tra: syntax toan bo file OK, server boot thanh cong, routing/auth middleware/error
handling hoat dong dung (test bang `npm install` + khoi dong server that trong sandbox).

## 1. Cai dat

```bash
cd backend-node
npm install
cp .env.example .env
```

Sua `.env`: dien `DB_HOST/DB_USER/DB_PASSWORD/DB_NAME` tro vao MySQL cua ban.

## 2. Tao database (dung LAI schema tu repo Laravel cu)

```bash
mysql -u root -p < ../5_9_TMDT_Backend/database/ecommerce_schema_mysql.sql
mysql -u root -p ecommerce_db < ../5_9_TMDT_Backend/database/ecommerce_seed_data.sql

# Bo sung bang vouchers (de cuong yeu cau nhung schema Laravel goc khong co):
mysql -u root -p ecommerce_db < sql/add_vouchers.sql
```

## 3. Chay server

```bash
npm run dev      # tu restart khi sua code (node --watch)
# hoac
npm start
```

Kiem tra: `GET http://127.0.0.1:8000/backend-status` va `GET http://127.0.0.1:8000/api/test`.

## 4. Noi voi Frontend

Trong `5_9_TMDT_Frontend/.env`, tro bien API base URL (xem `.env.example` cua frontend va
`api_backend.md`) ve `http://127.0.0.1:8000/api`. Khong can sua code frontend vi tat ca
route/path trong `src/routes/api.routes.js` duoc giu **dung nguyen** theo
`routes/api.php` cua Laravel.

## 5. Nhung gi da lam that / dang chay duoc

- Auth (register/login/me/logout) — JWT, bcrypt.
- Categories, Products (tim kiem fallback MySQL LIKE, tu dong dung Elasticsearch fuzzy
  search neu ban cau hinh `ELASTICSEARCH_NODE`), Regions, Suppliers — public + Admin CRUD.
- Cart — cache-aside qua Redis neu co `REDIS_URL`, tu fallback MySQL neu khong.
- Checkout/Orders — tao don hang that (transaction MySQL), tru gio hang, luu lich su
  trang thai; tao URL redirect VNPay / MoMo that (dung dung thuat toan ky HMAC cong khai
  cua 2 cong, chi can dien API key that vao `.env`).
- Account (profile, doi mat khau, dia chi, wishlist, doi diem thuong), Notifications,
  Complaints, Support tickets, Newsletter, Posts (blog + like/comment).
- Warehouse staff: `/api/operations/*` (ton kho, yeu cau nhap hang, don cung cap,
  fulfillment tasks).
- Admin: dashboard, users, admin accounts, products, categories, suppliers, orders
  (status/payment status/bulk update), shipping carriers, settings, community
  (moi NCC), posts + kiem duyet binh luan.
- Middleware phan quyen 4 vai tro (CUSTOMER/ADMIN/WAREHOUSE_STAFF/SUPPLIER) dung JWT.
- `/api/chat` — AI Chatbot (OpenAI hoac Gemini, chon qua `AI_PROVIDER` trong `.env`) —
  tinh nang MOI, chua ton tai ben repo Laravel goc, them theo dung de cuong Tuan 5.

## 6. Con thieu / TODO (can lam tiep khi trien khai that)

- **Elasticsearch indexing pipeline**: code da san sang goi ES khi tim kiem, nhung
  chua co script dong bo du lieu tu MySQL sang ES khi tao/sua san pham. Xem TODO trong
  `src/config/elasticsearch.js` va `src/controllers/admin/admin.controller.js`.
- **Phi/van don GHN that**: `src/utils/ghn.js` da co goi provinces/districts/wards that,
  nhung phan tinh phi van chuyen (`/v2/shipping-order/fee`) va tao don
  (`/v2/shipping-order/create`) con la TODO — checkout dang dung phi co dinh 30.000d.
- **VNPay/MoMo**: thuat toan ky va goi API la that, nhung can dien merchant that
  (`VNPAY_TMN_CODE`, `MOMO_PARTNER_CODE`, ...) trong `.env` va xu ly them route nhan
  callback IPN/return (chua co trong file nay).
- **Voucher**: schema Laravel goc KHONG co bang vouchers. Da them migration
  `sql/add_vouchers.sql`, nhung logic ap dung voucher trong `orderController.checkout()`
  con dang la placeholder (`discount_amount = 0`) — can noi lai sau khi chay migration.
- **JWT logout/blacklist**: hien tai logout la stateless (khong huy token ngay lap tuc).
  Neu can, luu blacklist token trong Redis.

## 7. Doi chieu voi de cuong — nhung diem lech da phat hien

- Repo `5_9_TMDT_Backend` (Laravel/PHP) **khac** cong nghe voi de cuong (Node.js +
  Express) — day la ly do backend nay duoc viet lai. Ban da chon huong: **giu dung
  de cuong (Node.js)**, dung Laravel chi de tham khao schema/logic.
- Schema Laravel khong co bang `vouchers` du de cuong co nhac tinh nang nay — da bo
  sung o `sql/add_vouchers.sql` (xem muc 6).
- AI Chatbot (`/api/chat`) chua ton tai trong Laravel — da them moi hoan toan o day.

## Cau truc thu muc

```
backend-node/
  src/
    app.js, server.js
    config/        # db (MySQL), redis, elasticsearch
    middleware/     # auth (JWT), role, errorHandler
    utils/          # jwt, vnpay, momo, ghn, asyncHandler
    controllers/     # auth, account, category, product, region, supplier,
                      # cart, order, ghnLocation, misc (notifications/complaints/
                      # support/newsletter/posts), operation (warehouse), chat
    controllers/admin/  # admin.controller.js (dashboard/users/products/orders/...)
    routes/api.routes.js  # mirror 1-1 voi routes/api.php cua Laravel
  sql/add_vouchers.sql
  .env.example
```
