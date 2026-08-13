# Lộ trình đọc code dự án

Tài liệu này là đường đi để hiểu mã nguồn đang chạy của hệ thống thương mại điện tử. Đọc theo **luồng nghiệp vụ** thay vì mở lần lượt mọi file theo tên: mỗi luồng đều lần theo `page → store → API route → controller → bảng SQL`.

> Không cần đọc các file trong `docs/file code giao diện mẫu/` khi bắt đầu: đó là tài liệu tham khảo, không phải mã runtime.

## 0. Bản đồ dự án (30–45 phút)

1. Đọc [README.md](../README.md) và [backend/README.md](../backend/README.md) để nắm bốn vai trò: khách hàng, admin, nhân viên kho và nhà cung cấp.
2. Đọc [backend/package.json](../backend/package.json), [frontend/package.json](../frontend/package.json), rồi hai file `.env.example` để biết dịch vụ nào là bắt buộc và dịch vụ nào có fallback.
3. Đọc [schema.sql](../backend/sql/schema.sql) theo các phần được đánh số, không cần thuộc từng cột:
   - 1–4: người dùng, danh mục, nhà cung cấp, sản phẩm;
   - 5–7: giỏ hàng, đơn hàng/thanh toán, vận chuyển;
   - 8–9: kho, thông báo/khiếu nại/hỗ trợ;
   - 10–14: cộng đồng, cấu hình, voucher, giá nhập và lịch sử chatbot.
4. Mở [seed.sql](../backend/sql/seed.sql) để biết dữ liệu thử nghiệm và các tài khoản mẫu.

## 1. Điểm khởi động của hai ứng dụng (45 phút)

### Backend

Đọc theo đúng thứ tự:

1. [server.js](../backend/src/server.js): mở cổng HTTP.
2. [app.js](../backend/src/app.js): CORS, JSON parser, log, static uploads, `/backend-status`, mount `/api`, 404 và xử lý lỗi.
3. [api.routes.js](../backend/src/routes/api.routes.js): danh mục endpoint và ranh giới xác thực/phân quyền.
4. Middleware: [auth.js](../backend/src/middleware/auth.js) → [role.js](../backend/src/middleware/role.js) → [errorHandler.js](../backend/src/middleware/errorHandler.js) → [rateLimit.js](../backend/src/middleware/rateLimit.js) → [upload.js](../backend/src/middleware/upload.js).

Điểm cần nhớ: các route phía trên `router.use(auth)` là public; các route phía dưới yêu cầu JWT. Ba router con `/operations`, `/supplier`, `/admin` có chặn role khi được mount.

### Frontend

Đọc theo đúng thứ tự:

1. [main.jsx](../frontend/src/main.jsx): mount React, `BrowserRouter`, bootstrap và toast.
2. [app-bootstrap.jsx](../frontend/src/app/app-bootstrap.jsx): khôi phục phiên; với khách hàng sẽ tải profile, wishlist và giỏ hàng.
3. [router.jsx](../frontend/src/app/router.jsx): toàn bộ route, lazy-load page và bốn nhóm layout.
4. [route-guard.jsx](../frontend/src/app/route-guard.jsx) và [admin-module-guard.jsx](../frontend/src/app/admin-module-guard.jsx): quyền truy cập trên giao diện.
5. Các layout trong `frontend/src/app/layouts/`, sau đó [routes.js](../frontend/src/shared/config/routes.js) và [admin-modules.js](../frontend/src/shared/config/admin-modules.js).

## 2. Lớp giao tiếp và state (60–90 phút)

Đọc [backend-client.js](../frontend/src/shared/api/backend-client.js) trước: mọi store dùng `apiRequest`, tại đây token Bearer, base URL và lỗi API được chuẩn hóa. Sau đó đọc [auth.js](../frontend/src/shared/lib/auth.js) và các Zustand store theo nhóm sau.

| Nhóm | Store cần đọc | Backend tương ứng |
| --- | --- | --- |
| Phiên | `use-auth-store` | `authController`, `auth.js`, `jwt.js`, `oauth.js` |
| Catalog | `use-storefront-catalog-store` | `productController`, `categoryController`, `regionController`, `supplierController` |
| Giỏ/đơn | `use-cart-store`, `use-customer-orders-store` | `cartController`, `voucherController`, `orderController` |
| Tài khoản | `use-account-store`, `use-shop-store` | `accountController`, `miscController` |
| Admin | `use-admin-*-store` | `controllers/admin/` và controller liên quan |
| Kho/NCC | `use-operations-data-store` | `operationController`, `supplierController` |
| Phụ trợ | `use-ghn-location-store`, `use-post-store`, `use-feedback-store` | `ghnLocationController`, `miscController` |

`use-ui-store`, `protected-session` và `reset-demo` chỉ là state/tiện ích phía client; đọc sau các store gọi API.

## 3. Bốn luồng đọc chính

### A. Khách đăng nhập và mua sản phẩm

1. `pages/login` → `use-auth-store` → `POST /login` → `authController.login` → bảng `users`.
2. `pages/home`/`pages/catalog` → `use-storefront-catalog-store` → `GET /products` → `productController.index` → `products`, `categories`, `suppliers`, `regions`.
3. `pages/product-detail` → catalog/cart store → `GET /products/:id`, `POST /cart/items` → `productController`, `cartController` → `products`, `carts`, `cart_items`.
4. `pages/checkout` → `use-customer-orders-store` → `POST /orders/checkout` → `orderController.checkout` → `orders`, `order_items`, `payments`, `order_status_history`; tiếp tục sang `paymentService`, `orderTransitions` và `notificationService`.
5. `pages/order-success`, `pages/payment-result`, `pages/account-orders` → endpoints `/orders/*` và `/payments/*`.

Đọc ngay sau luồng này: `serializers.js` (API response contract), `validators.js`, `sql.js`, `paymentController.js`, `vnpay.js`, `momo.js`, `ghn.js`.

### B. Khách quản lý tài khoản

Đi theo `pages/account-profile` → `account-security` → `account-addresses` → `account-wishlist` → `account-notifications` → `account-disputes` → `account-rewards` → `account-orders`.

Mỗi trang đi qua `use-account-store`, `use-shop-store` hoặc `use-customer-orders-store`, rồi đến `accountController`/`miscController`. Đối chiếu các bảng `users`, `user_addresses`, `wishlists`, `wishlist_items`, `notifications`, `complaints`, `reward_redemptions`.

### C. Admin quản trị

1. `pages/admin-dashboard` → admin dashboard store/controller → endpoint `/admin/dashboard`.
2. `pages/admin-users` → `pages/admin-user-orders` → `pages/admin-user-order-detail` → `users.controller.js`, `orders.controller.js`.
3. `pages/admin-repository` (sản phẩm/danh mục/NCC) → `products.controller.js`, `categoryController.js`, `supplierController.js`.
4. Các page còn lại theo menu trong `admin-modules.js`: community, supplier applications, complaints, reviews, vouchers, shipping carriers, logistics, settings, admins.

Trong backend, đọc `controllers/admin/index.js` trước rồi theo đúng nhóm page. Luôn kiểm tra route `/api/admin/*` trong `api.routes.js`, vì đó là hợp đồng giao diện–backend.

### D. Kho và nhà cung cấp

1. Kho: `pages/warehouse-inventory` → `warehouse-requisitions` → `warehouse-fulfillment` → `warehouse-supplier-orders`.
2. Nhà cung cấp: `pages/supplier-register` → `supplier-products` → `supplier-orders` → `supplier-inventory` → `supplier-requisitions` → `supplier-processing` → `supplier-revenue`.
3. Cả hai đều chủ yếu dùng `use-operations-data-store`; đối chiếu `/api/operations/*` với `operationController.js` và các bảng `products`, `delivery_requests`, `purchase_price_history`, `orders`.
4. Phần nhà cung cấp sở hữu sản phẩm dùng `/api/supplier/*` và `supplierController.js`.

## 4. File dùng lại và dịch vụ ngoài

Chỉ đọc sau khi đã hoàn thành một luồng ở trên:

- `frontend/src/widgets/`: các khối UI lớn dùng ở nhiều page; ưu tiên `storefront-header`, `admin-sidebar`, `portal-sidebar`, `order-table`.
- `frontend/src/entities/product/` rồi `frontend/src/shared/ui/`: component nhỏ, không chứa nghiệp vụ chính.
- [index.css](../frontend/src/app/styles/index.css): thiết kế hệ thống/Tailwind.
- `backend/src/config/`: `db.js` → `redis.js` → `elasticsearch.js`.
- `backend/src/utils/`: `productIndex.js`, `mailer.js`, `oauth.js`, `vnpay.js`, `momo.js`, `ghn.js`; các dịch vụ này đều có cơ chế giảm cấp khi thiếu cấu hình.
- `reviewController.js`, `chatController.js`, `miscController.js`: đánh giá, chatbot, cộng đồng, thông báo và hỗ trợ.

## 5. Xác nhận đã hiểu đúng

Sau từng luồng, đọc test tương ứng thay vì cố đọc toàn bộ test một lượt:

- Backend integration: `backend/src/test/integration/auth.test.js`, `product-search.test.js`, `cart.test.js`, `cod-auto-payment.test.js`, `payment.test.js`, `rbac.test.js`.
- Backend unit: `order-transitions.test.js`, `voucher-discount.test.js`, `validators.test.js`, `sql.test.js`, `dates.test.js`.
- Frontend: `app-routes.test.jsx`, `admin-rbac.test.jsx`, `customer-commerce-store.test.js`, `product-detail-cart-badge.test.jsx`, `account-addresses-page.test.jsx`.

Với mỗi trang mới, trả lời được năm câu hỏi trước khi chuyển trang: **ai được dùng; dữ liệu nào hiển thị; store nào sở hữu state; endpoint nào được gọi; các bảng nào bị đọc/ghi**. Nếu trả lời đủ năm câu, bạn đã hiểu trang đó ở mức có thể sửa lỗi hoặc mở rộng tính năng.

## Thứ tự tối ưu cho ngày đầu

`README.md` → `schema.sql` (phần 1–6) → `server.js` → `app.js` → `api.routes.js` → auth → product/catalog → cart/order → `main.jsx` → `app-bootstrap.jsx` → `router.jsx` → frontend stores → home/catalog/product-detail/checkout.

Luồng này bao phủ phần kiến trúc cốt lõi trước khi sang các module ít dùng hơn như admin, kho, NCC, chatbot và cộng đồng.
