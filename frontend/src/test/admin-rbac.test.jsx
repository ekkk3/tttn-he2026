import { MemoryRouter } from "react-router-dom";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "@/app/router";
import { adaptBackendUserToSession } from "@/shared/api/storefront-adapters";
import { routes } from "@/shared/config/routes";
import { resetDemoState } from "@/shared/lib/store/reset-demo";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { createBackendUser, getRequestPath, jsonResponse } from "@/test/backend-test-utils";
import { AdminSidebar } from "@/widgets/admin-sidebar";

function renderApp(route) {
    return render(<MemoryRouter initialEntries={[route]}>
            <AppRoutes />
        </MemoryRouter>);
}

function setAdminSession() {
    const nextAuthState = {
        session: {
            user: {
                id: "1",
                name: "Root Admin",
                email: "root@example.com",
                role: "admin",
            },
            loggedInAt: "2026-05-21T00:00:00.000Z",
        },
        accessToken: "admin-token",
        accessTokenExpiresAt: "2099-01-01T00:00:00.000Z",
        authSource: "backend",
    };

    localStorage.setItem("heritage-auth-store", JSON.stringify({
        state: nextAuthState,
        version: 0,
    }));

    act(() => {
        useAuthStore.setState({
            ...nextAuthState,
            isHydrating: false,
        });
    });
}

function getVisibleHrefs() {
    return screen
        .getAllByRole("link")
        .map((link) => link.getAttribute("href"))
        .filter(Boolean);
}

function createAdminCustomer(overrides = {}) {
    return {
        id: 9,
        full_name: "Customer Managed",
        email: "managed@example.com",
        phone: "0909000009",
        address: "12 Nguyen Trai",
        city: "Ha Noi",
        favorite_region: "Dong Bac",
        avatar_url: null,
        role: "CUSTOMER",
        is_active: true,
        is_deleted: false,
        orders_count: 2,
        created_at: "2026-05-22T00:00:00.000000Z",
        updated_at: "2026-05-22T00:00:00.000000Z",
        ...overrides,
    };
}

function createAdminOrderSummary(overrides = {}) {
    return {
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
        ...overrides,
    };
}

function createAdminOrderDetail(overrides = {}) {
    return {
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
        ...overrides,
    };
}

describe("admin frontend role-only access", () => {
    beforeEach(() => {
        localStorage.clear();
        resetDemoState();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("adapts backend admin users into a role-only auth session", () => {
        const session = adaptBackendUserToSession(createBackendUser({
            role: "ADMIN",
            email: "admin@example.com",
        }));

        expect(session?.user).toEqual({
            id: "1",
            name: "Nguyen Van A",
            email: "admin@example.com",
            role: "admin",
        });
    });

    it("shows the full admin navigation for any admin session", () => {
        setAdminSession();

        render(<MemoryRouter>
                <AdminSidebar />
            </MemoryRouter>);

        const hrefs = getVisibleHrefs();

        expect(hrefs).toEqual(expect.arrayContaining([
            routes.adminDashboard,
            routes.adminUsers,
            routes.adminProducts,
            routes.adminCategories,
            routes.adminSuppliers,
            routes.adminShippingCarriers,
            routes.adminLogistics,
            routes.adminCommunity,
            routes.adminSettings,
            routes.adminAdmins,
            routes.adminSupplierOrders,
            routes.adminWarehouseInventory,
        ]));
    });

    it("opens the dedicated admin accounts page for admin sessions", async () => {
        const fetchMock = vi.fn((input) => {
            const path = getRequestPath(input);

            if (path.endsWith("/api/admin/admins")) {
                return jsonResponse({
                    message: "Admin accounts retrieved successfully.",
                    data: [
                        {
                            id: 2,
                            full_name: "Child Admin",
                            email: "child-admin@example.com",
                            phone: "0909000011",
                            role: "ADMIN",
                            is_active: true,
                            is_deleted: false,
                            created_by_admin: {
                                id: 1,
                                full_name: "Root Admin",
                                email: "root@example.com",
                            },
                            created_at: "2026-05-22T00:00:00.000000Z",
                            updated_at: "2026-05-22T00:00:00.000000Z",
                        },
                    ],
                    pagination: { total: 1, per_page: 200, current_page: 1, last_page: 1 },
                });
            }

            throw new Error(`Unexpected request: ${path}`);
        });

        vi.stubGlobal("fetch", fetchMock);
        setAdminSession();
        renderApp(routes.adminAdmins);

        expect(await screen.findByRole("heading", { name: /^Tài khoản admin$/i, level: 1 })).toBeInTheDocument();
        expect(screen.getByText("child-admin@example.com")).toBeInTheDocument();
        expect(screen.getByText(/Tạo bởi Root Admin/i)).toBeInTheDocument();
    });

    it("opens dedicated customer order pages for admin sessions without permission payloads", async () => {
        const managedCustomer = createAdminCustomer();
        const fetchMock = vi.fn((input) => {
            const path = getRequestPath(input);

            if (path.endsWith("/api/admin/users/9")) {
                return jsonResponse({
                    message: "Admin user retrieved successfully.",
                    data: managedCustomer,
                });
            }

            if (path.endsWith("/api/admin/users/9/orders")) {
                return jsonResponse({
                    message: "Orders retrieved successfully.",
                    data: [createAdminOrderSummary()],
                    current_page: 1,
                    last_page: 1,
                    per_page: 5,
                    total: 1,
                });
            }

            if (path.endsWith("/api/admin/orders/101")) {
                return jsonResponse({
                    message: "Order retrieved successfully.",
                    data: createAdminOrderDetail(),
                });
            }

            throw new Error(`Unexpected request: ${path}`);
        });

        vi.stubGlobal("fetch", fetchMock);
        setAdminSession();

        const rendered = renderApp(routes.adminUserOrders("9"));
        expect(await screen.findByText("ORD-HISTORY-101")).toBeInTheDocument();
        rendered.unmount();

        cleanup();
        setAdminSession();
        renderApp(routes.adminUserOrderDetail("9", "101"));
        expect(await screen.findByText("Tra Shan Tuyet")).toBeInTheDocument();
        expect(screen.getByText("Khach Lich Su")).toBeInTheDocument();
    });

    it("lets admin users navigate from the customer drawer to order history", async () => {
        const managedCustomer = createAdminCustomer();
        const fetchMock = vi.fn((input) => {
            const path = getRequestPath(input);

            if (path.endsWith("/api/admin/users")) {
                return jsonResponse({
                    message: "Admin users retrieved successfully.",
                    data: [managedCustomer],
                    pagination: { total: 1, per_page: 200, current_page: 1, last_page: 1 },
                });
            }

            if (path.endsWith("/api/admin/users/9")) {
                return jsonResponse({
                    message: "Admin user retrieved successfully.",
                    data: managedCustomer,
                });
            }

            if (path.endsWith("/api/admin/users/9/orders")) {
                return jsonResponse({
                    message: "Orders retrieved successfully.",
                    data: [createAdminOrderSummary()],
                    current_page: 1,
                    last_page: 1,
                    per_page: 5,
                    total: 1,
                });
            }

            throw new Error(`Unexpected request: ${path}`);
        });

        vi.stubGlobal("fetch", fetchMock);
        setAdminSession();
        renderApp(routes.adminUsers);

        expect(await screen.findByText("managed@example.com")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /Xem Customer Managed/i }));
        await userEvent.click(screen.getByRole("button", { name: /Xem lich su don hang/i }));

        await waitFor(() => {
            expect(fetchMock.mock.calls.some(([input]) => getRequestPath(input).endsWith("/api/admin/users/9/orders"))).toBe(true);
        });

        expect(await screen.findByText("ORD-HISTORY-101")).toBeInTheDocument();
    });
});
