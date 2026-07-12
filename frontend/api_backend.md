# API Backend Spec Cho Frontend Hiện Tại

Tài liệu này mô tả các API backend cần có để phục vụ dự án frontend hiện tại trong repo. Mục tiêu là backend có thể triển khai trực tiếp theo contract này mà không phải tự suy đoán thêm về payload, response hay luồng dữ liệu.

## 1. Mục tiêu và mức ưu tiên

- `Required`: cần có để phục vụ trực tiếp các màn hình, store, workflow và form đang tồn tại trong frontend.
- `Recommended`: nên có để thay thế state local hiện tại như `cart`, `wishlist`, `recently viewed`, `promo`, export dữ liệu và các luồng mở rộng.
- `Dev-only`: chỉ dùng cho môi trường demo, QA hoặc seed/reset dữ liệu.
- `Optional`: không bắt buộc cho bản đầu, nhưng nên chuẩn bị cho realtime hoặc đồng bộ đa client.

## 2. Quy ước chung

### 2.1 Base URL

- Base path mặc định: `/api/v1`
- Tất cả API trả về `application/json; charset=utf-8`, trừ endpoint upload file và export file.

### 2.2 Header chuẩn

- `Authorization: Bearer <access_token>` cho mọi endpoint cần đăng nhập.
- `Content-Type: application/json` cho request JSON.
- `Content-Type: multipart/form-data` cho upload avatar.

### 2.3 Quy ước dữ liệu

- Tiền tệ dùng số nguyên theo đơn vị `VND`.
- Thời gian dùng ISO 8601 UTC, ví dụ `2026-04-08T10:30:00Z`.
- `id` là string ổn định, không dùng integer auto-increment ở tầng client contract.
- Response list nên có `meta` để frontend có thể phân trang hoặc filter mà không đổi contract.

### 2.4 Success envelope

```json
{
  "success": true,
  "data": {},
  "meta": {
    "page": 1,
    "limit": 12,
    "totalItems": 120,
    "totalPages": 10
  },
  "message": "OK"
}
```

### 2.5 Error envelope

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu gửi lên không hợp lệ.",
    "details": "Một hoặc nhiều field chưa đúng định dạng.",
    "fieldErrors": {
      "email": "Email không hợp lệ",
      "password": "Mật khẩu phải có ít nhất 6 ký tự"
    }
  }
}
```

### 2.6 Quy ước phân trang, lọc, sắp xếp

- Query chung:
  - `page`: số trang, bắt đầu từ `1`
  - `limit`: số bản ghi mỗi trang
  - `search`: keyword tìm kiếm
  - `sort`: khóa sắp xếp, ví dụ `popular`, `newest`, `price-asc`, `price-desc`
- Query riêng theo frontend hiện tại:
  - `categories`: danh sách category id, phân tách bằng dấu phẩy
  - `regions`: danh sách region id, phân tách bằng dấu phẩy
  - `price`: giá trần
  - `ratingMin`: số sao tối thiểu
  - `period`: `all` hoặc `last30`
  - `deliveryStatus`, `paymentStatus`, `status`, `priority`, `channel`, `format` khi cần

Ví dụ:

```text
GET /api/v1/products?search=tra&categories=cat-tea-coffee&regions=region-tay-bac&price=500000&ratingMin=4&sort=popular&page=1&limit=12
```

### 2.7 Upload và export

- Upload avatar dùng `multipart/form-data` với field file là `avatar`.
- Export file trả về:
  - `Content-Disposition: attachment; filename="<name>"`
  - `Content-Type: application/json` hoặc `text/csv`

## 3. Enum và luật trạng thái

### 3.1 User role

- `customer`
- `admin`
- `supplier`
- `warehouse`

### 3.2 Payment status

- `pending`
- `paid`
- `cod`
- `refunded`

### 3.3 Delivery status

- `processing`
- `ready_to_ship`
- `in_transit`
- `delivered`
- `disputed`

### 3.4 Shipping tier

- `standard`
- `express`
- `priority`

### 3.5 Product stock status

- `in-stock`
- `low-stock`
- `preorder`

### 3.6 Inventory health

- `healthy`
- `low`
- `critical`

### 3.7 Requisition status

- `draft`
- `submitted`
- `approved`
- `received`
- `cancelled`

### 3.8 Fulfillment status

- `picking`
- `packing`
- `awaiting_pickup`
- `shipped`

### 3.9 Trạng thái phụ trợ khác

- `SupportTicket.status`: `open` | `resolved`
- `SupplierInvitation.status`: `draft` | `sent`
- `Complaint.status`: `open` | `resolved`
- `Customer.status`: `loyal` | `new` | `at-risk`
- `Supplier.status`: `active` | `reviewing`

### 3.10 Luật chuyển trạng thái

- Order:
  - `processing -> ready_to_ship -> in_transit -> delivered`
  - Khi khách tạo khiếu nại: `* -> disputed`
  - Khi admin xử lý xong khiếu nại: `disputed -> previousDeliveryStatus`
- Requisition:
  - Khi kho tạo phiếu: mặc định tạo ở `submitted`
  - `submitted -> approved -> received`
  - `submitted|approved -> cancelled`
- Fulfillment:
  - `picking -> packing -> awaiting_pickup -> shipped`

## 4. DTO chính

### 4.1 AuthSession

| Field | Type | Bắt buộc | Ghi chú |
| --- | --- | --- | --- |
| `accessToken` | `string` | Có | JWT hoặc opaque token |
| `refreshToken` | `string` | Có | token refresh |
| `expiresAt` | `string` | Có | ISO 8601 |
| `session.user.id` | `string` | Có | id user |
| `session.user.name` | `string` | Có | tên hiển thị |
| `session.user.email` | `string` | Có | email đăng nhập |
| `session.user.role` | `UserRole` | Có | role cho `RouteGuard` |
| `session.user.organizationId` | `string` | Không | scope supplier hoặc warehouse |
| `session.user.organizationName` | `string` | Không | tên đơn vị |
| `session.loggedInAt` | `string` | Có | ISO 8601 |
| `defaultRoute` | `string` | Có | route gợi ý sau login |

### 4.2 ProductSummary

| Field | Type |
| --- | --- |
| `id`, `slug`, `name`, `detailTitle` | `string` |
| `shortDescription`, `categoryId`, `categoryName` | `string` |
| `regionId`, `regionName` | `string` |
| `price`, `originalPrice`, `rating`, `reviewCount` | `number` |
| `stockStatus` | `ProductStockStatus` |
| `badge`, `tag`, `image` | `string` |

### 4.3 ProductDetail

`ProductDetail` kế thừa `ProductSummary` và bổ sung:

- `subtitle: string`
- `description: string`
- `gallery: Array<{ src: string; alt: string }>`
- `origin: string`
- `weight: string`
- `shelfLife: string`
- `certifications: string[]`
- `shippingNotice: { title: string; description: string }`
- `sourcing: { title: string; body: string; certificationCards: Array<{ icon: string; title: string; description: string }> }`
- `heritageCommitments: Array<{ icon: string; text: string }>`

### 4.4 Review

- `id: string`
- `productId: string`
- `author: string`
- `rating: number`
- `title: string`
- `body: string`
- `date: string`
- `verified: boolean`
- `media?: Array<{ src: string; alt: string }>`

### 4.5 Cart

- `items: Array<{ productId: string; productSlug: string; productName: string; image: string; stockStatus: ProductStockStatus; quantity: number; unitPrice: number; lineTotal: number }>`
- `totalItems: number`
- `subtotal: number`

### 4.6 Order

- `id: string`
- `customerId?: string`
- `customerName: string`
- `supplierId?: string`
- `supplierName: string`
- `date: string`
- `total: number`
- `paymentStatus: PaymentStatus`
- `deliveryStatus: DeliveryStatus`
- `shippingTier: ShippingTier`
- `address: string`
- `note?: string`
- `assignedWarehouseZone?: string`
- `items: Array<{ productId: string; productSlug: string; productName: string; image: string; quantity: number; unitPrice: number; lineTotal: number }>`
- `timeline: Array<{ id: string; orderId: string; label: string; timestamp: string; completed: boolean }>`
- `statusHistory: Array<{ id: string; actor: string; label: string; createdAt: string }>`
- `complaintIds: string[]`

### 4.7 Complaint

- `id: string`
- `orderId: string`
- `reason: string`
- `message: string`
- `createdAt: string`
- `status: "open" | "resolved"`
- `orderSnapshotTotal: number`
- `previousDeliveryStatus: DeliveryStatus`
- `resolutionNote?: string`
- `orderSummary: { id: string; total: number; deliveryStatus: DeliveryStatus; supplierName: string }`
- `customerSummary: { id?: string; name: string; email?: string }`

### 4.8 UserProfile

- `id: string`
- `name: string`
- `email: string`
- `phone: string`
- `address: string`
- `city: string`
- `favoriteRegion: string`
- `avatar: string`
- `memberSince: string`
- `newsletter: boolean`
- `smsAlerts: boolean`
- `orderEmail: boolean`
- `securityAlerts: boolean`
- `addresses: UserAddress[]`
- `rewardHistory: Array<{ id: string; title: string; pointsUsed: number; createdAt: string; status: "completed" | "pending" }>`

### 4.9 UserAddress

- `id: string`
- `label: string`
- `recipient: string`
- `phone: string`
- `line1: string`
- `city: string`
- `note?: string`
- `isDefault: boolean`

### 4.10 RewardSnapshot

- `tier: string`
- `points: number`
- `nextTierPoints: number`
- `perks: string[]`
- `history: Array<{ id: string; title: string; pointsUsed: number; createdAt: string; status: "completed" | "pending" }>`
- `orderCount: number`

### 4.11 InventoryItem

- `sku: string`
- `onHand: number`
- `reserved: number`
- `reorderPoint: number`
- `purchasePrice: number`
- `aisle: string`
- `status: InventoryHealth`
- `product: { id: string; slug: string; name: string; image: string; regionName: string }`
- `supplier: { id: string; name: string; location: string; partnerTier: string; status: "active" | "reviewing" }`

### 4.12 PurchaseRequisition

- `id: string`
- `inventorySku: string`
- `supplierId: string`
- `requestedQty: number`
- `approvedQty?: number`
- `etaDays: number`
- `status: RequisitionStatus`
- `note?: string`
- `statusHistory: Array<{ id: string; actor: string; label: string; createdAt: string }>`
- `inventoryItem?: InventoryItem`

### 4.13 FulfillmentTask

- `id: string`
- `orderId: string`
- `customerName: string`
- `shippingTier: ShippingTier`
- `status: FulfillmentStatus`
- `priority: "standard" | "rush"`
- `assignedZone: string`
- `etaLabel: string`
- `notes?: string`
- `statusHistory: Array<{ id: string; actor: string; label: string; createdAt: string }>`
- `orderSummary: { id: string; address: string; total: number; deliveryStatus: DeliveryStatus }`

### 4.14 SupportTicket

- `id: string`
- `subject: string`
- `message: string`
- `channel: "supplier" | "warehouse"`
- `createdAt: string`
- `status: "open" | "resolved"`

### 4.15 Customer

- `id: string`
- `name: string`
- `location: string`
- `orders: number`
- `totalSpend: number`
- `status: "loyal" | "new" | "at-risk"`

### 4.16 Supplier

- `id: string`
- `name: string`
- `location: string`
- `contactName: string`
- `categories: string[]`
- `partnerTier: string`
- `monthlyRevenue: number`
- `responseTime: string`
- `status: "active" | "reviewing"`
- `image: string`

### 4.17 SupplierInvitation

- `id: string`
- `supplierName: string`
- `contactName: string`
- `email: string`
- `categories: string[]`
- `note: string`
- `createdAt: string`
- `status: "draft" | "sent"`

### 4.18 DashboardMetrics

- `period: "all" | "last30"`
- `revenue: number`
- `orderCount: number`
- `deliveredCount: number`
- `processingCount: number`
- `averageOrderValue: number`
- `complaintsCount: number`
- `activeSuppliersCount: number`

## 5. Ma trận màn hình -> API

| Nhóm route | Màn hình chính | API cần gọi |
| --- | --- | --- |
| `/`, `/products`, `/products/:slug`, `/regions` | Home, catalog, detail, regions | `GET /products`, `GET /products/{slug}`, `GET /categories`, `GET /regions`, `GET /products/{productId}/reviews`, `POST /products/{productId}/reviews`, `POST /newsletter/subscriptions` |
| `/checkout`, `/checkout/success/:orderId` | Cart + checkout + order success | `GET /cart`, `PUT /cart/items/{productId}`, `DELETE /cart/items/{productId}`, `DELETE /cart`, `POST /promotions/validate`, `POST /orders/preview`, `POST /orders`, `GET /orders/me/{id}` |
| `/account/profile`, `/account/security`, `/account/notifications`, `/account/addresses`, `/account/rewards`, `/account/orders`, `/account/disputes`, `/account/wishlist` | Customer account | `GET/PATCH /account/profile`, `POST /auth/change-password`, CRUD `/account/addresses`, `POST /account/addresses/{id}/default`, `GET/PATCH /account/preferences/notifications`, `GET /account/rewards`, `POST /account/rewards/redemptions`, `GET /orders/me`, `POST /orders/{id}/complaints`, `GET /complaints/me`, `GET /wishlist`, `PUT /wishlist/{productId}`, `DELETE /wishlist/{productId}`, `GET /recently-viewed`, `POST /recently-viewed` |
| `/admin/dashboard`, `/admin/community`, `/admin/repository`, `/admin/logistics`, `/admin/settings` | Admin | `GET /admin/dashboard`, `GET /admin/reports/dashboard/export`, `GET /admin/customers`, `GET /admin/suppliers`, `GET /admin/supplier-invitations`, `POST /admin/supplier-invitations`, CRUD `/admin/catalog/products`, CRUD `/admin/catalog/categories`, `GET /admin/logistics/orders`, `POST /admin/logistics/orders/{id}/handoff`, `POST /admin/logistics/orders/{id}/mark-delivered`, `GET /admin/logistics/complaints`, `POST /admin/logistics/complaints/{id}/resolve`, `GET /admin/system/snapshot`, `POST /admin/system/reset` |
| `/supplier/inventory`, `/supplier/requisitions`, `/supplier/processing`, `/supplier/orders`, `/supplier/help` | Supplier portal | `GET /supplier/inventory`, `GET /supplier/requisitions`, `POST /supplier/requisitions/{id}/approve`, `POST /supplier/requisitions/{id}/receive`, `POST /supplier/requisitions/{id}/cancel`, `GET /supplier/orders`, `POST /supplier/orders/{id}/handoff`, `POST /supplier/orders/{id}/mark-delivered`, `GET/POST /supplier/support-tickets` |
| `/warehouse/inventory`, `/warehouse/requisitions`, `/warehouse/fulfillment`, `/warehouse/supplier-orders`, `/warehouse/help` | Warehouse portal | `GET /warehouse/inventory`, `GET /warehouse/requisitions`, `POST /warehouse/requisitions`, `POST /warehouse/requisitions/{id}/approve`, `POST /warehouse/requisitions/{id}/receive`, `POST /warehouse/requisitions/{id}/cancel`, `GET /warehouse/fulfillment-tasks`, `POST /warehouse/fulfillment-tasks/{id}/advance`, `GET /warehouse/supplier-orders`, `GET/POST /warehouse/support-tickets`, `POST /warehouse/support-tickets/{id}/resolve` |
| `/login`, `/logout`, route guard | Auth | `POST /auth/login`, `GET /auth/me`, `POST /auth/refresh`, `POST /auth/logout` |

## 6. Auth và session

### 6.1 `POST /auth/login`

- Priority: `Required`
- Mục đích: đăng nhập bằng email và password.
- Role được gọi: `public`
- Request body:
  - `email: string`
  - `password: string`
- Response `data`: `AuthSession`
- Lỗi chính:
  - `AUTH_INVALID_CREDENTIALS`
  - `AUTH_ACCOUNT_DISABLED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "accessToken": "access-token-demo",
    "refreshToken": "refresh-token-demo",
    "expiresAt": "2026-04-08T12:00:00Z",
    "defaultRoute": "/account/profile",
    "session": {
      "user": {
        "id": "demo-customer",
        "name": "Khách hàng demo",
        "email": "minh.nguyen@example.com",
        "role": "customer"
      },
      "loggedInAt": "2026-04-08T10:00:00Z"
    }
  },
  "message": "Đăng nhập thành công."
}
```

### 6.2 `GET /auth/me`

- Priority: `Required`
- Mục đích: lấy session hiện tại để hydrate app khi reload.
- Role được gọi: đã đăng nhập
- Response `data`: `session`, `defaultRoute`
- Lỗi chính:
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "defaultRoute": "/admin/dashboard",
    "session": {
      "user": {
        "id": "demo-admin",
        "name": "Quản trị demo",
        "email": "admin@heritage.local",
        "role": "admin"
      },
      "loggedInAt": "2026-04-08T09:30:00Z"
    }
  }
}
```

### 6.3 `POST /auth/refresh`

- Priority: `Required`
- Mục đích: đổi refresh token lấy access token mới.
- Role được gọi: `public`
- Request body:
  - `refreshToken: string`
- Response `data`:
  - `accessToken`
  - `refreshToken`
  - `expiresAt`
- Lỗi chính:
  - `AUTH_REFRESH_INVALID`
  - `AUTH_REFRESH_EXPIRED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "accessToken": "new-access-token",
    "refreshToken": "new-refresh-token",
    "expiresAt": "2026-04-08T14:00:00Z"
  },
  "message": "Token đã được làm mới."
}
```

### 6.4 `POST /auth/logout`

- Priority: `Required`
- Mục đích: huỷ session hiện tại.
- Role được gọi: đã đăng nhập
- Request body:
  - `refreshToken?: string`
- Response `data`:
  - `loggedOut: true`
- Lỗi chính:
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "loggedOut": true
  },
  "message": "Đăng xuất thành công."
}
```

### 6.5 `POST /auth/change-password`

- Priority: `Required`
- Mục đích: đổi mật khẩu tài khoản hiện tại.
- Role được gọi: đã đăng nhập
- Request body:
  - `currentPassword: string`
  - `nextPassword: string`
  - `confirmPassword: string`
- Response `data`:
  - `changed: true`
  - `changedAt: string`
- Lỗi chính:
  - `AUTH_CURRENT_PASSWORD_INVALID`
  - `AUTH_PASSWORD_TOO_WEAK`
  - `VALIDATION_ERROR`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "changed": true,
    "changedAt": "2026-04-08T10:45:00Z"
  },
  "message": "Mật khẩu đã được cập nhật."
}
```

## 7. Catalog và storefront public

### 7.1 `GET /products`

- Priority: `Required`
- Mục đích: danh sách sản phẩm cho home, catalog, lọc vùng miền, tìm kiếm.
- Role được gọi: `public`
- Query:
  - `search?: string`
  - `categories?: string`
  - `regions?: string`
  - `price?: number`
  - `ratingMin?: number`
  - `sort?: popular | newest | price-asc | price-desc`
  - `page?: number`
  - `limit?: number`
- Response `data`:
  - `items: ProductSummary[]`
- Response `meta`:
  - `page`, `limit`, `totalItems`, `totalPages`
- Lỗi chính:
  - `VALIDATION_ERROR`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "prod-tra-tan-cuong",
        "slug": "tra-tan-cuong-thai-nguyen",
        "name": "Trà Tân Cương Thái Nguyên",
        "detailTitle": "Trà Tân Cương Thái Nguyên - Loại Thượng Hạng",
        "shortDescription": "Hương cốm non, vị chát nhẹ và hậu vị ngọt thanh.",
        "categoryId": "cat-tea-coffee",
        "categoryName": "Trà & Cà phê",
        "regionId": "region-tay-bac",
        "regionName": "Tây Bắc",
        "price": 450000,
        "originalPrice": 560000,
        "rating": 4.9,
        "reviewCount": 128,
        "stockStatus": "in-stock",
        "badge": "Thượng Hạng",
        "tag": "Thái Nguyên",
        "image": "https://example.com/products/tea.jpg"
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 12,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

### 7.2 `GET /products/{slug}`

- Priority: `Required`
- Mục đích: lấy chi tiết sản phẩm cho trang detail.
- Role được gọi: `public`
- Path:
  - `slug: string`
- Response `data`: `ProductDetail`
- Lỗi chính:
  - `PRODUCT_NOT_FOUND`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "id": "prod-tra-tan-cuong",
    "slug": "tra-tan-cuong-thai-nguyen",
    "name": "Trà Tân Cương Thái Nguyên",
    "detailTitle": "Trà Tân Cương Thái Nguyên - Loại Thượng Hạng",
    "subtitle": "Loại thượng hạng, hậu vị ngọt sâu",
    "shortDescription": "Hương cốm non, vị chát nhẹ và hậu vị ngọt thanh.",
    "description": "Lá trà non được thu hái sớm, sao bằng tay...",
    "categoryId": "cat-tea-coffee",
    "categoryName": "Trà & Cà phê",
    "regionId": "region-tay-bac",
    "regionName": "Tây Bắc",
    "price": 450000,
    "rating": 4.9,
    "reviewCount": 128,
    "stockStatus": "in-stock",
    "badge": "Thượng Hạng",
    "image": "https://example.com/products/tea.jpg",
    "gallery": [
      {
        "src": "https://example.com/products/tea-1.jpg",
        "alt": "Trà Tân Cương"
      }
    ],
    "origin": "Thái Nguyên, Việt Nam",
    "weight": "500g",
    "shelfLife": "12 tháng",
    "certifications": ["OCOP 4 Sao", "VietGAP"],
    "shippingNotice": {
      "title": "Giao hàng miễn phí",
      "description": "Cho đơn hàng trên 1.000.000 VND."
    },
    "sourcing": {
      "title": "Vùng nguyên liệu & Quy trình",
      "body": "Trà được thu hái thủ công...",
      "certificationCards": [
        {
          "icon": "verified",
          "title": "Chứng nhận VietGAP",
          "description": "Đảm bảo quy trình canh tác an toàn."
        }
      ]
    },
    "heritageCommitments": [
      {
        "icon": "eco",
        "text": "100% tự nhiên"
      }
    ]
  }
}
```

### 7.3 `GET /categories`

- Priority: `Required`
- Mục đích: lấy danh mục cho home và catalog filter.
- Role được gọi: `public`
- Response `data`:
  - `items: Array<{ id: string; name: string; description: string; productsCount?: number }>`
- Lỗi chính:
  - `NONE`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "cat-tea-coffee",
        "name": "Trà & Cà phê",
        "description": "Những mẻ trà, cà phê tuyển chọn từ miền núi và cao nguyên.",
        "productsCount": 2
      }
    ]
  }
}
```

### 7.4 `GET /regions`

- Priority: `Required`
- Mục đích: lấy vùng nguyên liệu cho home, regions page và catalog filter.
- Role được gọi: `public`
- Response `data`:
  - `items: Array<{ id: string; name: string; description: string; productsCount?: number; featuredProduct?: ProductSummary }>`
- Lỗi chính:
  - `NONE`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "region-tay-bac",
        "name": "Tây Bắc",
        "description": "Nơi những đồi trà, mật ong rừng và gia vị núi cao hội tụ.",
        "productsCount": 2,
        "featuredProduct": {
          "id": "prod-tra-tan-cuong",
          "slug": "tra-tan-cuong-thai-nguyen",
          "name": "Trà Tân Cương Thái Nguyên",
          "detailTitle": "Trà Tân Cương Thái Nguyên - Loại Thượng Hạng",
          "shortDescription": "Hương cốm non, vị chát nhẹ và hậu vị ngọt thanh.",
          "categoryId": "cat-tea-coffee",
          "categoryName": "Trà & Cà phê",
          "regionId": "region-tay-bac",
          "regionName": "Tây Bắc",
          "price": 450000,
          "rating": 4.9,
          "reviewCount": 128,
          "stockStatus": "in-stock",
          "image": "https://example.com/products/tea.jpg"
        }
      }
    ]
  }
}
```

### 7.5 `GET /products/{productId}/reviews`

- Priority: `Required`
- Mục đích: lấy danh sách đánh giá cho trang chi tiết sản phẩm.
- Role được gọi: `public`
- Path:
  - `productId: string`
- Query:
  - `page?: number`
  - `limit?: number`
  - `sort?: newest | highest-rating`
- Response `data`:
  - `items: Review[]`
  - `summary: { averageRating: number; reviewCount: number }`
- Lỗi chính:
  - `PRODUCT_NOT_FOUND`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "rev-1",
        "productId": "prod-tra-tan-cuong",
        "author": "Nguyễn Hùng",
        "rating": 5,
        "title": "Hương trà rất sạch",
        "body": "Trà rất thơm, nước xanh trong.",
        "date": "2026-03-15",
        "verified": true,
        "media": [
          {
            "src": "https://example.com/reviews/rev-1.jpg",
            "alt": "Ảnh đánh giá trà"
          }
        ]
      }
    ],
    "summary": {
      "averageRating": 4.9,
      "reviewCount": 128
    }
  }
}
```

### 7.6 `POST /products/{productId}/reviews`

- Priority: `Required`
- Mục đích: tạo đánh giá mới cho sản phẩm.
- Role được gọi: `customer`
- Path:
  - `productId: string`
- Request body:
  - `rating: number`
  - `title: string`
  - `body: string`
  - `media?: Array<{ src: string; alt: string }>`
- Rule backend bắt buộc:
  - user phải có ít nhất 1 đơn `delivered` chứa `productId`
- Response `data`:
  - `review: Review`
  - `productRating: { rating: number; reviewCount: number }`
- Lỗi chính:
  - `PRODUCT_NOT_FOUND`
  - `REVIEW_NOT_ALLOWED`
  - `VALIDATION_ERROR`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "review": {
      "id": "rev-100",
      "productId": "prod-tra-tan-cuong",
      "author": "Minh Nguyễn",
      "rating": 5,
      "title": "Pha lần hai vẫn ngon",
      "body": "Mùi hương rất ổn định và hậu vị sạch.",
      "date": "2026-04-08",
      "verified": true
    },
    "productRating": {
      "rating": 4.9,
      "reviewCount": 129
    }
  },
  "message": "Đánh giá đã được ghi nhận."
}
```

### 7.7 `POST /newsletter/subscriptions`

- Priority: `Required`
- Mục đích: lưu đăng ký newsletter từ home hoặc footer.
- Role được gọi: `public`
- Request body:
  - `email: string`
  - `source: string`
- Response `data`:
  - `id`
  - `email`
  - `source`
  - `createdAt`
- Lỗi chính:
  - `VALIDATION_ERROR`
  - `NEWSLETTER_ALREADY_SUBSCRIBED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "id": "newsletter-1",
    "email": "minh.nguyen@example.com",
    "source": "home-hero",
    "createdAt": "2026-04-08T10:10:00Z"
  },
  "message": "Đăng ký bản tin thành công."
}
```

## 8. Shopping sync và checkout

### 8.1 `GET /cart`

- Priority: `Recommended`
- Mục đích: lấy giỏ hàng đồng bộ theo tài khoản.
- Role được gọi: `customer`
- Response `data`: `Cart`
- Lỗi chính:
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "productId": "prod-st25",
        "productSlug": "gao-st25-song-hau",
        "productName": "Gạo ST25 Sông Hậu",
        "image": "https://example.com/products/rice.jpg",
        "stockStatus": "in-stock",
        "quantity": 2,
        "unitPrice": 180000,
        "lineTotal": 360000
      }
    ],
    "totalItems": 2,
    "subtotal": 360000
  }
}
```

### 8.2 `PUT /cart/items/{productId}`

- Priority: `Recommended`
- Mục đích: upsert số lượng một sản phẩm trong giỏ.
- Role được gọi: `customer`
- Path:
  - `productId: string`
- Request body:
  - `quantity: number`
- Response `data`:
  - `cart: Cart`
- Lỗi chính:
  - `PRODUCT_NOT_FOUND`
  - `CART_QUANTITY_INVALID`
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "cart": {
      "items": [
        {
          "productId": "prod-st25",
          "productSlug": "gao-st25-song-hau",
          "productName": "Gạo ST25 Sông Hậu",
          "image": "https://example.com/products/rice.jpg",
          "stockStatus": "in-stock",
          "quantity": 3,
          "unitPrice": 180000,
          "lineTotal": 540000
        }
      ],
      "totalItems": 3,
      "subtotal": 540000
    }
  },
  "message": "Giỏ hàng đã được cập nhật."
}
```

### 8.3 `DELETE /cart/items/{productId}`

- Priority: `Recommended`
- Mục đích: xoá một sản phẩm khỏi giỏ.
- Role được gọi: `customer`
- Response `data`:
  - `cart: Cart`
- Lỗi chính:
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "cart": {
      "items": [],
      "totalItems": 0,
      "subtotal": 0
    }
  },
  "message": "Đã xoá sản phẩm khỏi giỏ hàng."
}
```

### 8.4 `DELETE /cart`

- Priority: `Recommended`
- Mục đích: xoá toàn bộ giỏ hàng sau checkout hoặc khi người dùng muốn clear.
- Role được gọi: `customer`
- Response `data`:
  - `cleared: true`
- Lỗi chính:
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "cleared": true
  },
  "message": "Giỏ hàng đã được làm trống."
}
```

### 8.5 `GET /wishlist`

- Priority: `Recommended`
- Mục đích: lấy danh sách wishlist.
- Role được gọi: `customer`
- Response `data`:
  - `items: ProductSummary[]`
  - `totalItems: number`
- Lỗi chính:
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "prod-tra-tan-cuong",
        "slug": "tra-tan-cuong-thai-nguyen",
        "name": "Trà Tân Cương Thái Nguyên",
        "detailTitle": "Trà Tân Cương Thái Nguyên - Loại Thượng Hạng",
        "shortDescription": "Hương cốm non, vị chát nhẹ và hậu vị ngọt thanh.",
        "categoryId": "cat-tea-coffee",
        "categoryName": "Trà & Cà phê",
        "regionId": "region-tay-bac",
        "regionName": "Tây Bắc",
        "price": 450000,
        "rating": 4.9,
        "reviewCount": 128,
        "stockStatus": "in-stock",
        "image": "https://example.com/products/tea.jpg"
      }
    ],
    "totalItems": 1
  }
}
```

### 8.6 `PUT /wishlist/{productId}`

- Priority: `Recommended`
- Mục đích: thêm sản phẩm vào wishlist.
- Role được gọi: `customer`
- Response `data`:
  - `productId`
  - `wishlisted: true`
  - `totalItems`
- Lỗi chính:
  - `PRODUCT_NOT_FOUND`
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "productId": "prod-tra-tan-cuong",
    "wishlisted": true,
    "totalItems": 3
  },
  "message": "Đã thêm vào wishlist."
}
```

### 8.7 `DELETE /wishlist/{productId}`

- Priority: `Recommended`
- Mục đích: xoá sản phẩm khỏi wishlist.
- Role được gọi: `customer`
- Response `data`:
  - `productId`
  - `wishlisted: false`
  - `totalItems`
- Lỗi chính:
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "productId": "prod-tra-tan-cuong",
    "wishlisted": false,
    "totalItems": 2
  },
  "message": "Đã xoá khỏi wishlist."
}
```

### 8.8 `GET /recently-viewed`

- Priority: `Recommended`
- Mục đích: lấy danh sách sản phẩm vừa xem.
- Role được gọi: `customer`
- Response `data`:
  - `items: ProductSummary[]`
- Lỗi chính:
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "prod-mat-ong",
        "slug": "mat-ong-rung-tay-bac",
        "name": "Mật ong rừng Tây Bắc",
        "detailTitle": "Mật ong rừng Tây Bắc - Nguyên Chất",
        "shortDescription": "Dùng cho trà nóng hoặc quà tặng thiên nhiên.",
        "categoryId": "cat-spice",
        "categoryName": "Gia vị",
        "regionId": "region-tay-bac",
        "regionName": "Tây Bắc",
        "price": 320000,
        "rating": 4.7,
        "reviewCount": 68,
        "stockStatus": "low-stock",
        "image": "https://example.com/products/honey.jpg"
      }
    ]
  }
}
```

### 8.9 `POST /recently-viewed`

- Priority: `Recommended`
- Mục đích: upsert sản phẩm vừa xem và giữ thứ tự mới nhất.
- Role được gọi: `customer`
- Request body:
  - `productId: string`
- Rule backend:
  - dedupe
  - giữ tối đa `6` item mới nhất
- Response `data`:
  - `items: ProductSummary[]`
- Lỗi chính:
  - `PRODUCT_NOT_FOUND`
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "prod-tra-tan-cuong",
        "slug": "tra-tan-cuong-thai-nguyen",
        "name": "Trà Tân Cương Thái Nguyên",
        "detailTitle": "Trà Tân Cương Thái Nguyên - Loại Thượng Hạng",
        "shortDescription": "Hương cốm non, vị chát nhẹ và hậu vị ngọt thanh.",
        "categoryId": "cat-tea-coffee",
        "categoryName": "Trà & Cà phê",
        "regionId": "region-tay-bac",
        "regionName": "Tây Bắc",
        "price": 450000,
        "rating": 4.9,
        "reviewCount": 128,
        "stockStatus": "in-stock",
        "image": "https://example.com/products/tea.jpg"
      }
    ]
  }
}
```

### 8.10 `POST /promotions/validate`

- Priority: `Recommended`
- Mục đích: validate mã giảm giá khi user nhập ở checkout.
- Role được gọi: `customer`
- Request body:
  - `promoCode: string`
  - `items: Array<{ productId: string; quantity: number }>`
  - `shippingTier: ShippingTier`
- Response `data`:
  - `valid: boolean`
  - `code: string`
  - `label?: string`
  - `type?: "subtotal" | "shipping"`
  - `discountAmount?: number`
  - `message?: string`
- Lỗi chính:
  - `PROMOTION_INVALID`
  - `PROMOTION_EXPIRED`
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "valid": true,
    "code": "FREESHIP",
    "label": "Miễn phí vận chuyển",
    "type": "shipping",
    "discountAmount": 45000,
    "message": "Mã giảm giá hợp lệ."
  }
}
```

### 8.11 `POST /orders/preview`

- Priority: `Recommended`
- Mục đích: tính trước subtotal, shipping, discount, total trước khi tạo đơn.
- Role được gọi: `customer`
- Request body:
  - `shippingContact: { name: string; phone: string; email: string; city: string; address: string; note?: string }`
  - `items: Array<{ productId: string; quantity: number }>`
  - `shippingTier: ShippingTier`
  - `paymentMethod: "cod" | "card" | "banking"`
  - `promoCode?: string`
- Response `data`:
  - `items: Cart.items`
  - `pricing: { subtotal: number; shipping: number; discount: number; total: number }`
  - `promotion?: { code: string; label: string; discountAmount: number }`
  - `warnings?: string[]`
- Lỗi chính:
  - `PRODUCT_NOT_FOUND`
  - `CART_EMPTY`
  - `VALIDATION_ERROR`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "productId": "prod-st25",
        "productSlug": "gao-st25-song-hau",
        "productName": "Gạo ST25 Sông Hậu",
        "image": "https://example.com/products/rice.jpg",
        "stockStatus": "in-stock",
        "quantity": 2,
        "unitPrice": 180000,
        "lineTotal": 360000
      }
    ],
    "pricing": {
      "subtotal": 360000,
      "shipping": 45000,
      "discount": 45000,
      "total": 360000
    },
    "promotion": {
      "code": "FREESHIP",
      "label": "Miễn phí vận chuyển",
      "discountAmount": 45000
    }
  }
}
```

### 8.12 `POST /orders`

- Priority: `Required`
- Mục đích: tạo đơn hàng mới từ checkout.
- Role được gọi: `customer`
- Request body:
  - `shippingContact: { name: string; phone: string; email: string; city: string; address: string; note?: string }`
  - `items: Array<{ productId: string; quantity: number }>`
  - `shippingTier: ShippingTier`
  - `paymentMethod: "cod" | "card" | "banking"`
  - `promoCode?: string`
- Quy tắc backend:
  - tự resolve `supplierId`, `supplierName`
  - tự tạo `timeline`
  - tự tạo `statusHistory`
  - tự gắn `assignedWarehouseZone`
  - nếu luồng hệ thống cần, phải tạo luôn fulfillment task tương ứng
- Response `data`: `Order`
- Lỗi chính:
  - `PRODUCT_NOT_FOUND`
  - `CART_EMPTY`
  - `ORDER_OUT_OF_STOCK`
  - `PROMOTION_INVALID`
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "id": "HH-22050",
    "customerId": "demo-customer",
    "customerName": "Minh Nguyễn",
    "supplierId": "sup-thai-nguyen",
    "supplierName": "Hợp tác xã Trà Thái Nguyên",
    "date": "2026-04-08T10:20:00Z",
    "total": 980000,
    "paymentStatus": "cod",
    "deliveryStatus": "processing",
    "shippingTier": "standard",
    "address": "12 Trần Hưng Đạo, Quận 1, Thành phố Hồ Chí Minh",
    "note": "Giao sau 18h nếu có thể.",
    "assignedWarehouseZone": "Khu B",
    "complaintIds": [],
    "items": [
      {
        "productId": "prod-tra-tan-cuong",
        "productSlug": "tra-tan-cuong-thai-nguyen",
        "productName": "Trà Tân Cương Thái Nguyên",
        "image": "https://example.com/products/tea.jpg",
        "quantity": 1,
        "unitPrice": 450000,
        "lineTotal": 450000
      }
    ],
    "timeline": [
      {
        "id": "HH-22050-timeline-1",
        "orderId": "HH-22050",
        "label": "Đơn hàng đã được tạo",
        "timestamp": "2026-04-08T10:20:00Z",
        "completed": true
      }
    ],
    "statusHistory": [
      {
        "id": "HH-22050-status-created",
        "actor": "customer",
        "label": "Khởi tạo đơn hàng mới",
        "createdAt": "2026-04-08T10:20:00Z"
      }
    ]
  },
  "message": "Đơn hàng đã được tạo."
}
```

## 9. Customer account

### 9.1 `GET /orders/me`

- Priority: `Required`
- Mục đích: lấy danh sách đơn của khách hàng hiện tại.
- Role được gọi: `customer`
- Query:
  - `search?: string`
  - `deliveryStatus?: DeliveryStatus`
  - `page?: number`
  - `limit?: number`
- Response `data`:
  - `items: Order[]`
- Lỗi chính:
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "HH-21012",
        "customerId": "demo-customer",
        "customerName": "Minh Nguyễn",
        "supplierId": "sup-thai-nguyen",
        "supplierName": "Hợp tác xã Trà Thái Nguyên",
        "date": "2026-04-01T08:10:00Z",
        "total": 980000,
        "paymentStatus": "cod",
        "deliveryStatus": "in_transit",
        "shippingTier": "standard",
        "address": "12 Trần Hưng Đạo, Quận 1, Thành phố Hồ Chí Minh",
        "items": [],
        "timeline": [],
        "statusHistory": [],
        "complaintIds": []
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 10,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

### 9.2 `GET /orders/me/{id}`

- Priority: `Required`
- Mục đích: lấy chi tiết một đơn cho order success và account orders.
- Role được gọi: `customer`
- Response `data`: `Order`
- Lỗi chính:
  - `ORDER_NOT_FOUND`
  - `AUTH_FORBIDDEN`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "id": "HH-21012",
    "customerId": "demo-customer",
    "customerName": "Minh Nguyễn",
    "supplierId": "sup-thai-nguyen",
    "supplierName": "Hợp tác xã Trà Thái Nguyên",
    "date": "2026-04-01T08:10:00Z",
    "total": 980000,
    "paymentStatus": "cod",
    "deliveryStatus": "in_transit",
    "shippingTier": "standard",
    "address": "12 Trần Hưng Đạo, Quận 1, Thành phố Hồ Chí Minh",
    "items": [
      {
        "productId": "prod-tra-tan-cuong",
        "productSlug": "tra-tan-cuong-thai-nguyen",
        "productName": "Trà Tân Cương Thái Nguyên",
        "image": "https://example.com/products/tea.jpg",
        "quantity": 1,
        "unitPrice": 450000,
        "lineTotal": 450000
      }
    ],
    "timeline": [
      {
        "id": "track-21012-1",
        "orderId": "HH-21012",
        "label": "Đã đặt hàng",
        "timestamp": "2026-04-01T08:10:00Z",
        "completed": true
      }
    ],
    "statusHistory": [],
    "complaintIds": []
  }
}
```

### 9.3 `POST /orders/{id}/complaints`

- Priority: `Required`
- Mục đích: tạo khiếu nại từ trang account orders.
- Role được gọi: `customer`
- Request body:
  - `reason: string`
  - `message: string`
- Response `data`: `Complaint`
- Lỗi chính:
  - `ORDER_NOT_FOUND`
  - `AUTH_FORBIDDEN`
  - `VALIDATION_ERROR`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "id": "CMP-1",
    "orderId": "HH-21012",
    "reason": "Giao hàng chậm hơn dự kiến",
    "message": "Nhờ cửa hàng cập nhật giúp mình thời gian giao hàng mới cho đơn này.",
    "createdAt": "2026-04-08T10:30:00Z",
    "status": "open",
    "orderSnapshotTotal": 980000,
    "previousDeliveryStatus": "in_transit",
    "orderSummary": {
      "id": "HH-21012",
      "total": 980000,
      "deliveryStatus": "disputed",
      "supplierName": "Hợp tác xã Trà Thái Nguyên"
    },
    "customerSummary": {
      "id": "demo-customer",
      "name": "Minh Nguyễn",
      "email": "minh.nguyen@example.com"
    }
  },
  "message": "Khiếu nại đã được tạo."
}
```

### 9.4 `GET /complaints/me`

- Priority: `Required`
- Mục đích: danh sách khiếu nại của khách đang đăng nhập.
- Role được gọi: `customer`
- Response `data`:
  - `items: Complaint[]`
- Lỗi chính:
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "CMP-1",
        "orderId": "HH-21012",
        "reason": "Giao hàng chậm hơn dự kiến",
        "message": "Nhờ cửa hàng cập nhật thời gian giao mới.",
        "createdAt": "2026-04-08T10:30:00Z",
        "status": "open",
        "orderSnapshotTotal": 980000,
        "previousDeliveryStatus": "in_transit",
        "orderSummary": {
          "id": "HH-21012",
          "total": 980000,
          "deliveryStatus": "disputed",
          "supplierName": "Hợp tác xã Trà Thái Nguyên"
        },
        "customerSummary": {
          "id": "demo-customer",
          "name": "Minh Nguyễn",
          "email": "minh.nguyen@example.com"
        }
      }
    ]
  }
}
```

### 9.5 `GET /account/profile`

- Priority: `Required`
- Mục đích: hydrate profile page và checkout form.
- Role được gọi: `customer`
- Response `data`: `UserProfile`
- Lỗi chính:
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "id": "user-minh-nguyen",
    "name": "Minh Nguyễn",
    "email": "minh.nguyen@example.com",
    "phone": "+84 912 345 678",
    "address": "12 Trần Hưng Đạo, Quận 1",
    "city": "Thành phố Hồ Chí Minh",
    "favoriteRegion": "Tây Bắc",
    "avatar": "https://example.com/avatars/minh.jpg",
    "memberSince": "2023-10-01",
    "newsletter": true,
    "smsAlerts": false,
    "orderEmail": true,
    "securityAlerts": true,
    "addresses": [],
    "rewardHistory": []
  }
}
```

### 9.6 `PATCH /account/profile`

- Priority: `Required`
- Mục đích: cập nhật profile cơ bản.
- Role được gọi: `customer`
- Request body: partial của các field sau
  - `name`
  - `phone`
  - `address`
  - `city`
  - `favoriteRegion`
  - `newsletter`
  - `smsAlerts`
  - `orderEmail`
  - `securityAlerts`
- Response `data`: `UserProfile`
- Lỗi chính:
  - `VALIDATION_ERROR`
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "id": "user-minh-nguyen",
    "name": "Minh Nguyễn",
    "email": "minh.nguyen@example.com",
    "phone": "+84 912 345 678",
    "address": "12 Trần Hưng Đạo, Quận 1",
    "city": "Thành phố Hồ Chí Minh",
    "favoriteRegion": "Tây Bắc",
    "avatar": "https://example.com/avatars/minh.jpg",
    "memberSince": "2023-10-01",
    "newsletter": true,
    "smsAlerts": true,
    "orderEmail": true,
    "securityAlerts": true,
    "addresses": [],
    "rewardHistory": []
  },
  "message": "Hồ sơ đã được cập nhật."
}
```

### 9.7 `POST /account/avatar`

- Priority: `Required`
- Mục đích: upload avatar mới.
- Role được gọi: `customer`
- Request:
  - `multipart/form-data`
  - field file: `avatar`
- Response `data`:
  - `avatar: string`
  - `profile: UserProfile`
- Lỗi chính:
  - `FILE_INVALID_TYPE`
  - `FILE_TOO_LARGE`
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "avatar": "https://cdn.example.com/avatars/user-minh-nguyen.png",
    "profile": {
      "id": "user-minh-nguyen",
      "name": "Minh Nguyễn",
      "email": "minh.nguyen@example.com",
      "phone": "+84 912 345 678",
      "address": "12 Trần Hưng Đạo, Quận 1",
      "city": "Thành phố Hồ Chí Minh",
      "favoriteRegion": "Tây Bắc",
      "avatar": "https://cdn.example.com/avatars/user-minh-nguyen.png",
      "memberSince": "2023-10-01",
      "newsletter": true,
      "smsAlerts": false,
      "orderEmail": true,
      "securityAlerts": true,
      "addresses": [],
      "rewardHistory": []
    }
  },
  "message": "Ảnh đại diện đã được cập nhật."
}
```

### 9.8 `DELETE /account/avatar`

- Priority: `Required`
- Mục đích: gỡ avatar hiện tại.
- Role được gọi: `customer`
- Response `data`:
  - `avatar: ""`
  - `profile: UserProfile`
- Lỗi chính:
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "avatar": "",
    "profile": {
      "id": "user-minh-nguyen",
      "name": "Minh Nguyễn",
      "email": "minh.nguyen@example.com",
      "phone": "+84 912 345 678",
      "address": "12 Trần Hưng Đạo, Quận 1",
      "city": "Thành phố Hồ Chí Minh",
      "favoriteRegion": "Tây Bắc",
      "avatar": "",
      "memberSince": "2023-10-01",
      "newsletter": true,
      "smsAlerts": false,
      "orderEmail": true,
      "securityAlerts": true,
      "addresses": [],
      "rewardHistory": []
    }
  },
  "message": "Ảnh đại diện đã được gỡ."
}
```

### 9.9 `GET /account/addresses`

- Priority: `Required`
- Mục đích: lấy sổ địa chỉ.
- Role được gọi: `customer`
- Response `data`:
  - `items: UserAddress[]`
- Lỗi chính:
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "address-home",
        "label": "Nhà riêng",
        "recipient": "Minh Nguyễn",
        "phone": "+84 912 345 678",
        "line1": "12 Trần Hưng Đạo, Quận 1",
        "city": "Thành phố Hồ Chí Minh",
        "note": "Giao sau 18h nếu có thể.",
        "isDefault": true
      }
    ]
  }
}
```

### 9.10 `POST /account/addresses`

- Priority: `Required`
- Mục đích: tạo địa chỉ mới.
- Role được gọi: `customer`
- Request body:
  - `label`
  - `recipient`
  - `phone`
  - `line1`
  - `city`
  - `note?`
- Response `data`:
  - `address: UserAddress`
  - `addresses: UserAddress[]`
- Lỗi chính:
  - `VALIDATION_ERROR`
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "address": {
      "id": "address-2",
      "label": "Văn phòng",
      "recipient": "Minh Nguyễn",
      "phone": "+84 912 345 678",
      "line1": "99 Nguyễn Huệ, Quận 1",
      "city": "Thành phố Hồ Chí Minh",
      "note": "Gọi trước khi giao",
      "isDefault": false
    },
    "addresses": []
  },
  "message": "Địa chỉ mới đã được thêm."
}
```

### 9.11 `PATCH /account/addresses/{id}`

- Priority: `Required`
- Mục đích: cập nhật một địa chỉ.
- Role được gọi: `customer`
- Response `data`:
  - `address: UserAddress`
  - `addresses: UserAddress[]`
- Lỗi chính:
  - `ADDRESS_NOT_FOUND`
  - `VALIDATION_ERROR`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "address": {
      "id": "address-home",
      "label": "Nhà riêng",
      "recipient": "Minh Nguyễn",
      "phone": "+84 912 345 678",
      "line1": "12 Trần Hưng Đạo, Quận 1",
      "city": "Thành phố Hồ Chí Minh",
      "note": "Giao buổi tối",
      "isDefault": true
    },
    "addresses": []
  },
  "message": "Địa chỉ đã được cập nhật."
}
```

### 9.12 `DELETE /account/addresses/{id}`

- Priority: `Required`
- Mục đích: xoá địa chỉ.
- Role được gọi: `customer`
- Rule backend:
  - nếu xoá địa chỉ default và còn địa chỉ khác, tự set địa chỉ đầu tiên còn lại làm default
- Response `data`:
  - `deletedId: string`
  - `addresses: UserAddress[]`
- Lỗi chính:
  - `ADDRESS_NOT_FOUND`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "deletedId": "address-2",
    "addresses": [
      {
        "id": "address-home",
        "label": "Nhà riêng",
        "recipient": "Minh Nguyễn",
        "phone": "+84 912 345 678",
        "line1": "12 Trần Hưng Đạo, Quận 1",
        "city": "Thành phố Hồ Chí Minh",
        "note": "Giao sau 18h nếu có thể.",
        "isDefault": true
      }
    ]
  },
  "message": "Địa chỉ đã được xoá."
}
```

### 9.13 `POST /account/addresses/{id}/default`

- Priority: `Required`
- Mục đích: set địa chỉ mặc định cho checkout.
- Role được gọi: `customer`
- Response `data`:
  - `defaultAddress: UserAddress`
  - `addresses: UserAddress[]`
  - `profileAddress: { address: string; city: string }`
- Lỗi chính:
  - `ADDRESS_NOT_FOUND`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "defaultAddress": {
      "id": "address-home",
      "label": "Nhà riêng",
      "recipient": "Minh Nguyễn",
      "phone": "+84 912 345 678",
      "line1": "12 Trần Hưng Đạo, Quận 1",
      "city": "Thành phố Hồ Chí Minh",
      "note": "Giao sau 18h nếu có thể.",
      "isDefault": true
    },
    "addresses": [],
    "profileAddress": {
      "address": "12 Trần Hưng Đạo, Quận 1",
      "city": "Thành phố Hồ Chí Minh"
    }
  },
  "message": "Địa chỉ mặc định đã được cập nhật."
}
```

### 9.14 `GET /account/preferences/notifications`

- Priority: `Required`
- Mục đích: lấy cấu hình notification.
- Role được gọi: `customer`
- Response `data`:
  - `newsletter`
  - `smsAlerts`
  - `orderEmail`
  - `securityAlerts`
  - `newsletterSubscriptionsCount`
- Lỗi chính:
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "newsletter": true,
    "smsAlerts": false,
    "orderEmail": true,
    "securityAlerts": true,
    "newsletterSubscriptionsCount": 12
  }
}
```

### 9.15 `PATCH /account/preferences/notifications`

- Priority: `Required`
- Mục đích: cập nhật notification preferences.
- Role được gọi: `customer`
- Request body:
  - `newsletter`
  - `smsAlerts`
  - `orderEmail`
  - `securityAlerts`
- Response `data`: giống endpoint `GET`
- Lỗi chính:
  - `VALIDATION_ERROR`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "newsletter": true,
    "smsAlerts": true,
    "orderEmail": true,
    "securityAlerts": true,
    "newsletterSubscriptionsCount": 12
  },
  "message": "Thiết lập thông báo đã được lưu."
}
```

### 9.16 `GET /account/rewards`

- Priority: `Required`
- Mục đích: lấy điểm thưởng, perks và lịch sử đổi thưởng.
- Role được gọi: `customer`
- Response `data`: `RewardSnapshot`
- Lỗi chính:
  - `AUTH_UNAUTHORIZED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "tier": "Ưu đãi Nghệ nhân",
    "points": 2450,
    "nextTierPoints": 3000,
    "perks": [
      "Miễn phí vận chuyển cho mỗi curated box",
      "Ưu tiên tiếp cận các bộ sưu tập theo mùa"
    ],
    "history": [],
    "orderCount": 12
  }
}
```

### 9.17 `POST /account/rewards/redemptions`

- Priority: `Required`
- Mục đích: đổi điểm lấy ưu đãi.
- Role được gọi: `customer`
- Request body:
  - `title: string`
  - `pointsCost: number`
- Response `data`:
  - `redemption: { id: string; title: string; pointsUsed: number; createdAt: string; status: "completed" | "pending" }`
  - `rewardSnapshot: RewardSnapshot`
- Lỗi chính:
  - `INSUFFICIENT_REWARD_POINTS`
  - `VALIDATION_ERROR`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "redemption": {
      "id": "reward-1",
      "title": "Miễn phí vận chuyển đơn kế tiếp",
      "pointsUsed": 300,
      "createdAt": "2026-04-08T10:40:00Z",
      "status": "completed"
    },
    "rewardSnapshot": {
      "tier": "Ưu đãi Nghệ nhân",
      "points": 2150,
      "nextTierPoints": 3000,
      "perks": [
        "Miễn phí vận chuyển cho mỗi curated box",
        "Ưu tiên tiếp cận các bộ sưu tập theo mùa"
      ],
      "history": [],
      "orderCount": 12
    }
  },
  "message": "Đổi thưởng thành công."
}
```

## 10. Admin APIs

### 10.1 `GET /admin/dashboard`

- Priority: `Required`
- Mục đích: dữ liệu tổng hợp cho dashboard admin.
- Role được gọi: `admin`
- Query:
  - `period?: all | last30`
- Response `data`:
  - `metrics: DashboardMetrics`
  - `recentOrders: Order[]`
  - `featuredSuppliers: Supplier[]`
  - `featuredProducts: ProductSummary[]`
- Lỗi chính:
  - `AUTH_FORBIDDEN`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "metrics": {
      "period": "last30",
      "revenue": 32100000,
      "orderCount": 4,
      "deliveredCount": 1,
      "processingCount": 1,
      "averageOrderValue": 8025000,
      "complaintsCount": 2,
      "activeSuppliersCount": 3
    },
    "recentOrders": [],
    "featuredSuppliers": [],
    "featuredProducts": []
  }
}
```

### 10.2 `GET /admin/reports/dashboard/export`

- Priority: `Required`
- Mục đích: export báo cáo dashboard theo filter hiện tại.
- Role được gọi: `admin`
- Query:
  - `period?: all | last30`
  - `format?: json`
- Response:
  - file `application/json`
- Lỗi chính:
  - `AUTH_FORBIDDEN`

Ví dụ nội dung file JSON:

```json
{
  "period": "last30",
  "generatedAt": "2026-04-08T10:50:00Z",
  "totals": {
    "orders": 4,
    "revenue": 32100000
  },
  "orders": [],
  "suppliers": []
}
```

### 10.3 `GET /admin/customers`

- Priority: `Required`
- Mục đích: danh sách customer cho màn hình community.
- Role được gọi: `admin`
- Query:
  - `search?: string`
  - `status?: loyal | new | at-risk`
  - `page?: number`
  - `limit?: number`
- Response `data`:
  - `items: Customer[]`
- Lỗi chính:
  - `AUTH_FORBIDDEN`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "cus-1",
        "name": "Minh Nguyễn",
        "location": "Thành phố Hồ Chí Minh",
        "orders": 12,
        "totalSpend": 18600000,
        "status": "loyal"
      }
    ]
  },
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

### 10.4 `GET /admin/suppliers`

- Priority: `Required`
- Mục đích: danh sách supplier cho community và dashboard.
- Role được gọi: `admin`
- Query:
  - `search?: string`
  - `status?: active | reviewing`
  - `page?: number`
  - `limit?: number`
- Response `data`:
  - `items: Supplier[]`
- Lỗi chính:
  - `AUTH_FORBIDDEN`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "sup-thai-nguyen",
        "name": "Hợp tác xã Trà Thái Nguyên",
        "location": "Thái Nguyên, Việt Nam",
        "contactName": "Minh Nguyễn",
        "categories": ["Trà cao cấp"],
        "partnerTier": "Đối tác bạch kim",
        "monthlyRevenue": 142000000,
        "responseTime": "Phản hồi trong 3 giờ",
        "status": "active",
        "image": "https://example.com/suppliers/thai-nguyen.jpg"
      }
    ]
  }
}
```

### 10.5 `GET /admin/supplier-invitations`

- Priority: `Required`
- Mục đích: lấy danh sách lời mời supplier.
- Role được gọi: `admin`
- Query:
  - `status?: draft | sent`
- Response `data`:
  - `items: SupplierInvitation[]`
- Lỗi chính:
  - `AUTH_FORBIDDEN`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "INV-1",
        "supplierName": "Nông trại Mộc Châu",
        "contactName": "Lan Anh",
        "email": "partner@example.com",
        "categories": ["Trà", "Mật ong"],
        "note": "Mời tham gia đợt mở rộng vùng nguyên liệu.",
        "createdAt": "2026-04-08T10:55:00Z",
        "status": "sent"
      }
    ]
  }
}
```

### 10.6 `POST /admin/supplier-invitations`

- Priority: `Required`
- Mục đích: tạo lời mời supplier mới.
- Role được gọi: `admin`
- Request body:
  - `supplierName: string`
  - `contactName: string`
  - `email: string`
  - `categories: string[]`
  - `note: string`
- Response `data`: `SupplierInvitation`
- Lỗi chính:
  - `VALIDATION_ERROR`
  - `AUTH_FORBIDDEN`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "id": "INV-2",
    "supplierName": "Nông trại Mộc Châu",
    "contactName": "Lan Anh",
    "email": "partner@example.com",
    "categories": ["Trà", "Mật ong"],
    "note": "Mời tham gia đợt mở rộng vùng nguyên liệu.",
    "createdAt": "2026-04-08T10:56:00Z",
    "status": "sent"
  },
  "message": "Lời mời đã được tạo."
}
```

### 10.7 `GET /admin/catalog/products`

- Priority: `Required`
- Mục đích: list sản phẩm cho admin repository.
- Role được gọi: `admin`
- Query:
  - `search?: string`
  - `page?: number`
  - `limit?: number`
- Response `data`:
  - `items: ProductDetail[]`
- Lỗi chính:
  - `AUTH_FORBIDDEN`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "prod-tra-tan-cuong",
        "slug": "tra-tan-cuong-thai-nguyen",
        "name": "Trà Tân Cương Thái Nguyên",
        "detailTitle": "Trà Tân Cương Thái Nguyên - Loại Thượng Hạng",
        "subtitle": "Loại thượng hạng, hậu vị ngọt sâu",
        "shortDescription": "Hương cốm non, vị chát nhẹ và hậu vị ngọt thanh.",
        "description": "Lá trà non được thu hái sớm...",
        "categoryId": "cat-tea-coffee",
        "categoryName": "Trà & Cà phê",
        "regionId": "region-tay-bac",
        "regionName": "Tây Bắc",
        "price": 450000,
        "rating": 4.9,
        "reviewCount": 128,
        "stockStatus": "in-stock",
        "badge": "Thượng Hạng",
        "image": "https://example.com/products/tea.jpg",
        "gallery": [],
        "origin": "Thái Nguyên, Việt Nam",
        "weight": "500g",
        "shelfLife": "12 tháng",
        "certifications": [],
        "shippingNotice": {
          "title": "Giao hàng miễn phí",
          "description": "Cho đơn hàng trên 1.000.000 VND."
        },
        "sourcing": {
          "title": "Vùng nguyên liệu & Quy trình",
          "body": "Trà được thu hái thủ công...",
          "certificationCards": []
        },
        "heritageCommitments": []
      }
    ]
  }
}
```

### 10.8 `POST /admin/catalog/products`

- Priority: `Required`
- Mục đích: tạo sản phẩm mới.
- Role được gọi: `admin`
- Request body:
  - bắt buộc: `name`, `detailTitle`, `categoryId`, `regionId`, `shortDescription`, `description`, `price`
  - tuỳ chọn: `subtitle`, `originalPrice`, `stockStatus`, `badge`, `tag`, `image`, `gallery`, `origin`, `weight`, `shelfLife`, `certifications`, `shippingNotice`, `sourcing`, `heritageCommitments`
- Rule backend:
  - nếu thiếu field tuỳ chọn, backend phải sinh default hợp lý để frontend render được
  - tự sinh `id`, `slug`, `rating = 0`, `reviewCount = 0`
- Response `data`: `ProductDetail`
- Lỗi chính:
  - `CATEGORY_NOT_FOUND`
  - `REGION_NOT_FOUND`
  - `VALIDATION_ERROR`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "id": "prod-custom-1",
    "slug": "tra-san-tuyet-moc-chau",
    "name": "Trà Shan Tuyết Mộc Châu",
    "detailTitle": "Trà Shan Tuyết Mộc Châu - Tuyển Chọn",
    "subtitle": "Mẻ trà mới cho danh mục demo",
    "shortDescription": "Trà núi cao được bổ sung từ khu quản trị.",
    "description": "Thông tin chi tiết nguồn gốc và sản phẩm.",
    "categoryId": "cat-tea-coffee",
    "categoryName": "Trà & Cà phê",
    "regionId": "region-tay-bac",
    "regionName": "Tây Bắc",
    "price": 390000,
    "rating": 0,
    "reviewCount": 0,
    "stockStatus": "in-stock",
    "image": "https://example.com/products/default.jpg",
    "gallery": [],
    "origin": "Tây Bắc",
    "weight": "500g",
    "shelfLife": "12 tháng",
    "certifications": ["Demo"],
    "shippingNotice": {
      "title": "Giao hàng tiêu chuẩn",
      "description": "Sản phẩm mới được thêm từ khu quản trị demo."
    },
    "sourcing": {
      "title": "Thông tin nguồn gốc",
      "body": "Thông tin chi tiết nguồn gốc và sản phẩm.",
      "certificationCards": []
    },
    "heritageCommitments": []
  },
  "message": "Sản phẩm đã được tạo."
}
```

### 10.9 `PATCH /admin/catalog/products/{id}`

- Priority: `Required`
- Mục đích: cập nhật sản phẩm.
- Role được gọi: `admin`
- Request body: partial của `ProductDetail`
- Rule backend:
  - nếu đổi `name`, phải cập nhật lại `slug`
  - nếu đổi `categoryId` hoặc `regionId`, phải trả lại cả `categoryName`, `regionName`
- Response `data`: `ProductDetail`
- Lỗi chính:
  - `PRODUCT_NOT_FOUND`
  - `VALIDATION_ERROR`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "id": "prod-custom-1",
    "slug": "tra-san-tuyet-moc-chau-moi",
    "name": "Trà Shan Tuyết Mộc Châu Mới",
    "detailTitle": "Trà Shan Tuyết Mộc Châu - Tuyển Chọn",
    "subtitle": "Mẻ trà mới cho danh mục demo",
    "shortDescription": "Trà núi cao được bổ sung từ khu quản trị.",
    "description": "Thông tin chi tiết nguồn gốc và sản phẩm.",
    "categoryId": "cat-tea-coffee",
    "categoryName": "Trà & Cà phê",
    "regionId": "region-tay-bac",
    "regionName": "Tây Bắc",
    "price": 410000,
    "rating": 0,
    "reviewCount": 0,
    "stockStatus": "in-stock",
    "image": "https://example.com/products/default.jpg",
    "gallery": [],
    "origin": "Tây Bắc",
    "weight": "500g",
    "shelfLife": "12 tháng",
    "certifications": [],
    "shippingNotice": {
      "title": "Giao hàng tiêu chuẩn",
      "description": "Sản phẩm mới được thêm từ khu quản trị demo."
    },
    "sourcing": {
      "title": "Thông tin nguồn gốc",
      "body": "Thông tin chi tiết nguồn gốc và sản phẩm.",
      "certificationCards": []
    },
    "heritageCommitments": []
  },
  "message": "Sản phẩm đã được cập nhật."
}
```

### 10.10 `DELETE /admin/catalog/products/{id}`

- Priority: `Required`
- Mục đích: xoá sản phẩm.
- Role được gọi: `admin`
- Response `data`:
  - `deletedId: string`
  - `deleted: true`
- Lỗi chính:
  - `PRODUCT_NOT_FOUND`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "deletedId": "prod-custom-1",
    "deleted": true
  },
  "message": "Sản phẩm đã được xoá."
}
```

### 10.11 `GET /admin/catalog/categories`

- Priority: `Required`
- Mục đích: danh sách category cho admin repository.
- Role được gọi: `admin`
- Response `data`:
  - `items: Array<{ id: string; name: string; description: string; productsCount: number }>`
- Lỗi chính:
  - `AUTH_FORBIDDEN`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "cat-tea-coffee",
        "name": "Trà & Cà phê",
        "description": "Những mẻ trà, cà phê tuyển chọn từ miền núi và cao nguyên.",
        "productsCount": 2
      }
    ]
  }
}
```

### 10.12 `POST /admin/catalog/categories`

- Priority: `Required`
- Mục đích: tạo category mới.
- Role được gọi: `admin`
- Request body:
  - `name: string`
  - `description: string`
- Response `data`:
  - `id`
  - `name`
  - `description`
  - `productsCount`
- Lỗi chính:
  - `VALIDATION_ERROR`
  - `CATEGORY_DUPLICATED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "id": "cat-custom-1",
    "name": "Trà lên men",
    "description": "Danh mục mới do admin tạo.",
    "productsCount": 0
  },
  "message": "Danh mục đã được tạo."
}
```

### 10.13 `PATCH /admin/catalog/categories/{id}`

- Priority: `Required`
- Mục đích: cập nhật category.
- Role được gọi: `admin`
- Rule backend:
  - nếu đổi tên category, các product response sau đó phải dùng `categoryName` mới
- Response `data`:
  - `id`
  - `name`
  - `description`
  - `productsCount`
- Lỗi chính:
  - `CATEGORY_NOT_FOUND`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "id": "cat-custom-1",
    "name": "Trà lên men cao cấp",
    "description": "Danh mục đã được đổi tên.",
    "productsCount": 0
  },
  "message": "Danh mục đã được cập nhật."
}
```

### 10.14 `DELETE /admin/catalog/categories/{id}`

- Priority: `Required`
- Mục đích: xoá category.
- Role được gọi: `admin`
- Rule backend:
  - không cho xoá nếu còn product đang liên kết
- Response `data`:
  - `deletedId: string`
  - `deleted: true`
- Lỗi chính:
  - `CATEGORY_NOT_FOUND`
  - `CATEGORY_HAS_PRODUCTS`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "deletedId": "cat-custom-1",
    "deleted": true
  },
  "message": "Danh mục đã được xoá."
}
```

### 10.15 `GET /admin/logistics/orders`

- Priority: `Required`
- Mục đích: danh sách order cho admin logistics.
- Role được gọi: `admin`
- Query:
  - `search?: string`
  - `deliveryStatus?: DeliveryStatus`
  - `page?: number`
  - `limit?: number`
- Response `data`:
  - `items: Order[]`
- Lỗi chính:
  - `AUTH_FORBIDDEN`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": []
  },
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

### 10.16 `POST /admin/logistics/orders/{id}/handoff`

- Priority: `Required`
- Mục đích: chuyển order sang hàng đợi kho vận, đảm bảo có fulfillment task.
- Role được gọi: `admin`
- Response `data`:
  - `order: Order`
  - `fulfillmentTask: FulfillmentTask`
- Lỗi chính:
  - `ORDER_NOT_FOUND`
  - `ORDER_INVALID_STATE`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "order": {
      "id": "HH-21012",
      "customerId": "demo-customer",
      "customerName": "Minh Nguyễn",
      "supplierId": "sup-thai-nguyen",
      "supplierName": "Hợp tác xã Trà Thái Nguyên",
      "date": "2026-04-01T08:10:00Z",
      "total": 980000,
      "paymentStatus": "cod",
      "deliveryStatus": "ready_to_ship",
      "shippingTier": "standard",
      "address": "12 Trần Hưng Đạo, Quận 1, Thành phố Hồ Chí Minh",
      "items": [],
      "timeline": [],
      "statusHistory": [],
      "complaintIds": [],
      "assignedWarehouseZone": "Khu B"
    },
    "fulfillmentTask": {
      "id": "FUL-2000",
      "orderId": "HH-21012",
      "customerName": "Minh Nguyễn",
      "shippingTier": "standard",
      "status": "picking",
      "priority": "standard",
      "assignedZone": "Khu B",
      "etaLabel": "Theo ca chiều",
      "statusHistory": [],
      "orderSummary": {
        "id": "HH-21012",
        "address": "12 Trần Hưng Đạo, Quận 1, Thành phố Hồ Chí Minh",
        "total": 980000,
        "deliveryStatus": "ready_to_ship"
      }
    }
  },
  "message": "Đơn đã được chuyển sang kho vận."
}
```

### 10.17 `POST /admin/logistics/orders/{id}/mark-delivered`

- Priority: `Required`
- Mục đích: admin đánh dấu đơn đã giao.
- Role được gọi: `admin`
- Response `data`: `Order`
- Lỗi chính:
  - `ORDER_NOT_FOUND`
  - `ORDER_INVALID_STATE`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "id": "HH-21012",
    "customerId": "demo-customer",
    "customerName": "Minh Nguyễn",
    "supplierId": "sup-thai-nguyen",
    "supplierName": "Hợp tác xã Trà Thái Nguyên",
    "date": "2026-04-01T08:10:00Z",
    "total": 980000,
    "paymentStatus": "cod",
    "deliveryStatus": "delivered",
    "shippingTier": "standard",
    "address": "12 Trần Hưng Đạo, Quận 1, Thành phố Hồ Chí Minh",
    "items": [],
    "timeline": [],
    "statusHistory": [],
    "complaintIds": []
  },
  "message": "Đơn đã được đánh dấu giao thành công."
}
```

### 10.18 `GET /admin/logistics/complaints`

- Priority: `Required`
- Mục đích: danh sách khiếu nại cho admin logistics.
- Role được gọi: `admin`
- Query:
  - `search?: string`
  - `status?: open | resolved`
- Response `data`:
  - `items: Complaint[]`
- Lỗi chính:
  - `AUTH_FORBIDDEN`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": []
  }
}
```

### 10.19 `POST /admin/logistics/complaints/{id}/resolve`

- Priority: `Required`
- Mục đích: đóng khiếu nại và phục hồi trạng thái order nếu cần.
- Role được gọi: `admin`
- Request body:
  - `resolutionNote: string`
- Response `data`:
  - `complaint: Complaint`
  - `order: Order`
- Lỗi chính:
  - `COMPLAINT_NOT_FOUND`
  - `COMPLAINT_ALREADY_RESOLVED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "complaint": {
      "id": "CMP-1",
      "orderId": "HH-21012",
      "reason": "Giao hàng chậm hơn dự kiến",
      "message": "Nhờ cửa hàng cập nhật thời gian giao mới.",
      "createdAt": "2026-04-08T10:30:00Z",
      "status": "resolved",
      "orderSnapshotTotal": 980000,
      "previousDeliveryStatus": "in_transit",
      "resolutionNote": "Đã liên hệ khách hàng và đồng bộ trạng thái logistics.",
      "orderSummary": {
        "id": "HH-21012",
        "total": 980000,
        "deliveryStatus": "in_transit",
        "supplierName": "Hợp tác xã Trà Thái Nguyên"
      },
      "customerSummary": {
        "id": "demo-customer",
        "name": "Minh Nguyễn",
        "email": "minh.nguyen@example.com"
      }
    },
    "order": {
      "id": "HH-21012",
      "customerId": "demo-customer",
      "customerName": "Minh Nguyễn",
      "supplierId": "sup-thai-nguyen",
      "supplierName": "Hợp tác xã Trà Thái Nguyên",
      "date": "2026-04-01T08:10:00Z",
      "total": 980000,
      "paymentStatus": "cod",
      "deliveryStatus": "in_transit",
      "shippingTier": "standard",
      "address": "12 Trần Hưng Đạo, Quận 1, Thành phố Hồ Chí Minh",
      "items": [],
      "timeline": [],
      "statusHistory": [],
      "complaintIds": ["CMP-1"]
    }
  },
  "message": "Khiếu nại đã được xử lý."
}
```

## 11. Warehouse APIs

### 11.1 `GET /warehouse/inventory`

- Priority: `Required`
- Mục đích: danh sách tồn kho với product và supplier đã join sẵn.
- Role được gọi: `warehouse`
- Query:
  - `search?: string`
  - `status?: healthy | low | critical`
  - `page?: number`
  - `limit?: number`
- Response `data`:
  - `items: InventoryItem[]`
  - `summary: { totalSkus: number; alertCount: number; totalInventoryValue: number }`
- Lỗi chính:
  - `AUTH_FORBIDDEN`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "sku": "SKU-TEA-014",
        "onHand": 84,
        "reserved": 12,
        "reorderPoint": 60,
        "purchasePrice": 280000,
        "aisle": "A1-04",
        "status": "healthy",
        "product": {
          "id": "prod-tra-tan-cuong",
          "slug": "tra-tan-cuong-thai-nguyen",
          "name": "Trà Tân Cương Thái Nguyên",
          "image": "https://example.com/products/tea.jpg",
          "regionName": "Tây Bắc"
        },
        "supplier": {
          "id": "sup-thai-nguyen",
          "name": "Hợp tác xã Trà Thái Nguyên",
          "location": "Thái Nguyên, Việt Nam",
          "partnerTier": "Đối tác bạch kim",
          "status": "active"
        }
      }
    ],
    "summary": {
      "totalSkus": 1,
      "alertCount": 0,
      "totalInventoryValue": 23520000
    }
  }
}
```

### 11.2 `GET /warehouse/requisitions`

- Priority: `Required`
- Mục đích: danh sách phiếu tái nhập cho warehouse pages.
- Role được gọi: `warehouse`
- Query:
  - `status?: RequisitionStatus`
  - `inventorySku?: string`
- Response `data`:
  - `items: PurchaseRequisition[]`
- Lỗi chính:
  - `AUTH_FORBIDDEN`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "REQ-2401",
        "inventorySku": "SKU-RICE-021",
        "supplierId": "sup-phu-quoc",
        "requestedQty": 80,
        "approvedQty": 60,
        "etaDays": 5,
        "status": "approved",
        "statusHistory": [],
        "inventoryItem": null
      }
    ]
  }
}
```

### 11.3 `POST /warehouse/requisitions`

- Priority: `Required`
- Mục đích: tạo phiếu tái nhập mới từ warehouse inventory.
- Role được gọi: `warehouse`
- Request body:
  - `inventorySku: string`
  - `supplierId: string`
  - `requestedQty: number`
  - `etaDays: number`
  - `note?: string`
- Rule backend:
  - tạo mới với `status = submitted`
  - tự tạo `statusHistory`
- Response `data`: `PurchaseRequisition`
- Lỗi chính:
  - `INVENTORY_NOT_FOUND`
  - `SUPPLIER_NOT_FOUND`
  - `VALIDATION_ERROR`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "id": "REQ-3000",
    "inventorySku": "SKU-HONEY-007",
    "supplierId": "sup-thai-nguyen",
    "requestedQty": 45,
    "etaDays": 7,
    "status": "submitted",
    "note": "Bổ sung cho đợt giao tuần này",
    "statusHistory": [
      {
        "id": "req-status-3000",
        "actor": "warehouse",
        "label": "Đã gửi phiếu yêu cầu",
        "createdAt": "2026-04-08T11:00:00Z"
      }
    ]
  },
  "message": "Phiếu tái nhập đã được tạo."
}
```

### 11.4 `POST /warehouse/requisitions/{id}/approve`

- Priority: `Required`
- Mục đích: kho duyệt nội bộ phiếu.
- Role được gọi: `warehouse`
- Request body:
  - `approvedQty?: number`
- Response `data`: `PurchaseRequisition`
- Lỗi chính:
  - `REQUISITION_NOT_FOUND`
  - `REQUISITION_INVALID_STATUS`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "id": "REQ-3000",
    "inventorySku": "SKU-HONEY-007",
    "supplierId": "sup-thai-nguyen",
    "requestedQty": 45,
    "approvedQty": 45,
    "etaDays": 7,
    "status": "approved",
    "note": "Bổ sung cho đợt giao tuần này",
    "statusHistory": []
  },
  "message": "Phiếu đã được duyệt."
}
```

### 11.5 `POST /warehouse/requisitions/{id}/receive`

- Priority: `Required`
- Mục đích: xác nhận đã nhập kho và cập nhật inventory.
- Role được gọi: `warehouse`
- Response `data`:
  - `requisition: PurchaseRequisition`
  - `inventoryItem: InventoryItem`
- Lỗi chính:
  - `REQUISITION_NOT_FOUND`
  - `REQUISITION_INVALID_STATUS`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "requisition": {
      "id": "REQ-3000",
      "inventorySku": "SKU-HONEY-007",
      "supplierId": "sup-thai-nguyen",
      "requestedQty": 45,
      "approvedQty": 45,
      "etaDays": 7,
      "status": "received",
      "note": "Bổ sung cho đợt giao tuần này",
      "statusHistory": []
    },
    "inventoryItem": {
      "sku": "SKU-HONEY-007",
      "onHand": 63,
      "reserved": 1,
      "reorderPoint": 22,
      "purchasePrice": 210000,
      "aisle": "D1-08",
      "status": "healthy",
      "product": {
        "id": "prod-mat-ong",
        "slug": "mat-ong-rung-tay-bac",
        "name": "Mật ong rừng Tây Bắc",
        "image": "https://example.com/products/honey.jpg",
        "regionName": "Tây Bắc"
      },
      "supplier": {
        "id": "sup-thai-nguyen",
        "name": "Hợp tác xã Trà Thái Nguyên",
        "location": "Thái Nguyên, Việt Nam",
        "partnerTier": "Đối tác bạch kim",
        "status": "active"
      }
    }
  },
  "message": "Đã ghi nhận nhập kho."
}
```

### 11.6 `POST /warehouse/requisitions/{id}/cancel`

- Priority: `Required`
- Mục đích: huỷ phiếu tái nhập.
- Role được gọi: `warehouse`
- Response `data`: `PurchaseRequisition`
- Lỗi chính:
  - `REQUISITION_NOT_FOUND`
  - `REQUISITION_INVALID_STATUS`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "id": "REQ-3000",
    "inventorySku": "SKU-HONEY-007",
    "supplierId": "sup-thai-nguyen",
    "requestedQty": 45,
    "approvedQty": 45,
    "etaDays": 7,
    "status": "cancelled",
    "note": "Bổ sung cho đợt giao tuần này",
    "statusHistory": []
  },
  "message": "Phiếu đã được huỷ."
}
```

### 11.7 `GET /warehouse/fulfillment-tasks`

- Priority: `Required`
- Mục đích: danh sách task fulfillment cho warehouse.
- Role được gọi: `warehouse`
- Query:
  - `status?: FulfillmentStatus`
  - `priority?: standard | rush`
  - `assignedZone?: string`
- Response `data`:
  - `items: FulfillmentTask[]`
  - `summary: { activeCount: number; shippedCount: number; rushCount: number; activeZones: number }`
- Lỗi chính:
  - `AUTH_FORBIDDEN`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "FUL-1001",
        "orderId": "HH-7721",
        "customerName": "Minh Nguyễn",
        "shippingTier": "priority",
        "status": "packing",
        "priority": "rush",
        "assignedZone": "Khu C",
        "etaLabel": "Lấy hàng lúc 10:30",
        "statusHistory": [],
        "orderSummary": {
          "id": "HH-7721",
          "address": "12 Trần Hưng Đạo, Quận 1, Thành phố Hồ Chí Minh",
          "total": 12450000,
          "deliveryStatus": "ready_to_ship"
        }
      }
    ],
    "summary": {
      "activeCount": 1,
      "shippedCount": 0,
      "rushCount": 1,
      "activeZones": 1
    }
  }
}
```

### 11.8 `POST /warehouse/fulfillment-tasks/{id}/advance`

- Priority: `Required`
- Mục đích: đẩy task sang bước tiếp theo và cập nhật order liên quan.
- Role được gọi: `warehouse`
- Request body:
  - `note?: string`
- Response `data`:
  - `task: FulfillmentTask`
  - `order: Order`
- Rule backend:
  - nếu task mới là `shipped`, order phải chuyển sang `in_transit`
  - nếu chưa tới `shipped`, order phải ở `ready_to_ship`
- Lỗi chính:
  - `FULFILLMENT_NOT_FOUND`
  - `FULFILLMENT_ALREADY_SHIPPED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "task": {
      "id": "FUL-1001",
      "orderId": "HH-7721",
      "customerName": "Minh Nguyễn",
      "shippingTier": "priority",
      "status": "awaiting_pickup",
      "priority": "rush",
      "assignedZone": "Khu C",
      "etaLabel": "Lấy hàng lúc 10:30",
      "notes": "Cập nhật từ màn hình fulfillment.",
      "statusHistory": [],
      "orderSummary": {
        "id": "HH-7721",
        "address": "12 Trần Hưng Đạo, Quận 1, Thành phố Hồ Chí Minh",
        "total": 12450000,
        "deliveryStatus": "ready_to_ship"
      }
    },
    "order": {
      "id": "HH-7721",
      "customerId": "demo-customer",
      "customerName": "Minh Nguyễn",
      "supplierId": "sup-thai-nguyen",
      "supplierName": "Hợp tác xã Trà Thái Nguyên",
      "date": "2026-03-28T09:20:00Z",
      "total": 12450000,
      "paymentStatus": "pending",
      "deliveryStatus": "ready_to_ship",
      "shippingTier": "priority",
      "address": "12 Trần Hưng Đạo, Quận 1, Thành phố Hồ Chí Minh",
      "items": [],
      "timeline": [],
      "statusHistory": [],
      "complaintIds": []
    }
  },
  "message": "Nhiệm vụ fulfillment đã được cập nhật."
}
```

### 11.9 `GET /warehouse/support-tickets`

- Priority: `Required`
- Mục đích: lấy ticket hỗ trợ kênh warehouse.
- Role được gọi: `warehouse`
- Query:
  - `status?: open | resolved`
- Response `data`:
  - `items: SupportTicket[]`
- Lỗi chính:
  - `AUTH_FORBIDDEN`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "HELP-1",
        "subject": "Cần bổ sung nhân sự ca tối",
        "message": "Khối lượng picking tăng nhanh.",
        "channel": "warehouse",
        "createdAt": "2026-04-08T11:10:00Z",
        "status": "open"
      }
    ]
  }
}
```

### 11.10 `POST /warehouse/support-tickets`

- Priority: `Required`
- Mục đích: tạo ticket hỗ trợ cho warehouse.
- Role được gọi: `warehouse`
- Request body:
  - `subject: string`
  - `message: string`
- Response `data`: `SupportTicket`
- Lỗi chính:
  - `VALIDATION_ERROR`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "id": "HELP-2",
    "subject": "Cần bổ sung nhân sự ca tối",
    "message": "Khối lượng picking tăng nhanh.",
    "channel": "warehouse",
    "createdAt": "2026-04-08T11:11:00Z",
    "status": "open"
  },
  "message": "Ticket đã được tạo."
}
```

### 11.11 `POST /warehouse/support-tickets/{id}/resolve`

- Priority: `Required`
- Mục đích: đánh dấu ticket kho vận đã xử lý.
- Role được gọi: `warehouse`
- Response `data`: `SupportTicket`
- Lỗi chính:
  - `SUPPORT_TICKET_NOT_FOUND`
  - `SUPPORT_TICKET_ALREADY_RESOLVED`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "id": "HELP-2",
    "subject": "Cần bổ sung nhân sự ca tối",
    "message": "Khối lượng picking tăng nhanh.",
    "channel": "warehouse",
    "createdAt": "2026-04-08T11:11:00Z",
    "status": "resolved"
  },
  "message": "Ticket đã được đánh dấu xử lý."
}
```

### 11.12 `GET /warehouse/supplier-orders`

- Priority: `Required`
- Mục đích: lấy các order có supplier để warehouse theo dõi phối hợp trước fulfillment.
- Role được gọi: `warehouse`
- Query:
  - `search?: string`
  - `deliveryStatus?: DeliveryStatus`
- Response `data`:
  - `items: Order[]`
- Lỗi chính:
  - `AUTH_FORBIDDEN`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": []
  }
}
```

## 12. Supplier APIs

### 12.1 `GET /supplier/orders`

- Priority: `Required`
- Mục đích: lấy order thuộc supplier hiện tại.
- Role được gọi: `supplier`
- Query:
  - `filter?: all | awaiting`
  - `search?: string`
  - `deliveryStatus?: DeliveryStatus`
- Rule backend:
  - scope theo `session.user.organizationId`
- Response `data`:
  - `items: Order[]`
  - `summary: { processingCount: number; inTransitCount: number; revenue: number }`
- Lỗi chính:
  - `AUTH_FORBIDDEN`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [],
    "summary": {
      "processingCount": 0,
      "inTransitCount": 0,
      "revenue": 142000000
    }
  }
}
```

### 12.2 `POST /supplier/orders/{id}/handoff`

- Priority: `Required`
- Mục đích: supplier xác nhận xong bước xử lý và chuyển đơn sang `ready_to_ship`.
- Role được gọi: `supplier`
- Response `data`:
  - `order: Order`
  - `fulfillmentTask: FulfillmentTask`
- Lỗi chính:
  - `ORDER_NOT_FOUND`
  - `AUTH_FORBIDDEN`
  - `ORDER_INVALID_STATE`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "order": {
      "id": "HH-7721",
      "customerId": "demo-customer",
      "customerName": "Minh Nguyễn",
      "supplierId": "sup-thai-nguyen",
      "supplierName": "Hợp tác xã Trà Thái Nguyên",
      "date": "2026-03-28T09:20:00Z",
      "total": 12450000,
      "paymentStatus": "pending",
      "deliveryStatus": "ready_to_ship",
      "shippingTier": "priority",
      "address": "12 Trần Hưng Đạo, Quận 1, Thành phố Hồ Chí Minh",
      "items": [],
      "timeline": [],
      "statusHistory": [],
      "complaintIds": [],
      "assignedWarehouseZone": "Khu C"
    },
    "fulfillmentTask": {
      "id": "FUL-2001",
      "orderId": "HH-7721",
      "customerName": "Minh Nguyễn",
      "shippingTier": "priority",
      "status": "picking",
      "priority": "rush",
      "assignedZone": "Khu C",
      "etaLabel": "Ưu tiên lấy hàng trong 2 giờ",
      "statusHistory": [],
      "orderSummary": {
        "id": "HH-7721",
        "address": "12 Trần Hưng Đạo, Quận 1, Thành phố Hồ Chí Minh",
        "total": 12450000,
        "deliveryStatus": "ready_to_ship"
      }
    }
  },
  "message": "Đơn đã sẵn sàng bàn giao cho kho."
}
```

### 12.3 `POST /supplier/orders/{id}/mark-delivered`

- Priority: `Required`
- Mục đích: supplier xác nhận hoàn tất giao.
- Role được gọi: `supplier`
- Response `data`: `Order`
- Lỗi chính:
  - `ORDER_NOT_FOUND`
  - `AUTH_FORBIDDEN`
  - `ORDER_INVALID_STATE`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "id": "HH-7721",
    "customerId": "demo-customer",
    "customerName": "Minh Nguyễn",
    "supplierId": "sup-thai-nguyen",
    "supplierName": "Hợp tác xã Trà Thái Nguyên",
    "date": "2026-03-28T09:20:00Z",
    "total": 12450000,
    "paymentStatus": "pending",
    "deliveryStatus": "delivered",
    "shippingTier": "priority",
    "address": "12 Trần Hưng Đạo, Quận 1, Thành phố Hồ Chí Minh",
    "items": [],
    "timeline": [],
    "statusHistory": [],
    "complaintIds": []
  },
  "message": "Đơn đã được xác nhận hoàn tất."
}
```

### 12.4 `GET /supplier/inventory`

- Priority: `Required`
- Mục đích: supplier xem inventory các SKU của chính mình.
- Role được gọi: `supplier`
- Query:
  - `status?: healthy | low | critical`
  - `search?: string`
- Rule backend:
  - scope theo `organizationId`
- Response `data`:
  - `items: InventoryItem[]`
- Lỗi chính:
  - `AUTH_FORBIDDEN`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": []
  }
}
```

### 12.5 `GET /supplier/requisitions`

- Priority: `Required`
- Mục đích: supplier xem các phiếu nhập gửi tới mình.
- Role được gọi: `supplier`
- Query:
  - `status?: RequisitionStatus`
- Response `data`:
  - `items: PurchaseRequisition[]`
- Lỗi chính:
  - `AUTH_FORBIDDEN`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": []
  }
}
```

### 12.6 `POST /supplier/requisitions/{id}/approve`

- Priority: `Required`
- Mục đích: supplier duyệt phiếu yêu cầu.
- Role được gọi: `supplier`
- Request body:
  - `approvedQty?: number`
- Response `data`: `PurchaseRequisition`
- Lỗi chính:
  - `REQUISITION_NOT_FOUND`
  - `AUTH_FORBIDDEN`
  - `REQUISITION_INVALID_STATUS`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "id": "REQ-2402",
    "inventorySku": "SKU-HONEY-007",
    "supplierId": "sup-thai-nguyen",
    "requestedQty": 45,
    "approvedQty": 45,
    "etaDays": 7,
    "status": "approved",
    "note": "Ưu tiên giao trong tuần này",
    "statusHistory": []
  },
  "message": "Phiếu đã được supplier duyệt."
}
```

### 12.7 `POST /supplier/requisitions/{id}/receive`

- Priority: `Required`
- Mục đích: supplier xác nhận đã hoàn tất phiếu.
- Role được gọi: `supplier`
- Response `data`:
  - `requisition: PurchaseRequisition`
  - `inventoryItem?: InventoryItem`
- Lỗi chính:
  - `REQUISITION_NOT_FOUND`
  - `AUTH_FORBIDDEN`
  - `REQUISITION_INVALID_STATUS`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "requisition": {
      "id": "REQ-2402",
      "inventorySku": "SKU-HONEY-007",
      "supplierId": "sup-thai-nguyen",
      "requestedQty": 45,
      "approvedQty": 45,
      "etaDays": 7,
      "status": "received",
      "note": "Ưu tiên giao trong tuần này",
      "statusHistory": []
    },
    "inventoryItem": null
  },
  "message": "Phiếu đã được xác nhận hoàn tất."
}
```

### 12.8 `POST /supplier/requisitions/{id}/cancel`

- Priority: `Required`
- Mục đích: supplier huỷ phiếu.
- Role được gọi: `supplier`
- Response `data`: `PurchaseRequisition`
- Lỗi chính:
  - `REQUISITION_NOT_FOUND`
  - `AUTH_FORBIDDEN`
  - `REQUISITION_INVALID_STATUS`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "id": "REQ-2402",
    "inventorySku": "SKU-HONEY-007",
    "supplierId": "sup-thai-nguyen",
    "requestedQty": 45,
    "approvedQty": 45,
    "etaDays": 7,
    "status": "cancelled",
    "note": "Ưu tiên giao trong tuần này",
    "statusHistory": []
  },
  "message": "Phiếu đã được huỷ."
}
```

### 12.9 `GET /supplier/support-tickets`

- Priority: `Required`
- Mục đích: lấy ticket support kênh supplier.
- Role được gọi: `supplier`
- Query:
  - `status?: open | resolved`
- Response `data`:
  - `items: SupportTicket[]`
- Lỗi chính:
  - `AUTH_FORBIDDEN`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "HELP-10",
        "subject": "Cần xác nhận ETA với kho",
        "message": "Nhờ đội điều phối kiểm tra lại lịch nhận hàng.",
        "channel": "supplier",
        "createdAt": "2026-04-08T11:20:00Z",
        "status": "open"
      }
    ]
  }
}
```

### 12.10 `POST /supplier/support-tickets`

- Priority: `Required`
- Mục đích: tạo ticket support cho supplier.
- Role được gọi: `supplier`
- Request body:
  - `subject: string`
  - `message: string`
- Response `data`: `SupportTicket`
- Lỗi chính:
  - `VALIDATION_ERROR`
  - `AUTH_FORBIDDEN`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "id": "HELP-11",
    "subject": "Cần xác nhận ETA với kho",
    "message": "Nhờ đội điều phối kiểm tra lại lịch nhận hàng.",
    "channel": "supplier",
    "createdAt": "2026-04-08T11:21:00Z",
    "status": "open"
  },
  "message": "Ticket đã được tạo."
}
```

## 13. Mở rộng khuyến nghị và dev-only

### 13.1 Export dữ liệu khuyến nghị

- Priority: `Recommended`
- Các endpoint nên có:
  - `GET /admin/reports/community/export?format=json`
  - `GET /warehouse/inventory/export?format=csv`
  - `GET /supplier/inventory/export?format=csv`
- Mục đích:
  - phục vụ các nút export đang có trong dashboard, community, supplier inventory

Ví dụ CSV cho inventory:

```csv
sku,product,status,onHand,reserved
SKU-TEA-014,Trà Tân Cương Thái Nguyên,Ổn định,84,12
```

### 13.2 `GET /admin/system/snapshot`

- Priority: `Dev-only`
- Mục đích: export toàn bộ snapshot runtime cho môi trường demo.
- Role được gọi: `admin`
- Response `data`:
  - `profile`
  - `catalog`
  - `operations`
  - `orders`
  - `generatedAt`
- Lỗi chính:
  - `AUTH_FORBIDDEN`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "profile": {},
    "catalog": {},
    "operations": {},
    "orders": {},
    "generatedAt": "2026-04-08T11:30:00Z"
  }
}
```

### 13.3 `POST /admin/system/reset`

- Priority: `Dev-only`
- Mục đích: reset dữ liệu về seed ban đầu.
- Role được gọi: `admin`
- Request body:
  - `mode: "seed"`
- Response `data`:
  - `reset: true`
  - `resetAt: string`
- Lỗi chính:
  - `AUTH_FORBIDDEN`

Ví dụ response:

```json
{
  "success": true,
  "data": {
    "reset": true,
    "resetAt": "2026-04-08T11:31:00Z"
  },
  "message": "Hệ thống đã được reset về seed."
}
```

### 13.4 Realtime đồng bộ trạng thái

- Priority: `Optional`
- Khuyến nghị dùng SSE trước, WebSocket sau nếu cần hai chiều.
- Endpoint đề xuất:
  - `GET /events/stream?topics=orders,requisitions,fulfillment`
- Event cần phát:
  - `order.updated`
  - `complaint.created`
  - `complaint.resolved`
  - `requisition.updated`
  - `fulfillment.updated`
  - `support_ticket.updated`

Ví dụ payload SSE:

```json
{
  "event": "fulfillment.updated",
  "timestamp": "2026-04-08T11:35:00Z",
  "data": {
    "taskId": "FUL-1001",
    "orderId": "HH-7721",
    "status": "awaiting_pickup"
  }
}
```

## 14. Checklist triển khai backend

- Tất cả response mutation phải trả lại object hoàn chỉnh đã cập nhật, không chỉ trả `success: true`.
- Tất cả DTO liên quan UI phải được join sẵn:
  - `Order.items[]` phải có `productName`, `productSlug`, `image`, `lineTotal`
  - `InventoryItem` phải có `product` và `supplier`
  - `Complaint` phải có `orderSummary` và `customerSummary`
  - `FulfillmentTask` phải có `orderSummary`
- Các enum trạng thái phải bám đúng frontend hiện tại:
  - `deliveryStatus`
  - `paymentStatus`
  - `shippingTier`
  - `stockStatus`
  - `inventory health`
  - `requisition status`
  - `fulfillment status`
  - `user role`
- Các endpoint supplier và warehouse phải được scope theo session hiện tại, không trả toàn bộ dữ liệu hệ thống cho user sai vai trò.
- Các endpoint công khai của storefront không được làm frontend phát sinh N+1 request chỉ để dựng tên sản phẩm, ảnh hoặc supplier hiển thị.
