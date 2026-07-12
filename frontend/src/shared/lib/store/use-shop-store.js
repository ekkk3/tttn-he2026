import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { apiRequest, isUnauthorizedApiError } from "@/shared/api/backend-client";
import { adaptBackendProduct } from "@/shared/api/storefront-adapters";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { useStorefrontCatalogStore } from "@/shared/lib/store/use-storefront-catalog-store";
import { registerProtectedSessionCleanup } from "@/shared/lib/store/protected-session";
const initialState = {
    wishlistIds: [],
    recentlyViewedIds: [],
    isWishlistLoading: false,
    isWishlistSaving: false,
    error: null,
};
const SESSION_EXPIRED_MESSAGE = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
function authState() {
    return useAuthStore.getState();
}
function isBackendCustomerSession() {
    const state = authState();
    return state.authSource === "backend" && state.session?.user.role === "customer";
}
function numericProductId(productId) {
    const parsed = Number(productId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
function syncCatalogFromWishlist(response) {
    const nextProducts = response.data.products.map((product, index) => adaptBackendProduct(product, index));
    useStorefrontCatalogStore.setState((state) => {
        const productDetails = { ...state.productDetails };
        for (const product of nextProducts) {
            productDetails[product.id] = product;
        }
        return {
            ...state,
            status: state.status === "idle" ? "ready" : state.status,
            productDetails,
            products: state.products.map((product) => productDetails[product.id] ?? product),
        };
    });
}
export const useShopStore = create()(persist((set, get) => ({
    ...initialState,
    loadWishlist: async () => {
        if (!isBackendCustomerSession()) {
            return {
                success: true,
                data: get().wishlistIds,
            };
        }
        const token = authState().accessToken;
        if (!token) {
            return {
                success: false,
                error: "Bạn cần đăng nhập lại để tải wishlist.",
            };
        }
        set({
            isWishlistLoading: true,
            error: null,
        });
        try {
            let response = await apiRequest("/account/wishlist", {
                token,
            });
            const localWishlist = get().wishlistIds;
            const serverIds = response.data.product_ids.map(String);
            const localOnlyIds = localWishlist.filter((productId) => !serverIds.includes(productId));
            if (localOnlyIds.length > 0) {
                for (const productId of localOnlyIds) {
                    const parsedProductId = numericProductId(productId);
                    if (!parsedProductId) {
                        continue;
                    }
                    response = await apiRequest("/account/wishlist/items", {
                        method: "POST",
                        token,
                        body: {
                            product_id: parsedProductId,
                        },
                    });
                }
            }
            syncCatalogFromWishlist(response);
            const wishlistIds = response.data.product_ids.map(String);
            set({
                wishlistIds,
                isWishlistLoading: false,
                error: null,
            });
            return {
                success: true,
                data: wishlistIds,
            };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set({
                    wishlistIds: [],
                    isWishlistLoading: false,
                    error: SESSION_EXPIRED_MESSAGE,
                });
                return {
                    success: false,
                    error: SESSION_EXPIRED_MESSAGE,
                };
            }
            const message = error instanceof Error ? error.message : "Không thể tải wishlist.";
            set({
                isWishlistLoading: false,
                error: message,
            });
            return {
                success: false,
                error: message,
            };
        }
    },
    toggleWishlist: async (productId) => {
        if (!isBackendCustomerSession()) {
            const nextWishlistIds = get().wishlistIds.includes(productId)
                ? get().wishlistIds.filter((item) => item !== productId)
                : [productId, ...get().wishlistIds];
            set({
                wishlistIds: nextWishlistIds,
                error: null,
            });
            return {
                success: true,
                data: nextWishlistIds,
            };
        }
        const token = authState().accessToken;
        const parsedProductId = numericProductId(productId);
        if (!token || !parsedProductId) {
            return {
                success: false,
                error: "Sản phẩm không hợp lệ để cập nhật wishlist.",
            };
        }
        set({
            isWishlistSaving: true,
            error: null,
        });
        try {
            const isWishlisted = get().wishlistIds.includes(productId);
            const response = isWishlisted
                ? await apiRequest(`/account/wishlist/items/${parsedProductId}`, {
                    method: "DELETE",
                    token,
                })
                : await apiRequest("/account/wishlist/items", {
                    method: "POST",
                    token,
                    body: {
                        product_id: parsedProductId,
                    },
                });
            syncCatalogFromWishlist(response);
            const wishlistIds = response.data.product_ids.map(String);
            set({
                wishlistIds,
                isWishlistSaving: false,
                error: null,
            });
            return {
                success: true,
                data: wishlistIds,
            };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                set({
                    wishlistIds: [],
                    isWishlistSaving: false,
                    error: SESSION_EXPIRED_MESSAGE,
                });
                return {
                    success: false,
                    error: SESSION_EXPIRED_MESSAGE,
                };
            }
            const message = error instanceof Error ? error.message : "Không thể cập nhật wishlist.";
            set({
                isWishlistSaving: false,
                error: message,
            });
            return {
                success: false,
                error: message,
            };
        }
    },
    addRecentlyViewed: (productId) => set((state) => ({
        recentlyViewedIds: [
            productId,
            ...state.recentlyViewedIds.filter((item) => item !== productId),
        ].slice(0, 6),
    })),
    pruneProductReferences: (validProductIds) => set((state) => ({
        wishlistIds: state.wishlistIds.filter((item) => validProductIds.includes(item)),
        recentlyViewedIds: state.recentlyViewedIds.filter((item) => validProductIds.includes(item)),
    })),
    resetServerState: () => set((state) => ({
        wishlistIds: [],
        recentlyViewedIds: state.recentlyViewedIds,
        isWishlistLoading: false,
        isWishlistSaving: false,
        error: null,
    })),
    reset: () => set(initialState),
}), {
    name: "heritage-shop-store",
    storage: createJSONStorage(() => localStorage),
}));
registerProtectedSessionCleanup(() => {
    useShopStore.getState().resetServerState();
});
