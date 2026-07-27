import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppBootstrap } from "@/app/app-bootstrap";
import { AppRoutes } from "@/app/router";
import { buildStorefrontSlug } from "@/shared/api/storefront-adapters";
import { routes } from "@/shared/config/routes";
import { resetDemoState } from "@/shared/lib/store/reset-demo";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { useCartStore } from "@/shared/lib/store/use-cart-store";
import { createBackendProduct, createBackendUser, createCartResponse, createOrderDetail, createOrdersResponse, getJsonBody, getRequestPath, jsonResponse, } from "@/test/backend-test-utils";
function renderApp(route) {
    return render(<MemoryRouter initialEntries={[route]}>
            <AppBootstrap />
            <AppRoutes />
        </MemoryRouter>);
}
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
        accessTokenExpiresAt: "2026-12-31T10:00:00.000Z",
        authSource: "backend",
    });
}
function setBackendAdminSession() {
    useAuthStore.setState({
        session: {
            user: {
                id: "1",
                name: "Root Admin",
                email: "admin@example.com",
                role: "admin",
            },
            loggedInAt: "2026-05-21T00:00:00.000Z",
        },
        accessToken: "admin-token",
        accessTokenExpiresAt: "2026-12-31T10:00:00.000Z",
        authSource: "backend",
    });
}
describe("customer commerce routes", () => {
    beforeEach(() => {
        localStorage.clear();
        resetDemoState();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });
    it("allows guest checkout access, then redirects to login when placing the order", async () => {
        const fetchMock = vi.fn((input, init) => {
            const path = getRequestPath(input);
            if (path.endsWith("/api/login")) {
                return jsonResponse({
                    message: "Logged in successfully.",
                    access_token: "token-1",
                    token_type: "Bearer",
                    expires_at: "2026-04-20T10:00:00.000Z",
                    user: createBackendUser(),
                });
            }
            if (path.endsWith("/api/account/profile")) {
                return jsonResponse({
                    data: {
                        id: 1,
                        name: "Nguyen Van A",
                        email: "customer@example.com",
                        phone: "0909123456",
                        address: "123 Nguyen Trai",
                        city: "Ha Noi",
                        favorite_region: "Thai Nguyen",
                        avatar: null,
                        member_since: "2026-04-20T00:00:00.000000Z",
                        newsletter: false,
                        sms_alerts: false,
                        order_email: true,
                        security_alerts: true,
                        addresses: [],
                        reward_snapshot: {
                            tier: "Member",
                            points: 0,
                            next_tier_points: 100,
                            perks: [],
                        },
                        reward_history: [],
                    },
                }, { status: 200 });
            }
            if (path.endsWith("/api/account/wishlist")) {
                return jsonResponse({
                    data: {
                        product_ids: [],
                        products: [],
                    },
                });
            }
            if (path.endsWith("/api/cart/items") && init?.method === "POST") {
                return jsonResponse(createCartResponse(2));
            }
            if (path.endsWith("/api/cart") && (!init?.method || init.method === "GET")) {
                return jsonResponse(createCartResponse(2));
            }
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
            throw new Error(`Unexpected request: ${path}`);
        });
        vi.stubGlobal("fetch", fetchMock);
        useCartStore.setState({
            guestItems: [{ productId: "101", quantity: 2 }],
            items: [{ productId: "101", quantity: 2 }],
        });
        const user = userEvent.setup();
        renderApp(routes.checkout);
        expect(await screen.findByRole("option", { name: "Ha Noi" })).toBeInTheDocument();
        expect(await screen.findByText(/Tóm tắt đơn hàng/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Đăng nhập để đặt hàng/i })).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: /Đăng nhập để đặt hàng/i }));
        expect(await screen.findByLabelText(/Email/i)).toBeInTheDocument();
        await user.type(screen.getByLabelText(/Email/i), "customer@example.com");
        await user.type(screen.getByLabelText(/Mật khẩu/i), "secret123");
        await user.click(screen.getByRole("button", { name: /^Đăng nhập$/i }));
        expect(await screen.findByText(/Tóm tắt đơn hàng/i)).toBeInTheDocument();
        const syncCall = fetchMock.mock.calls.find(([input, init]) => {
            return (getRequestPath(input).endsWith("/api/cart/items") &&
                init?.method === "POST" &&
                getJsonBody(init)?.quantity === 2);
        });
        expect(syncCall).toBeTruthy();
    });
    it("shows a loading state on the home page while the catalog is pending", async () => {
        const pending = new Promise(() => undefined);
        const fetchMock = vi.fn(() => pending);
        vi.stubGlobal("fetch", fetchMock);
        renderApp(routes.home);
        expect(await screen.findByText(/Đang tải danh mục/i)).toBeInTheDocument();
    });
    it("renders published posts on the story page for guests", async () => {
        const fetchMock = vi.fn((input) => {
            const path = getRequestPath(input);
            if (path.endsWith("/api/posts")) {
                return jsonResponse({
                    message: "Posts retrieved successfully.",
                    data: [
                        {
                            id: 501,
                            title: "Mùa vải thiều Lục Ngạn",
                            excerpt: "Ghi chú mùa vụ mới.",
                            body: "Bài viết đầu mùa từ đội ngũ quản trị.",
                            cover_image_url: null,
                            status: "PUBLISHED",
                            published_at: "2026-05-20T00:00:00.000000Z",
                            created_at: "2026-05-20T00:00:00.000000Z",
                            updated_at: "2026-05-20T00:00:00.000000Z",
                            author: { id: 1, full_name: "Admin", email: "admin@example.com" },
                            likes_count: 3,
                            comments_count: 0,
                            comments: [],
                        },
                    ],
                });
            }
            throw new Error(`Unexpected request: ${path}`);
        });
        vi.stubGlobal("fetch", fetchMock);
        renderApp(routes.story);
        expect(await screen.findByText(/Mùa vải thiều Lục Ngạn/i)).toBeInTheDocument();
        expect(screen.getByText(/Đăng nhập để tương tác/i)).toBeInTheDocument();
    });
    it("lets a backend customer like and comment on a story post", async () => {
        const fetchMock = vi.fn((input, init) => {
            const path = getRequestPath(input);
            if (path.endsWith("/api/me")) {
                return jsonResponse({
                    user: createBackendUser(),
                    expires_at: "2026-12-31T10:00:00.000Z",
                });
            }
            if (path.endsWith("/api/cart") && (!init?.method || init.method === "GET")) {
                return jsonResponse(createCartResponse(0));
            }
            if (path.endsWith("/api/account/profile")) {
                return jsonResponse({
                    data: {
                        id: 1,
                        name: "Nguyen Van A",
                        email: "customer@example.com",
                        phone: "0909123456",
                        address: "123 Nguyen Trai",
                        city: "Ha Noi",
                        favorite_region: "Thai Nguyen",
                        avatar: null,
                        member_since: "2026-04-20T00:00:00.000000Z",
                        newsletter: false,
                        sms_alerts: false,
                        order_email: true,
                        security_alerts: true,
                        addresses: [],
                        reward_snapshot: {
                            tier: "Member",
                            points: 0,
                            next_tier_points: 100,
                            perks: [],
                        },
                        reward_history: [],
                    },
                });
            }
            if (path.endsWith("/api/account/wishlist")) {
                return jsonResponse({
                    data: {
                        product_ids: [],
                        products: [],
                    },
                });
            }
            if (path.endsWith("/api/posts") && (!init?.method || init.method === "GET")) {
                return jsonResponse({
                    message: "Posts retrieved successfully.",
                    data: [
                        {
                            id: 501,
                            title: "Mùa vải thiều Lục Ngạn",
                            excerpt: "Ghi chú mùa vụ mới.",
                            body: "Bài viết đầu mùa từ đội ngũ quản trị.",
                            cover_image_url: null,
                            status: "PUBLISHED",
                            published_at: "2026-05-20T00:00:00.000000Z",
                            created_at: "2026-05-20T00:00:00.000000Z",
                            updated_at: "2026-05-20T00:00:00.000000Z",
                            author: { id: 1, full_name: "Admin", email: "admin@example.com" },
                            likes_count: 0,
                            comments_count: 0,
                            comments: [],
                        },
                    ],
                });
            }
            if (path.endsWith("/api/posts/my-likes")) {
                return jsonResponse({
                    message: "Post likes retrieved successfully.",
                    data: { post_ids: [] },
                });
            }
            if (path.endsWith("/api/posts/501/likes") && init?.method === "POST") {
                return jsonResponse({
                    message: "Post liked successfully.",
                    data: { post_id: 501, liked: true, likes_count: 1 },
                });
            }
            if (path.endsWith("/api/posts/501/comments") && init?.method === "POST") {
                return jsonResponse({
                    message: "Comment created successfully.",
                    data: {
                        id: 900,
                        post_id: 501,
                        user_id: 1,
                        content: getJsonBody(init)?.content,
                        status: "VISIBLE",
                        created_at: "2026-05-21T00:00:00.000000Z",
                        updated_at: "2026-05-21T00:00:00.000000Z",
                        author: {
                            id: 1,
                            full_name: "Nguyen Van A",
                            email: "customer@example.com",
                        },
                    },
                    meta: { post_id: 501, comments_count: 1 },
                }, { status: 201 });
            }
            throw new Error(`Unexpected request: ${path}`);
        });
        vi.stubGlobal("fetch", fetchMock);
        setBackendCustomerSession();
        const user = userEvent.setup();
        renderApp(routes.story);
        expect(await screen.findByText(/Mùa vải thiều Lục Ngạn/i)).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: /0 thích/i }));
        expect(await screen.findByRole("button", { name: /1 thích/i })).toBeInTheDocument();
        await user.type(screen.getByPlaceholderText(/Viết bình luận/i), "Bài viết rất hữu ích");
        await user.click(screen.getByRole("button", { name: /Gửi bình luận/i }));
        expect(await screen.findByText(/Bài viết rất hữu ích/i)).toBeInTheDocument();
    });
    it("lets an admin create a post from the community page", async () => {
        const fetchMock = vi.fn((input, init) => {
            const path = getRequestPath(input);
            if (path.endsWith("/api/me")) {
                return jsonResponse({
                    user: createBackendUser({
                        role: "ADMIN",
                        email: "admin@example.com",
                    }),
                    expires_at: "2026-12-31T10:00:00.000Z",
                });
            }
            if (path.endsWith("/api/admin/community")) {
                return jsonResponse({
                    message: "Community data retrieved successfully.",
                    data: {
                        suppliers: [],
                        customers: [],
                        invitations: [],
                    },
                });
            }
            if (path.endsWith("/api/admin/posts") && (!init?.method || init.method === "GET")) {
                return jsonResponse({
                    message: "Admin posts retrieved successfully.",
                    data: [],
                });
            }
            if (path.endsWith("/api/admin/posts") && init?.method === "POST") {
                const body = getJsonBody(init);
                return jsonResponse({
                    message: "Post created successfully.",
                    data: {
                        id: 777,
                        title: body?.title,
                        excerpt: body?.excerpt,
                        body: body?.body,
                        cover_image_url: body?.cover_image_url,
                        status: body?.status,
                        published_at: "2026-05-22T00:00:00.000000Z",
                        created_at: "2026-05-22T00:00:00.000000Z",
                        updated_at: "2026-05-22T00:00:00.000000Z",
                        author: { id: 1, full_name: "Root Admin", email: "admin@example.com" },
                        likes_count: 0,
                        comments_count: 0,
                        comments: [],
                    },
                }, { status: 201 });
            }
            throw new Error(`Unexpected request: ${path}`);
        });
        vi.stubGlobal("fetch", fetchMock);
        setBackendAdminSession();
        const user = userEvent.setup();
        renderApp(routes.adminCommunity);
        expect(await screen.findByText(/Danh sách bài viết/i)).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: /Bài mới/i }));
        await user.type(screen.getByPlaceholderText(/Tiêu đề/i), "Bài viết admin mới");
        await user.type(screen.getByPlaceholderText(/Nội dung bài viết/i), "Nội dung từ admin.");
        await user.selectOptions(screen.getByDisplayValue("DRAFT"), "PUBLISHED");
        await user.click(screen.getByRole("button", { name: /Tạo mới/i }));
        expect((await screen.findAllByText(/Bài viết admin mới/i)).length).toBeGreaterThan(0);
        const createCall = fetchMock.mock.calls.find(([input, init]) => {
            return getRequestPath(input).endsWith("/api/admin/posts") && init?.method === "POST";
        });
        expect(createCall).toBeTruthy();
    });
    it("loads admin customer order history on the dedicated route", async () => {
        const fetchMock = vi.fn((input) => {
            const path = getRequestPath(input);
            if (path.endsWith("/api/admin/users/9")) {
                return jsonResponse({
                    message: "Admin user retrieved successfully.",
                    data: {
                        id: 9,
                        full_name: "Customer Managed",
                        email: "managed@example.com",
                        phone: "0909000009",
                        address: "12 Nguyen Trai",
                        city: "Ha Noi",
                        favorite_region: "Dong Bac",
                        avatar_url: null,
                        newsletter: true,
                        sms_alerts: false,
                        order_email: true,
                        security_alerts: true,
                        reward_points: 120,
                        reward_tier: "Silver",
                        next_tier_points: 1000,
                        role: "CUSTOMER",
                        is_active: true,
                        is_deleted: false,
                        orders_count: 2,
                        created_at: "2026-05-22T00:00:00.000000Z",
                        updated_at: "2026-05-22T00:00:00.000000Z",
                    },
                });
            }
            if (path.endsWith("/api/admin/users/9/orders")) {
                return jsonResponse({
                    message: "Orders retrieved successfully.",
                    data: [
                        {
                            id: 101,
                            order_no: "ORD-HISTORY-101",
                            payment_method: "BANK_TRANSFER",
                            status: "CONFIRMED",
                            subtotal: 250000,
                            shipping_fee: 0,
                            discount_amount: 10000,
                            total_amount: 240000,
                            item_count: 2,
                            payment: {
                                id: 1,
                                transaction_code: "PAY-101",
                                payment_method: "BANK_TRANSFER",
                                payment_status: "SUCCESS",
                                amount: 240000,
                                gateway_name: "Manual Bank",
                                gateway_reference: "REF-101",
                                paid_at: "2026-05-22T08:00:00.000000Z",
                            },
                            shipping_carrier: "GHN",
                            shipping_code: "GHN-101",
                            stock_deducted: false,
                            stock_deducted_at: null,
                            shipment: null,
                            created_at: "2026-05-22T08:00:00.000000Z",
                            updated_at: "2026-05-22T08:30:00.000000Z",
                        },
                        {
                            id: 102,
                            order_no: "ORD-HISTORY-102",
                            payment_method: "COD",
                            status: "DELIVERED",
                            subtotal: 90000,
                            shipping_fee: 15000,
                            discount_amount: 0,
                            total_amount: 105000,
                            item_count: 1,
                            payment: {
                                id: 2,
                                transaction_code: "PAY-102",
                                payment_method: "COD",
                                payment_status: "SUCCESS",
                                amount: 105000,
                                gateway_name: null,
                                gateway_reference: null,
                                paid_at: "2026-05-20T11:00:00.000000Z",
                            },
                            shipping_carrier: "Manual",
                            shipping_code: "SHIP-102",
                            stock_deducted: false,
                            stock_deducted_at: null,
                            shipment: null,
                            created_at: "2026-05-20T08:00:00.000000Z",
                            updated_at: "2026-05-20T12:00:00.000000Z",
                        },
                    ],
                    current_page: 1,
                    last_page: 1,
                    per_page: 5,
                    total: 2,
                });
            }
            throw new Error(`Unexpected request: ${path}`);
        });
        vi.stubGlobal("fetch", fetchMock);
        setBackendAdminSession(["admin.users.view", "admin.orders.view"]);
        renderApp(routes.adminUserOrders("9"));
        expect(await screen.findByText("Customer Managed")).toBeInTheDocument();
        expect(screen.getByText("ORD-HISTORY-101")).toBeInTheDocument();
        expect(screen.getByText("ORD-HISTORY-102")).toBeInTheDocument();
    });
    it("loads admin customer order detail on the dedicated route", async () => {
        const fetchMock = vi.fn((input) => {
            const path = getRequestPath(input);
            if (path.endsWith("/api/admin/users/9")) {
                return jsonResponse({
                    message: "Admin user retrieved successfully.",
                    data: {
                        id: 9,
                        full_name: "Customer Managed",
                        email: "managed@example.com",
                        phone: "0909000009",
                        address: "12 Nguyen Trai",
                        city: "Ha Noi",
                        favorite_region: "Dong Bac",
                        avatar_url: null,
                        newsletter: true,
                        sms_alerts: false,
                        order_email: true,
                        security_alerts: true,
                        reward_points: 120,
                        reward_tier: "Silver",
                        next_tier_points: 1000,
                        role: "CUSTOMER",
                        is_active: true,
                        is_deleted: false,
                        orders_count: 2,
                        created_at: "2026-05-22T00:00:00.000000Z",
                        updated_at: "2026-05-22T00:00:00.000000Z",
                    },
                });
            }
            if (path.endsWith("/api/admin/orders/101")) {
                return jsonResponse({
                    message: "Order retrieved successfully.",
                    data: {
                        id: 101,
                        order_no: "ORD-HISTORY-101",
                        recipient_name: "Khach Lich Su",
                        recipient_phone: "0909888777",
                        shipping_address: "99 Pho Hue, Ha Noi",
                        shipping_line1: "99 Pho Hue",
                        shipping_province_id: 1,
                        shipping_province_name: "Ha Noi",
                        shipping_district_id: 2,
                        shipping_district_name: "Hai Ba Trung",
                        shipping_ward_code: "00001",
                        shipping_ward_name: "Pham Dinh Ho",
                        payment_method: "BANK_TRANSFER",
                        status: "CONFIRMED",
                        subtotal: 250000,
                        shipping_fee: 0,
                        discount_amount: 10000,
                        total_amount: 240000,
                        stock_deducted: false,
                        stock_deducted_at: null,
                        shipping_carrier: "GHN",
                        shipping_code: "GHN-101",
                        shipped_at: null,
                        delivered_at: null,
                        cancelled_at: null,
                        note: "Khach yeu cau giao trong gio hanh chinh",
                        item_count: 2,
                        allowed_next_statuses: [],
                        allowed_payment_statuses: [],
                        customer: {
                            id: 9,
                            full_name: "Customer Managed",
                            email: "managed@example.com",
                            phone: "0909000009",
                            role: "CUSTOMER",
                            is_active: true,
                            is_deleted: false,
                        },
                        items: [
                            {
                                id: 1,
                                product_id: 201,
                                product_name_snapshot: "Tra Shan Tuyet",
                                quantity: 1,
                                unit_price: 120000,
                                line_total: 120000,
                            },
                        ],
                        payment: {
                            id: 1,
                            transaction_code: "PAY-101",
                            payment_method: "BANK_TRANSFER",
                            payment_status: "SUCCESS",
                            amount: 240000,
                            gateway_name: "Manual Bank",
                            gateway_reference: "REF-101",
                            paid_at: "2026-05-22T08:00:00.000000Z",
                            raw_payload: {
                                bank_name: "MB Bank",
                                account_name: "HERITAGE HARVEST",
                                account_number: "0123456789",
                                transfer_content: "ORD-HISTORY-101",
                                customer_transfer_submitted: true,
                            },
                        },
                        shipment: null,
                        status_history: [],
                        payment_status_history: [],
                        created_at: "2026-05-22T08:00:00.000000Z",
                        updated_at: "2026-05-22T08:30:00.000000Z",
                    },
                });
            }
            throw new Error(`Unexpected request: ${path}`);
        });
        vi.stubGlobal("fetch", fetchMock);
        setBackendAdminSession(["admin.users.view", "admin.orders.view"]);
        renderApp(routes.adminUserOrderDetail("9", "101"));
        expect(await screen.findByText("Tra Shan Tuyet")).toBeInTheDocument();
        expect(screen.getByText("Khach Lich Su")).toBeInTheDocument();
    });
    it("shows an empty state on the dedicated admin customer order history route", async () => {
        const fetchMock = vi.fn((input) => {
            const path = getRequestPath(input);
            if (path.endsWith("/api/admin/users/10")) {
                return jsonResponse({
                    message: "Admin user retrieved successfully.",
                    data: {
                        id: 10,
                        full_name: "Zero Order Customer",
                        email: "zero@example.com",
                        phone: "0909000010",
                        address: null,
                        city: "Da Nang",
                        favorite_region: null,
                        avatar_url: null,
                        newsletter: false,
                        sms_alerts: false,
                        order_email: true,
                        security_alerts: true,
                        reward_points: 0,
                        reward_tier: "Bronze",
                        next_tier_points: 500,
                        role: "CUSTOMER",
                        is_active: true,
                        is_deleted: false,
                        orders_count: 0,
                        created_at: "2026-05-22T00:00:00.000000Z",
                        updated_at: "2026-05-22T00:00:00.000000Z",
                    },
                });
            }
            if (path.endsWith("/api/admin/users/10/orders")) {
                return jsonResponse({
                    message: "Orders retrieved successfully.",
                    data: [],
                    current_page: 1,
                    last_page: 1,
                    per_page: 5,
                    total: 0,
                });
            }
            throw new Error(`Unexpected request: ${path}`);
        });
        vi.stubGlobal("fetch", fetchMock);
        setBackendAdminSession(["admin.users.view", "admin.orders.view"]);
        renderApp(routes.adminUserOrders("10"));
        expect(await screen.findByText(/Customer này chưa có đơn hàng nào/i)).toBeInTheDocument();
    });
    it("blocks mismatched admin customer order detail data from rendering", async () => {
        const fetchMock = vi.fn((input) => {
            const path = getRequestPath(input);
            if (path.endsWith("/api/admin/users/9")) {
                return jsonResponse({
                    message: "Admin user retrieved successfully.",
                    data: {
                        id: 9,
                        full_name: "Customer Managed",
                        email: "managed@example.com",
                        phone: "0909000009",
                        address: "12 Nguyen Trai",
                        city: "Ha Noi",
                        favorite_region: "Dong Bac",
                        avatar_url: null,
                        newsletter: true,
                        sms_alerts: false,
                        order_email: true,
                        security_alerts: true,
                        reward_points: 120,
                        reward_tier: "Silver",
                        next_tier_points: 1000,
                        role: "CUSTOMER",
                        is_active: true,
                        is_deleted: false,
                        orders_count: 2,
                        created_at: "2026-05-22T00:00:00.000000Z",
                        updated_at: "2026-05-22T00:00:00.000000Z",
                    },
                });
            }
            if (path.endsWith("/api/admin/orders/101")) {
                return jsonResponse({
                    message: "Order retrieved successfully.",
                    data: {
                        id: 101,
                        order_no: "ORD-HISTORY-101",
                        recipient_name: "Khach Lich Su",
                        recipient_phone: "0909888777",
                        shipping_address: "99 Pho Hue, Ha Noi",
                        payment_method: "BANK_TRANSFER",
                        status: "CONFIRMED",
                        subtotal: 250000,
                        shipping_fee: 0,
                        discount_amount: 10000,
                        total_amount: 240000,
                        stock_deducted: false,
                        stock_deducted_at: null,
                        shipping_carrier: "GHN",
                        shipping_code: "GHN-101",
                        shipped_at: null,
                        delivered_at: null,
                        cancelled_at: null,
                        note: "Khach yeu cau giao trong gio hanh chinh",
                        item_count: 2,
                        allowed_next_statuses: [],
                        allowed_payment_statuses: [],
                        customer: {
                            id: 10,
                            full_name: "Another Customer",
                            email: "other@example.com",
                            phone: "0909000010",
                            role: "CUSTOMER",
                            is_active: true,
                            is_deleted: false,
                        },
                        items: [],
                        payment: null,
                        shipment: null,
                        status_history: [],
                        payment_status_history: [],
                        created_at: "2026-05-22T08:00:00.000000Z",
                        updated_at: "2026-05-22T08:30:00.000000Z",
                    },
                });
            }
            throw new Error(`Unexpected request: ${path}`);
        });
        vi.stubGlobal("fetch", fetchMock);
        setBackendAdminSession(["admin.users.view", "admin.orders.view"]);
        renderApp(routes.adminUserOrderDetail("9", "101"));
        await waitFor(() => {
            expect(fetchMock.mock.calls.some(([input]) => getRequestPath(input).endsWith("/api/admin/orders/101"))).toBe(true);
        });
        expect(screen.getByRole("link", { name: /Quay lại lịch sử đơn hàng/i })).toBeInTheDocument();
        expect(screen.queryByText("Khach Lich Su")).not.toBeInTheDocument();
        expect(screen.queryByText("Another Customer")).not.toBeInTheDocument();
    });
    it("shows a connection error on the catalog page when the API is unavailable", async () => {
        const fetchMock = vi.fn(() => {
            throw new TypeError("Failed to fetch");
        });
        vi.stubGlobal("fetch", fetchMock);
        renderApp(routes.products);
        expect(await screen.findByText(/không thể kết nối đến hệ thống/i)).toBeInTheDocument();
    });
    it("shows a connection error on the product detail page when the API is unavailable", async () => {
        const slug = buildStorefrontSlug(101, "Tra huu co");
        const fetchMock = vi.fn(() => {
            throw new TypeError("Failed to fetch");
        });
        vi.stubGlobal("fetch", fetchMock);
        renderApp(routes.productDetail(slug));
        expect(await screen.findByText(/không thể kết nối đến hệ thống/i)).toBeInTheDocument();
    });
    it("loads backend orders and reorders items back into the cart", async () => {
        const product = createBackendProduct();
        const orderDetail = createOrderDetail({
            items: [
                {
                    id: 1,
                    product_id: product.id,
                    product_name_snapshot: product.name,
                    quantity: 3,
                    unit_price: product.sale_price,
                    line_total: 360000,
                },
            ],
        });
        const fetchMock = vi.fn((input, init) => {
            const path = getRequestPath(input);
            if (path.endsWith("/api/cart") && (!init?.method || init.method === "GET")) {
                return jsonResponse(createCartResponse(0));
            }
            if (path.endsWith("/api/account/profile")) {
                return jsonResponse({
                    data: {
                        id: 1,
                        name: "Nguyen Van A",
                        email: "customer@example.com",
                        phone: "0909123456",
                        address: "123 Nguyen Trai",
                        city: "Ha Noi",
                        favorite_region: "Thai Nguyen",
                        avatar: null,
                        member_since: "2026-04-20T00:00:00.000000Z",
                        newsletter: false,
                        sms_alerts: false,
                        order_email: true,
                        security_alerts: true,
                        addresses: [],
                        reward_snapshot: {
                            tier: "Member",
                            points: 0,
                            next_tier_points: 100,
                            perks: [],
                        },
                        reward_history: [],
                    },
                });
            }
            if (path.endsWith("/api/account/wishlist")) {
                return jsonResponse({
                    data: {
                        product_ids: [],
                        products: [],
                    },
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
            if (path.endsWith("/api/cart/items") && init?.method === "POST") {
                return jsonResponse(createCartResponse(3));
            }
            throw new Error(`Unexpected request: ${path}`);
        });
        vi.stubGlobal("fetch", fetchMock);
        setBackendCustomerSession();
        const user = userEvent.setup();
        renderApp(routes.accountOrders);
        expect(await screen.findByText(/ORD-9001/i)).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: /Xem chi tiết/i }));
        await user.click(await screen.findByRole("button", { name: /Thêm lại vào giỏ/i }));
        expect(await screen.findByText(/Tra huu co/i)).toBeInTheDocument();
        await waitFor(() => {
            const reorderCall = fetchMock.mock.calls.find(([input, init]) => {
                return (getRequestPath(input).endsWith("/api/cart/items") &&
                    init?.method === "POST" &&
                    getJsonBody(init)?.quantity === 3);
            });
            expect(reorderCall).toBeTruthy();
        });
    });
});
