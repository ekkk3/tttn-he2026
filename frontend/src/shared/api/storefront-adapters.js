// ==================================================================
// TOÀN BỘ file này là lớp "adapter": chuyển đổi response backend (snake_case, PHP/Laravel-
// style: full_name, sale_price, order_no...) sang view model frontend (camelCase: fullName,
// salePrice, orderNo...). Mọi store (shared/lib/store/*) sau khi gọi apiRequest() đều đi qua
// đúng 1 hàm adaptBackend* tương ứng ở đây trước khi lưu vào state — component không bao giờ
// đọc trực tiếp field snake_case từ response.
// ==================================================================

// Ảnh minh họa tự sinh (SVG data-URI) cho sản phẩm CHƯA có ảnh (image_url rỗng).
// Tự chứa, không cần mạng, luôn hiển thị -> tránh ảnh vỡ/trống cho mọi sản phẩm
// (kể cả sản phẩm do Admin/NCC tạo mà chưa gắn ảnh).
export function placeholderImage(name) {
    const esc = (s) =>
        String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const label = String(name || "Sản phẩm").trim();
    const initial = (label.charAt(0) || "S").toUpperCase();
    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">` +
        `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#eaf2e6"/><stop offset="1" stop-color="#cfe0c8"/></linearGradient></defs>` +
        `<rect width="600" height="600" fill="url(#g)"/>` +
        `<circle cx="300" cy="240" r="96" fill="#2e5a34"/>` +
        `<text x="300" y="278" font-family="Arial,sans-serif" font-size="110" fill="#ffffff" text-anchor="middle">${esc(initial)}</text>` +
        `<text x="300" y="408" font-family="Arial,sans-serif" font-size="34" font-weight="bold" fill="#2e5a34" text-anchor="middle">${esc(label.slice(0, 22))}</text>` +
        `<text x="300" y="452" font-family="Arial,sans-serif" font-size="22" fill="#5a6b55" text-anchor="middle">Đặc sản vùng miền</text>` +
        `</svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
// Giá trị mặc định khi backend chưa có dữ liệu thật (vd sản phẩm mới tạo chưa có review
// nào) — để card sản phẩm luôn hiện được sao đánh giá thay vì trống/0 sao trông như lỗi.
function fallbackProduct(_index) {
    return {
        image: "",
        rating: 4.8,
        reviewCount: 0,
        badge: undefined,
        gallery: [],
    };
}
export function slugify(input) {
    return input
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
export function buildStorefrontSlug(productId, name) {
    return `${slugify(name)}-${productId}`;
}
function numberValue(value) {
    return Number(value ?? 0);
}
function stockStatusForProduct(product) {
    if (!product.is_active || product.stock_quantity <= 0)
        return "preorder";
    if (product.stock_quantity <= 5)
        return "low-stock";
    return "in-stock";
}
// Backend lưu role dạng CHỮ HOA (CUSTOMER/ADMIN/SUPPLIER/WAREHOUSE_STAFF — xem
// backend/src/config/db.js schema), nhưng toàn bộ frontend (routes.js, use-auth-store.js,
// route-guard.jsx...) làm việc với role dạng CHỮ THƯỜNG (customer/admin/supplier/warehouse).
// Đây là NƠI DUY NHẤT chuyển đổi giữa 2 quy ước đó — role lạ/không nhận diện được trả về null.
export function normalizeUserRole(role) {
    const normalized = role.trim().toUpperCase();
    if (normalized === "CUSTOMER")
        return "customer";
    if (normalized === "ADMIN")
        return "admin";
    if (normalized === "SUPPLIER")
        return "supplier";
    if (normalized === "WAREHOUSE" || normalized === "WAREHOUSE_STAFF")
        return "warehouse";
    return null;
}
export function adaptBackendUserToAuthUser(user) {
    const role = normalizeUserRole(user.role);
    if (!role)
        return null;
    return {
        id: String(user.id),
        name: user.full_name,
        email: user.email,
        role,
    };
}
export function adaptBackendUserToSession(user) {
    const authUser = adaptBackendUserToAuthUser(user);
    if (!authUser)
        return null;
    return {
        user: authUser,
        loggedInAt: new Date().toISOString(),
    };
}
export function adaptBackendCategory(category) {
    return {
        id: String(category.id),
        name: category.name,
        description: category.description,
    };
}
export function adaptBackendRegion(region) {
    return {
        id: String(region.id),
        name: region.name,
        description: region.description ?? "",
    };
}
export function adaptBackendUserAddress(address) {
    return {
        id: String(address.id),
        label: address.label,
        recipient: address.recipient,
        phone: address.phone,
        line1: address.line1,
        city: address.city,
        ghnProvinceId: address.ghn_province_id ?? null,
        ghnProvinceName: address.ghn_province_name ?? null,
        ghnDistrictId: address.ghn_district_id ?? null,
        ghnDistrictName: address.ghn_district_name ?? null,
        ghnWardCode: address.ghn_ward_code ?? null,
        ghnWardName: address.ghn_ward_name ?? null,
        note: address.note ?? "",
        isDefault: address.is_default,
    };
}
export function adaptBackendRewardSnapshot(snapshot) {
    return {
        tier: snapshot.tier,
        points: snapshot.points,
        nextTierPoints: snapshot.next_tier_points,
        perks: snapshot.perks,
    };
}
export function adaptBackendRewardRedemption(item) {
    return {
        id: String(item.id),
        title: item.title,
        pointsUsed: item.points_used,
        createdAt: item.created_at,
        status: item.status,
    };
}
export function adaptBackendAccountProfile(profile) {
    return {
        id: String(profile.id),
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        address: profile.address ?? "",
        city: profile.city ?? "",
        favoriteRegion: profile.favorite_region ?? "",
        avatar: profile.avatar ?? "",
        memberSince: profile.member_since,
        newsletter: profile.newsletter,
        smsAlerts: profile.sms_alerts,
        orderEmail: profile.order_email,
        securityAlerts: profile.security_alerts,
        addresses: profile.addresses.map(adaptBackendUserAddress),
        rewardHistory: profile.reward_history.map(adaptBackendRewardRedemption),
    };
}
export function adaptBackendNotification(notification) {
    return {
        id: String(notification.id),
        title: notification.title,
        message: notification.message,
        channel: notification.channel,
        status: notification.status,
        sentAt: notification.sent_at ?? "",
        readAt: notification.read_at ?? "",
        createdAt: notification.created_at ?? "",
    };
}
export function adaptBackendComplaint(complaint) {
    return {
        id: String(complaint.id),
        reason: complaint.reason,
        content: complaint.content,
        imageUrl: complaint.image_url ?? "",
        status: complaint.status,
        resolutionNote: complaint.resolution_note ?? "",
        createdAt: complaint.created_at,
        orderId: complaint.order ? String(complaint.order.id) : "",
        orderNo: complaint.order?.order_no ?? "",
        orderStatus: complaint.order?.status ?? "",
        orderTotalAmount: numberValue(complaint.order?.total_amount ?? 0),
        productId: complaint.product ? String(complaint.product.id) : "",
        productName: complaint.product?.name ?? "",
        productSku: complaint.product?.sku ?? "",
        resolverName: complaint.resolver?.full_name ?? "",
    };
}
export function adaptBackendSupplierOption(supplier) {
    return {
        id: String(supplier.id),
        name: supplier.name,
        description: supplier.address ?? supplier.contact_name ?? supplier.email ?? "Nhà cung cấp đối tác",
    };
}
// Adapter LỚN NHẤT và duy nhất không chỉ đổi tên field: còn TỰ TỔNG HỢP thêm nhiều field
// chỉ phục vụ UI mà backend không lưu (subtitle, badge, heritageCommitments, sourcing card,
// shippingNotice...) từ vài trường gốc (category/supplier/stock_quantity/sku) — để trang
// chi tiết sản phẩm có đủ nội dung hiển thị phong phú mà không cần thêm cột DB nào.
export function adaptBackendProduct(product, index = 0) {
    const fallback = fallbackProduct(index);
    const supplierName = product.supplier?.name
        ?? (product.supplier_id != null ? `Nhà cung cấp #${product.supplier_id}` : "Đang cập nhật nhà cung cấp");
    const categoryName = product.category?.name ?? `Danh mục #${product.category_id}`;
    const image = product.image_url?.trim() || placeholderImage(product.name);
    return {
        id: String(product.id),
        slug: product.slug?.trim() || buildStorefrontSlug(product.id, product.name),
        name: product.name,
        detailTitle: product.name,
        subtitle: `${categoryName} · ${supplierName}`,
        categoryId: String(product.category_id),
        categoryName,
        supplierId: String(product.supplier_id ?? ""),
        supplierName,
        regionId: String(product.region_id ?? product.region?.id ?? product.supplier_id ?? product.id),
        regionName: product.region?.name ?? product.origin ?? supplierName,
        description: product.description,
        shortDescription: product.short_description ?? product.description,
        price: numberValue(product.sale_price),
        originalPrice: undefined,
        rating: product.rating != null ? Number(product.rating) : fallback.rating,
        reviewCount: product.review_count != null ? Number(product.review_count) : fallback.reviewCount,
        stockStatus: stockStatusForProduct(product),
        stockQuantity: product.stock_quantity,
        badge: fallback.badge ?? categoryName,
        tag: product.sku,
        image,
        gallery: [
            {
                src: image,
                alt: product.name,
            },
            {
                src: fallback.gallery[0]?.src ?? image,
                alt: fallback.gallery[0]?.alt ?? product.name,
            },
        ],
        origin: product.origin ?? supplierName,
        weight: "Theo cấu hình nhà bán",
        shelfLife: product.stock_quantity > 0 ? `Tồn kho ${product.stock_quantity} sản phẩm` : "Tạm hết hàng",
        certifications: product.certifications?.length ? product.certifications : [categoryName, product.sku],
        shippingNotice: {
            title: product.stock_quantity > 0 ? "Sẵn sàng giao hàng" : "Cần xác nhận tồn kho",
            description: product.stock_quantity > 0
                ? "Sản phẩm đang có sẵn trên hệ thống và có thể thêm vào giỏ hàng ngay."
                : "Vui lòng theo dõi cập nhật tồn kho trên storefront.",
        },
        sourcing: {
            title: "Thông tin sản phẩm",
            body: product.description,
            certificationCards: [
                {
                    icon: "inventory_2",
                    title: "Mã SKU",
                    description: product.sku,
                },
                {
                    icon: "storefront",
                    title: "Nhà cung cấp",
                    description: supplierName,
                },
            ],
        },
        heritageCommitments: [
            {
                icon: "verified",
                text: `Danh mục: ${categoryName}`,
            },
            {
                icon: "local_shipping",
                text: product.stock_quantity > 0 ? "Sản phẩm có sẵn - Đặt hàng ngay." : "Tồn kho sẽ được cập nhật sau.",
            },
            {
                icon: "sell",
                text: `Giá hiện tại ${numberValue(product.sale_price).toLocaleString("vi-VN")} VND`,
            },
        ],
    };
}
export function adaptBackendCartItem(item, index = 0) {
    return {
        id: String(item.id),
        productId: String(item.product_id),
        quantity: item.quantity,
        unitPrice: numberValue(item.unit_price),
        lineTotal: numberValue(item.line_total),
        product: adaptBackendProduct(item.product, index),
    };
}
export function adaptBackendCart(cart) {
    return {
        id: String(cart.id),
        status: cart.status,
        itemCount: cart.item_count,
        totalQuantity: cart.total_quantity,
        subtotal: numberValue(cart.subtotal),
        items: cart.items.map((item, index) => adaptBackendCartItem(item, index)),
    };
}
function adaptPayment(payment) {
    return {
        id: String(payment.id),
        transactionCode: payment.transaction_code,
        paymentMethod: payment.payment_method,
        paymentStatus: payment.payment_status,
        amount: numberValue(payment.amount),
        gatewayName: payment.gateway_name,
        gatewayReference: payment.gateway_reference,
        paidAt: payment.paid_at,
        rawPayload: payment.raw_payload ?? null,
        createdAt: payment.created_at,
        updatedAt: payment.updated_at,
    };
}
export function adaptBackendOrderSummary(order) {
    return {
        id: String(order.id),
        orderNo: order.order_no,
        paymentMethod: order.payment_method,
        status: order.status,
        subtotal: numberValue(order.subtotal),
        shippingFee: numberValue(order.shipping_fee),
        discountAmount: numberValue(order.discount_amount),
        totalAmount: numberValue(order.total_amount),
        itemCount: order.item_count,
        productNames: Array.isArray(order.product_names) ? order.product_names.filter(Boolean) : [],
        payment: order.payment ? adaptPayment(order.payment) : null,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
    };
}
function adaptOrderItem(item) {
    return {
        id: String(item.id),
        productId: String(item.product_id),
        productNameSnapshot: item.product_name_snapshot,
        quantity: item.quantity,
        unitPrice: numberValue(item.unit_price),
        lineTotal: numberValue(item.line_total),
    };
}
function adaptStatusHistory(history) {
    return {
        id: String(history.id),
        changedByUserId: history.changed_by_user_id,
        fromStatus: history.from_status,
        toStatus: history.to_status,
        note: history.note,
        changedAt: history.changed_at,
    };
}
function adaptShipment(shipment) {
    if (!shipment)
        return null;
    return {
        status: shipment.status,
        trackingCode: shipment.tracking_code,
        trackingUrl: shipment.tracking_url,
        expectedDeliveryTime: shipment.expected_delivery_time,
        syncedAt: shipment.synced_at,
    };
}
export function adaptBackendOrderDetail(order) {
    const summary = adaptBackendOrderSummary(order);
    return {
        ...summary,
        recipientName: order.recipient_name,
        recipientPhone: order.recipient_phone,
        shippingAddress: order.shipping_address,
        shippingProvinceName: order.shipping_province_name ?? null,
        shippingDistrictName: order.shipping_district_name ?? null,
        shippingWardName: order.shipping_ward_name ?? null,
        note: order.note ?? "",
        shippingCode: order.shipping_code ?? null,
        shippingCarrier: order.shipping_carrier ?? null,
        shippedAt: order.shipped_at ?? null,
        deliveredAt: order.delivered_at ?? null,
        cancelledAt: order.cancelled_at ?? null,
        items: order.items.map(adaptOrderItem),
        statusHistory: order.status_history.map(adaptStatusHistory),
        shipment: adaptShipment(order.shipment),
    };
}
