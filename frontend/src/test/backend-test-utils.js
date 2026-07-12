export function jsonResponse(data, init = {}) {
    return new Response(JSON.stringify(data), {
        status: init.status ?? 200,
        headers: {
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
        },
    });
}
export function getRequestPath(input) {
    if (input instanceof URL) {
        return input.pathname;
    }
    if (typeof input === "string") {
        return new URL(input, "http://127.0.0.1").pathname;
    }
    return new URL(input.url, "http://127.0.0.1").pathname;
}
export function getJsonBody(init) {
    if (!init?.body || typeof init.body !== "string") {
        return null;
    }
    return JSON.parse(init.body);
}
export function createBackendUser(overrides = {}) {
    return {
        id: 1,
        full_name: "Nguyen Van A",
        email: "customer@example.com",
        phone: "0909123456",
        role: "CUSTOMER",
        is_active: true,
        is_deleted: false,
        created_at: "2026-04-20T00:00:00.000000Z",
        updated_at: "2026-04-20T00:00:00.000000Z",
        ...overrides,
    };
}
export function createBackendProduct(overrides = {}) {
    return {
        id: 101,
        category_id: 5,
        supplier_id: 8,
        sku: "SKU-101",
        name: "Tra huu co",
        description: "San pham backend cho customer commerce.",
        sale_price: 120000,
        stock_quantity: 20,
        is_active: true,
        is_deleted: false,
        category: {
            id: 5,
            name: "Tra",
            description: "Danh muc tra",
            is_active: true,
            is_deleted: false,
        },
        supplier: {
            id: 8,
            supplier_code: "SUP-08",
            name: "Hop tac xa Moc",
            contact_name: "Le Mai",
            phone: "0988123123",
            email: "supplier@example.com",
            address: "Thai Nguyen",
            is_active: true,
            is_deleted: false,
        },
        created_at: "2026-04-20T00:00:00.000000Z",
        updated_at: "2026-04-20T00:00:00.000000Z",
        ...overrides,
    };
}
export function createCartResponse(quantity = 2, overrides = {}) {
    const product = createBackendProduct();
    const subtotal = Number(product.sale_price) * quantity;
    return {
        message: "Cart retrieved successfully.",
        data: {
            id: 77,
            status: "ACTIVE",
            item_count: quantity > 0 ? 1 : 0,
            total_quantity: quantity,
            subtotal,
            items: quantity > 0
                ? [
                    {
                        id: 501,
                        product_id: product.id,
                        quantity,
                        unit_price: product.sale_price,
                        line_total: subtotal,
                        product,
                    },
                ]
                : [],
            ...overrides,
        },
    };
}
export function createOrderDetail(overrides = {}) {
    return {
        id: 9001,
        order_no: "ORD-9001",
        payment_method: "COD",
        status: "PENDING",
        subtotal: 360000,
        shipping_fee: 0,
        discount_amount: 0,
        total_amount: 360000,
        item_count: 1,
        payment: null,
        stock_deducted: false,
        stock_deducted_at: null,
        shipping_carrier: null,
        shipping_code: null,
        shipped_at: null,
        delivered_at: null,
        cancelled_at: null,
        created_at: "2026-04-20T08:00:00.000000Z",
        updated_at: "2026-04-20T08:00:00.000000Z",
        recipient_name: "Nguyen Van A",
        recipient_phone: "0909123456",
        shipping_address: "123 Nguyen Trai, Ha Noi",
        note: "Giao gio hanh chinh",
        items: [
            {
                id: 1,
                product_id: 101,
                product_name_snapshot: "Tra huu co",
                quantity: 3,
                unit_price: 120000,
                line_total: 360000,
            },
        ],
        status_history: [
            {
                id: 1,
                changed_by_user_id: null,
                from_status: null,
                to_status: "PENDING",
                note: "Order created",
                changed_at: "2026-04-20T08:00:00.000000Z",
            },
        ],
        allowed_next_statuses: ["CONFIRMED", "CANCELLED"],
        payment_status_history: [],
        ...overrides,
    };
}
export function createOrdersResponse(detail = createOrderDetail()) {
    return {
        message: "Orders retrieved successfully.",
        data: [
            {
                id: detail.id,
                order_no: detail.order_no,
                payment_method: detail.payment_method,
                status: detail.status,
                subtotal: detail.subtotal,
                shipping_fee: detail.shipping_fee,
                discount_amount: detail.discount_amount,
                total_amount: detail.total_amount,
                item_count: detail.item_count,
                payment: detail.payment,
                stock_deducted: detail.stock_deducted,
                stock_deducted_at: detail.stock_deducted_at,
                shipping_carrier: detail.shipping_carrier,
                shipping_code: detail.shipping_code,
                shipped_at: detail.shipped_at,
                delivered_at: detail.delivered_at,
                cancelled_at: detail.cancelled_at,
                created_at: detail.created_at,
                updated_at: detail.updated_at,
            },
        ],
        pagination: {
            current_page: 1,
            last_page: 1,
            per_page: 15,
            total: 1,
        },
    };
}
