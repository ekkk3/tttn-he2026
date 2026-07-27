import { create } from "zustand";
import { apiRequest } from "@/shared/api/backend-client";
import { adaptBackendCategory, adaptBackendProduct, adaptBackendRegion, adaptBackendSupplierOption, } from "@/shared/api/storefront-adapters";
import { useCartStore } from "@/shared/lib/store/use-cart-store";
import { useShopStore } from "@/shared/lib/store/use-shop-store";
const DEFAULT_PRODUCT_PAGE_SIZE = 15;
const initialState = {
    categories: [],
    regions: [],
    suppliers: [],
    products: [],
    productDetails: {},
    productsPagination: null,
    productsQuery: null,
    status: "idle",
    error: null,
};
// loadCatalog() nhận 2 kiểu tham số cho tiện gọi: 1 boolean đơn giản (force refetch hay
// không, dùng giá trị mặc định cho phần còn lại), hoặc 1 object đầy đủ filter/trang/sort
// khi trang catalog thật sự cần lọc/phân trang.
function resolveLoadOptions(options) {
    if (typeof options === "boolean") {
        return {
            force: options,
            page: 1,
            perPage: DEFAULT_PRODUCT_PAGE_SIZE,
            search: "",
            categoryIds: [],
            supplierIds: [],
            maxPrice: 0,
            sort: "popular",
        };
    }
    return {
        force: options?.force ?? false,
        page: options?.page ?? 1,
        perPage: options?.perPage ?? DEFAULT_PRODUCT_PAGE_SIZE,
        search: options?.search ?? "",
        categoryIds: options?.categoryIds ?? [],
        supplierIds: options?.supplierIds ?? [],
        maxPrice: options?.maxPrice ?? 0,
        sort: options?.sort ?? "popular",
    };
}
function productQueryFromOptions(options) {
    const params = new URLSearchParams({
        page: String(Math.max(1, options.page)),
        per_page: String(Math.max(1, options.perPage)),
    });
    const search = options.search.trim();
    if (search)
        params.set("keyword", search);
    if (options.categoryIds.length)
        params.set("category_id", options.categoryIds.join(","));
    if (options.supplierIds.length)
        params.set("supplier_id", options.supplierIds.join(","));
    if (options.maxPrice > 0)
        params.set("max_price", String(options.maxPrice));
    if (options.sort !== "popular")
        params.set("sort", options.sort);
    return params.toString();
}
// Đọc field phân trang trực tiếp trên response (current_page/last_page/...), nhưng vẫn
// fallback về response.pagination.* nếu có (tương thích ngược với 1 shape response cũ hơn).
function paginationFromProductsResponse(response) {
    const legacyPagination = response.pagination;
    return {
        currentPage: response.current_page ?? legacyPagination?.current_page ?? 1,
        lastPage: response.last_page ?? legacyPagination?.last_page ?? 1,
        perPage: response.per_page ?? legacyPagination?.per_page ?? response.data.length,
        total: response.total ?? legacyPagination?.total ?? response.data.length,
    };
}
export const useStorefrontCatalogStore = create()((set, get) => ({
    ...initialState,
    loadCatalog: async (options) => {
        const resolvedOptions = resolveLoadOptions(options);
        const productQuery = productQueryFromOptions(resolvedOptions);
        // Tránh gọi lại API nếu CÙNG bộ filter/trang vừa được tải (hoặc đang tải) — trừ khi
        // ép buộc (force:true). Giúp chuyển qua lại giữa các trang mà không load lại vô ích.
        if (!resolvedOptions.force) {
            const status = get().status;
            if ((status === "loading" || status === "ready") && get().productsQuery === productQuery) {
                return;
            }
        }
        set({
            status: "loading",
            error: null,
        });
        try {
            const [productsResponse, categoriesResponse, suppliersResponse, regionsResponse] = await Promise.all([
                apiRequest(`/products?${productQuery}`),
                apiRequest("/categories?per_page=100"),
                apiRequest("/suppliers?per_page=100"),
                apiRequest("/regions"),
            ]);
            const categories = categoriesResponse.data.map(adaptBackendCategory);
            const regions = regionsResponse.data.map(adaptBackendRegion);
            const suppliers = suppliersResponse.data.map(adaptBackendSupplierOption);
            const products = productsResponse.data.map((product, index) => adaptBackendProduct(product, index));
            // Sau khi có danh sách sản phẩm CÒN THẬT trên server, dọn luôn tham chiếu "mồ côi"
            // ở các store khác (wishlist, giỏ hàng khách chưa đăng nhập) trỏ tới sản phẩm đã
            // bị xóa/ẩn — tránh hiện sản phẩm không còn tồn tại trong wishlist/giỏ hàng.
            const validProductIds = products.map((product) => product.id);
            useShopStore.getState().pruneProductReferences(validProductIds);
            useCartStore.getState().pruneGuestItems(validProductIds);
            set({
                categories,
                regions,
                suppliers,
                products,
                productsPagination: paginationFromProductsResponse(productsResponse),
                productsQuery: productQuery,
                productDetails: products.reduce((accumulator, product) => {
                    accumulator[product.id] = product;
                    return accumulator;
                }, {}),
                status: "ready",
                error: null,
            });
        }
        catch (error) {
            set({
                status: "error",
                error: error instanceof Error ? error.message : "Không thể tải danh mục storefront.",
            });
        }
    },
    loadProductById: async (productId) => {
        try {
            const response = await apiRequest(`/products/${productId}`);
            const nextProduct = adaptBackendProduct(response.data);
            set((state) => ({
                productDetails: {
                    ...state.productDetails,
                    [nextProduct.id]: {
                        ...(state.products.find((product) => product.id === nextProduct.id) ??
                            state.productDetails[nextProduct.id] ??
                            {}),
                        ...nextProduct,
                    },
                },
            }));
            return nextProduct;
        }
        catch {
            return null;
        }
    },
    reset: () => set(initialState),
}));
