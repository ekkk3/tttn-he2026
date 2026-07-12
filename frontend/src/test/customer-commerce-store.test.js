import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDemoState } from "@/shared/lib/store/reset-demo";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { useCartStore } from "@/shared/lib/store/use-cart-store";
import { useCustomerOrdersStore } from "@/shared/lib/store/use-customer-orders-store";
import { useVietnamLocationStore } from "@/shared/lib/store/use-vietnam-location-store";
import { createBackendUser, createCartResponse, createOrderDetail, createOrdersResponse, getRequestPath, jsonResponse, } from "@/test/backend-test-utils";
function setBackendCustomerSession() {
    useAuthStore.setState({
        session: {
            user: {
                id: "1",
                name: "Nguyen Van A",
                email: "customer@example.com",
                role: "customer",
            },
            loggedInAt: "2026-04-20T08:00:00.000Z",
        },
        accessToken: "token-1",
        authSource: "backend",
    });
}
describe("customer commerce stores", () => {
    beforeEach(() => {
        localStorage.clear();
        resetDemoState();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });
    it("logs in a customer with the backend", async () => {
        const fetchMock = vi.fn(async (input) => {
            const path = getRequestPath(input);
            if (path.endsWith("/api/login")) {
                return jsonResponse({
                    message: "Logged in successfully.",
                    access_token: "token-1",
                    token_type: "Bearer",
                    user: createBackendUser(),
                });
            }
            throw new Error(`Unexpected request: ${path}`);
        });
        vi.stubGlobal("fetch", fetchMock);
        const result = await useAuthStore.getState().login("customer@example.com", "secret123");
        expect(result).toEqual({ success: true });
        expect(useAuthStore.getState().accessToken).toBe("token-1");
        expect(useAuthStore.getState().authSource).toBe("backend");
        expect(useAuthStore.getState().session?.user.role).toBe("customer");
    });
    it("reports login failures and clears expired backend sessions during hydrate", async () => {
        const fetchMock = vi.fn(async (input) => {
            const path = getRequestPath(input);
            if (path.endsWith("/api/login")) {
                return jsonResponse({
                    message: "Invalid credentials.",
                }, { status: 401 });
            }
            if (path.endsWith("/api/me")) {
                return jsonResponse({
                    message: "Unauthenticated.",
                }, { status: 401 });
            }
            throw new Error(`Unexpected request: ${path}`);
        });
        vi.stubGlobal("fetch", fetchMock);
        const failedLogin = await useAuthStore.getState().login("customer@example.com", "bad-password");
        expect(failedLogin.success).toBe(false);
        expect(failedLogin.error).toMatch(/Invalid credentials/i);
        setBackendCustomerSession();
        useCartStore.setState({
            guestItems: [{ productId: "guest-1", quantity: 1 }],
            items: [{ productId: "101", quantity: 2 }],
            cart: {
                id: "77",
                status: "ACTIVE",
                itemCount: 1,
                totalQuantity: 2,
                subtotal: 240000,
                items: [
                    {
                        id: "501",
                        productId: "101",
                        quantity: 2,
                        unitPrice: 120000,
                        lineTotal: 240000,
                        product: {
                            id: "101",
                            slug: "tra-huu-co-101",
                            name: "Tra huu co",
                            detailTitle: "Tra huu co",
                            subtitle: "Tra · Hop tac xa Moc",
                            categoryId: "5",
                            categoryName: "Tra",
                            supplierId: "8",
                            supplierName: "Hop tac xa Moc",
                            regionId: "8",
                            regionName: "Hop tac xa Moc",
                            description: "San pham backend cho customer commerce.",
                            shortDescription: "San pham backend cho customer commerce.",
                            price: 120000,
                            rating: 0,
                            reviewCount: 0,
                            stockStatus: "in-stock",
                            tag: "SKU-101",
                            image: "https://example.com/product.jpg",
                            gallery: [
                                {
                                    src: "https://example.com/product.jpg",
                                    alt: "Tra huu co",
                                },
                            ],
                            origin: "Thai Nguyen",
                            weight: "500g",
                            shelfLife: "30 ngay",
                            certifications: ["Tra"],
                            shippingNotice: {
                                title: "San sang giao hang",
                                description: "San pham dang co san tren backend.",
                            },
                            sourcing: {
                                title: "Thong tin san pham",
                                body: "San pham backend cho customer commerce.",
                                certificationCards: [
                                    {
                                        icon: "inventory_2",
                                        title: "SKU",
                                        description: "SKU-101",
                                    },
                                ],
                            },
                            heritageCommitments: [
                                {
                                    icon: "verified",
                                    text: "Cam ket tu backend",
                                },
                            ],
                        },
                    },
                ],
            },
        });
        useCustomerOrdersStore.setState({
            orders: [
                {
                    id: "9001",
                    orderNo: "ORD-9001",
                    paymentMethod: "COD",
                    status: "PENDING",
                    subtotal: 360000,
                    shippingFee: 0,
                    discountAmount: 0,
                    totalAmount: 360000,
                    itemCount: 1,
                    payment: null,
                    createdAt: "2026-04-20T08:00:00.000000Z",
                    updatedAt: "2026-04-20T08:00:00.000000Z",
                },
            ],
        });
        await useAuthStore.getState().hydrateSession();
        expect(useAuthStore.getState().session).toBeNull();
        expect(useAuthStore.getState().accessToken).toBeNull();
        expect(useCartStore.getState().cart).toBeNull();
        expect(useCartStore.getState().items).toEqual([{ productId: "guest-1", quantity: 1 }]);
        expect(useCustomerOrdersStore.getState().orders).toEqual([]);
    });
    it("syncs the guest cart, then updates and removes backend cart items", async () => {
        const fetchMock = vi.fn(async (input, init) => {
            const path = getRequestPath(input);
            if (path.endsWith("/api/cart/items") && init?.method === "POST") {
                return jsonResponse(createCartResponse(2));
            }
            if (path.endsWith("/api/cart") && (!init?.method || init.method === "GET")) {
                return jsonResponse(createCartResponse(2));
            }
            if (path.endsWith("/api/cart/items/501") && init?.method === "PATCH") {
                return jsonResponse(createCartResponse(5));
            }
            if (path.endsWith("/api/cart/items/501") && init?.method === "DELETE") {
                return jsonResponse(createCartResponse(0));
            }
            throw new Error(`Unexpected request: ${path}`);
        });
        vi.stubGlobal("fetch", fetchMock);
        await useCartStore.getState().addItem("101", 2);
        expect(useCartStore.getState().guestItems).toEqual([{ productId: "101", quantity: 2 }]);
        setBackendCustomerSession();
        const syncResult = await useCartStore.getState().syncGuestCart();
        expect(syncResult.success).toBe(true);
        expect(useCartStore.getState().guestItems).toEqual([]);
        expect(useCartStore.getState().cart?.items[0]?.quantity).toBe(2);
        const updateResult = await useCartStore.getState().setQuantity("101", 5);
        expect(updateResult.success).toBe(true);
        expect(useCartStore.getState().cart?.items[0]?.quantity).toBe(5);
        const removeResult = await useCartStore.getState().removeItem("101");
        expect(removeResult.success).toBe(true);
        expect(useCartStore.getState().cart?.items).toHaveLength(0);
    });
    it("checks out, loads paginated orders, and loads order details from the backend", async () => {
        const orderDetail = createOrderDetail();
        const fetchMock = vi.fn(async (input, init) => {
            const path = getRequestPath(input);
            if (path.endsWith("/api/orders/checkout") && init?.method === "POST") {
                return jsonResponse({
                    message: "Order created successfully.",
                    data: orderDetail,
                });
            }
            if (path.endsWith("/api/orders") && (!init?.method || init.method === "GET")) {
                return jsonResponse(createOrdersResponse(orderDetail));
            }
            if (path.endsWith("/api/orders/9001") && (!init?.method || init.method === "GET")) {
                return jsonResponse({
                    message: "Order retrieved successfully.",
                    data: orderDetail,
                });
            }
            throw new Error(`Unexpected request: ${path}`);
        });
        vi.stubGlobal("fetch", fetchMock);
        setBackendCustomerSession();
        const checkoutResult = await useCustomerOrdersStore.getState().checkout({
            recipient_name: "Nguyen Van A",
            recipient_phone: "0909123456",
            shipping_address: "123 Nguyen Trai, Ha Noi",
            note: "Giao gio hanh chinh",
            payment_method: "BANK_TRANSFER",
            payment_gateway: "Vietcombank",
        });
        expect(checkoutResult.success).toBe(true);
        expect(useCustomerOrdersStore.getState().orders[0]?.orderNo).toBe("ORD-9001");
        expect(useCustomerOrdersStore.getState().orderDetails["9001"]?.recipientName).toBe("Nguyen Van A");
        const ordersResult = await useCustomerOrdersStore.getState().loadOrders();
        expect(ordersResult.success).toBe(true);
        expect(useCustomerOrdersStore.getState().pagination?.total).toBe(1);
        useCustomerOrdersStore.setState({
            orderDetails: {},
        });
        const detailResult = await useCustomerOrdersStore.getState().loadOrder("9001");
        expect(detailResult.success).toBe(true);
        expect(useCustomerOrdersStore.getState().orderDetails["9001"]?.items[0]?.quantity).toBe(3);
    });
    it("reads customer order pagination from top-level paginator fields", async () => {
        const orderDetail = createOrderDetail({
            id: 9100,
            order_no: "ORD-9100",
        });
        const fetchMock = vi.fn(async (input, init) => {
            const path = getRequestPath(input);
            if (path.endsWith("/api/orders") && (!init?.method || init.method === "GET")) {
                return jsonResponse({
                    message: "Orders retrieved successfully.",
                    data: [
                        {
                            id: orderDetail.id,
                            order_no: orderDetail.order_no,
                            payment_method: orderDetail.payment_method,
                            status: orderDetail.status,
                            subtotal: orderDetail.subtotal,
                            shipping_fee: orderDetail.shipping_fee,
                            discount_amount: orderDetail.discount_amount,
                            total_amount: orderDetail.total_amount,
                            item_count: orderDetail.item_count,
                            payment: orderDetail.payment,
                            stock_deducted: orderDetail.stock_deducted,
                            stock_deducted_at: orderDetail.stock_deducted_at,
                            shipping_carrier: orderDetail.shipping_carrier,
                            shipping_code: orderDetail.shipping_code,
                            shipped_at: orderDetail.shipped_at,
                            delivered_at: orderDetail.delivered_at,
                            cancelled_at: orderDetail.cancelled_at,
                            created_at: orderDetail.created_at,
                            updated_at: orderDetail.updated_at,
                        },
                    ],
                    current_page: 1,
                    last_page: 3,
                    per_page: 15,
                    total: 31,
                });
            }
            throw new Error(`Unexpected request: ${path}`);
        });
        vi.stubGlobal("fetch", fetchMock);
        setBackendCustomerSession();
        const result = await useCustomerOrdersStore.getState().loadOrders();
        expect(result.success).toBe(true);
        expect(useCustomerOrdersStore.getState().pagination).toEqual({
            currentPage: 1,
            lastPage: 3,
            perPage: 15,
            total: 31,
        });
    });
    it("loads vietnam provinces, districts, and wards with cache reuse", async () => {
        const fetchMock = vi.fn(async (input) => {
            const path = getRequestPath(input);
            if (path === "/api/v1/" || path === "/api/v1") {
                return jsonResponse([
                    {
                        code: 1,
                        name: "Ha Noi",
                        codename: "ha_noi",
                        division_type: "thanh pho",
                        districts: [
                            {
                                code: 11,
                                name: "Ba Dinh",
                                codename: "ba_dinh",
                                division_type: "quan",
                                province_code: 1,
                            },
                        ],
                    },
                ]);
            }
            if (path === "/api/v1/d/11") {
                return jsonResponse({
                    code: 11,
                    name: "Ba Dinh",
                    codename: "ba_dinh",
                    division_type: "quan",
                    province_code: 1,
                    wards: [
                        {
                            code: 11111,
                            name: "Phuc Xa",
                            codename: "phuc_xa",
                            division_type: "phuong",
                            district_code: 11,
                        },
                    ],
                });
            }
            throw new Error(`Unexpected request: ${path}`);
        });
        vi.stubGlobal("fetch", fetchMock);
        const provincesResult = await useVietnamLocationStore.getState().loadProvinces();
        const districtsResult = await useVietnamLocationStore.getState().loadDistricts(1);
        const wardsResult = await useVietnamLocationStore.getState().loadWards(11);
        expect(provincesResult.success).toBe(true);
        expect(districtsResult.success).toBe(true);
        expect(wardsResult.success).toBe(true);
        expect(useVietnamLocationStore.getState().provinces[0]?.name).toBe("Ha Noi");
        expect(useVietnamLocationStore.getState().districtsByProvince["1"]?.[0]?.name).toBe("Ba Dinh");
        expect(useVietnamLocationStore.getState().wardsByDistrict["11"]?.[0]?.name).toBe("Phuc Xa");
        await useVietnamLocationStore.getState().loadDistricts(1);
        await useVietnamLocationStore.getState().loadWards(11);
        expect(fetchMock.mock.calls.filter(([input]) => getRequestPath(input) === "/api/v1/")).toHaveLength(1);
        expect(fetchMock.mock.calls.filter(([input]) => getRequestPath(input) === "/api/v1/d/11")).toHaveLength(1);
    });
});
