import { beforeEach, describe, expect, it, vi } from "vitest";
import { Outlet, MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductDetailPage } from "@/pages/product-detail/ui/product-detail-page";
import { buildStorefrontSlug } from "@/shared/api/storefront-adapters";
import { routes } from "@/shared/config/routes";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { resetDemoState } from "@/shared/lib/store/reset-demo";
import { createBackendProduct, createCartResponse, getJsonBody, getRequestPath, jsonResponse, } from "@/test/backend-test-utils";
import { StorefrontHeader } from "@/widgets/storefront-header";
function renderStorefront(route) {
    return render(<MemoryRouter initialEntries={[route]}>
            <Routes>
                <Route path="/" element={<>
                            <StorefrontHeader />
                            <Outlet />
                        </>}>
                    <Route path={routes.productDetail()} element={<ProductDetailPage />}/>
                    <Route path={routes.checkout} element={<div>Checkout Route</div>}/>
                </Route>
            </Routes>
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
            loggedInAt: "2026-05-23T08:00:00.000Z",
        },
        accessToken: "token-1",
        accessTokenExpiresAt: "2026-12-31T10:00:00.000Z",
        authSource: "backend",
    });
}
function productFixtures() {
    const backendProduct = createBackendProduct({
        id: 101,
        name: "Gao lut do Soc Trang 2kg",
        sku: "GAO-LUT-ST-2KG",
        sale_price: 145000,
        stock_quantity: 39,
        short_description: "Gao - Nong san dac san - Co so Gao Dac San Soc Trang",
        image_url: "https://example.com/rice.jpg",
    });
    const slug = buildStorefrontSlug(backendProduct.id, backendProduct.name);
    return {
        backendProduct,
        slug,
    };
}
describe("Product detail cart badge", () => {
    beforeEach(() => {
        localStorage.clear();
        resetDemoState();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });
    it("updates the header badge immediately for guests after adding from the product detail page", async () => {
        const { backendProduct, slug } = productFixtures();
        const fetchMock = vi.fn((input) => {
            const path = getRequestPath(input);
            if (path.endsWith("/api/products")) {
                return jsonResponse({
                    message: "Products retrieved successfully.",
                    data: [backendProduct],
                    pagination: {
                        current_page: 1,
                        last_page: 1,
                        per_page: 15,
                        total: 1,
                    },
                });
            }
            if (path.endsWith("/api/categories")) {
                return jsonResponse({
                    message: "Categories retrieved successfully.",
                    data: [backendProduct.category],
                });
            }
            if (path.endsWith("/api/suppliers")) {
                return jsonResponse({
                    message: "Suppliers retrieved successfully.",
                    data: [backendProduct.supplier],
                });
            }
            if (path.endsWith("/api/regions")) {
                return jsonResponse({
                    message: "Regions retrieved successfully.",
                    data: [],
                });
            }
            if (path.endsWith("/api/products/101")) {
                return jsonResponse({
                    message: "Product retrieved successfully.",
                    data: backendProduct,
                });
            }
            throw new Error(`Unexpected request: ${path}`);
        });
        vi.stubGlobal("fetch", fetchMock);
        const user = userEvent.setup();
        renderStorefront(routes.productDetail(slug));
        await screen.findByRole("button", { name: /Thêm vào giỏ/i });
        await user.click(screen.getByRole("button", { name: /Thêm vào giỏ/i }));
        const cartLink = screen.getByRole("link", { name: /Giỏ hàng/i });
        expect(within(cartLink).getByText("1")).toBeInTheDocument();
        expect(fetchMock.mock.calls.some(([input]) => getRequestPath(input).endsWith("/api/cart/items"))).toBe(false);
    });
    it("updates the header badge from the backend cart response for signed-in customers", async () => {
        const { backendProduct, slug } = productFixtures();
        const fetchMock = vi.fn((input, init) => {
            const path = getRequestPath(input);
            if (path.endsWith("/api/products")) {
                return jsonResponse({
                    message: "Products retrieved successfully.",
                    data: [backendProduct],
                    pagination: {
                        current_page: 1,
                        last_page: 1,
                        per_page: 15,
                        total: 1,
                    },
                });
            }
            if (path.endsWith("/api/categories")) {
                return jsonResponse({
                    message: "Categories retrieved successfully.",
                    data: [backendProduct.category],
                });
            }
            if (path.endsWith("/api/suppliers")) {
                return jsonResponse({
                    message: "Suppliers retrieved successfully.",
                    data: [backendProduct.supplier],
                });
            }
            if (path.endsWith("/api/regions")) {
                return jsonResponse({
                    message: "Regions retrieved successfully.",
                    data: [],
                });
            }
            if (path.endsWith("/api/products/101")) {
                return jsonResponse({
                    message: "Product retrieved successfully.",
                    data: backendProduct,
                });
            }
            if (path.endsWith("/api/cart/items") && init?.method === "POST") {
                return jsonResponse(createCartResponse(2));
            }
            throw new Error(`Unexpected request: ${path}`);
        });
        vi.stubGlobal("fetch", fetchMock);
        setBackendCustomerSession();
        const user = userEvent.setup();
        renderStorefront(routes.productDetail(slug));
        await screen.findByRole("button", { name: /Thêm vào giỏ/i });
        await user.click(screen.getByRole("button", { name: /Thêm vào giỏ/i }));
        const cartLink = await screen.findByRole("link", { name: /Giỏ hàng/i });
        expect(within(cartLink).getByText("2")).toBeInTheDocument();
        const createCall = fetchMock.mock.calls.find(([input, init]) => getRequestPath(input).endsWith("/api/cart/items") && init?.method === "POST");
        expect(createCall).toBeTruthy();
        expect(getJsonBody(createCall?.[1])).toMatchObject({
            product_id: 101,
            quantity: 1,
        });
    });
    it("waits for add-to-cart success before navigating to checkout from buy-now", async () => {
        const { backendProduct, slug } = productFixtures();
        let resolveAddToCart;
        const addToCartPromise = new Promise((resolve) => {
            resolveAddToCart = resolve;
        });
        const fetchMock = vi.fn((input, init) => {
            const path = getRequestPath(input);
            if (path.endsWith("/api/products")) {
                return jsonResponse({
                    message: "Products retrieved successfully.",
                    data: [backendProduct],
                    pagination: {
                        current_page: 1,
                        last_page: 1,
                        per_page: 15,
                        total: 1,
                    },
                });
            }
            if (path.endsWith("/api/categories")) {
                return jsonResponse({
                    message: "Categories retrieved successfully.",
                    data: [backendProduct.category],
                });
            }
            if (path.endsWith("/api/suppliers")) {
                return jsonResponse({
                    message: "Suppliers retrieved successfully.",
                    data: [backendProduct.supplier],
                });
            }
            if (path.endsWith("/api/regions")) {
                return jsonResponse({
                    message: "Regions retrieved successfully.",
                    data: [],
                });
            }
            if (path.endsWith("/api/products/101")) {
                return jsonResponse({
                    message: "Product retrieved successfully.",
                    data: backendProduct,
                });
            }
            if (path.endsWith("/api/cart/items") && init?.method === "POST") {
                return addToCartPromise;
            }
            throw new Error(`Unexpected request: ${path}`);
        });
        vi.stubGlobal("fetch", fetchMock);
        setBackendCustomerSession();
        const user = userEvent.setup();
        renderStorefront(routes.productDetail(slug));
        await screen.findByRole("button", { name: /Mua ngay/i });
        await user.click(screen.getByRole("button", { name: /Mua ngay/i }));
        expect(screen.queryByText("Checkout Route")).not.toBeInTheDocument();
        resolveAddToCart(jsonResponse(createCartResponse(1)));
        await waitFor(() => {
            expect(screen.getByText("Checkout Route")).toBeInTheDocument();
        });
    });
});
