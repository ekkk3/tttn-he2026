import { create } from "zustand";
import { apiRequest, isUnauthorizedApiError } from "@/shared/api/backend-client";
import { useStorefrontCatalogStore } from "@/shared/lib/store/use-storefront-catalog-store";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { registerProtectedSessionCleanup } from "@/shared/lib/store/protected-session";
const initialState = {
    products: [],
    categories: [],
    suppliers: [],
    isLoading: false,
    isSaving: false,
    error: null,
};
const SESSION_EXPIRED_MESSAGE = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
function token() {
    return useAuthStore.getState().accessToken;
}
// Sau MỌI thao tác admin sửa đổi sản phẩm/danh mục/NCC, ép storefront (trang khách hàng
// xem) tải lại catalog ngay — nếu không, khách hàng đang mở tab storefront sẽ vẫn thấy dữ
// liệu cũ cho tới khi tự F5. Bọc try/catch để lỗi refresh cache không làm hỏng thao tác admin
// (thao tác chính đã thành công, chỉ là cache công khai chưa kịp mới).
async function refreshStorefrontCatalog() {
    try {
        await useStorefrontCatalogStore.getState().loadCatalog(true);
    }
    catch {
        // Admin mutations should not fail just because the storefront cache cannot refresh.
    }
}
export const useAdminCatalogStore = create()((set) => ({
    ...initialState,
    // Cho phép bỏ qua tải sản phẩm (includeProducts:false) khi trang chỉ cần danh mục/NCC,
    // và chọn endpoint /admin/* (đầy đủ, kể cả đã ẩn) hay endpoint public (chỉ active) cho
    // categories/suppliers tùy options — tránh tải dư dữ liệu cho trang không cần.
    loadData: async (options = { includeProducts: true }) => {
        const accessToken = token();
        if (!accessToken) {
            return {
                success: false,
                error: "Bạn cần đăng nhập admin để tải kho dữ liệu.",
            };
        }
        set({ isLoading: true, error: null });
        try {
            const [productsResponse, categoriesResponse, suppliersResponse] = await Promise.all([
                options.includeProducts
                    ? apiRequest("/admin/products", { token: accessToken })
                    : Promise.resolve({
                        message: "Products skipped.",
                        data: [],
                    }),
                apiRequest(options.includeInactiveCategories
                    ? "/admin/categories?per_page=200"
                    : "/categories?per_page=100", { token: accessToken }),
                apiRequest(options.includeInactiveSuppliers
                    ? "/admin/suppliers?per_page=200"
                    : "/suppliers?per_page=100", { token: accessToken }),
            ]);
            set({
                products: productsResponse.data,
                categories: categoriesResponse.data,
                suppliers: suppliersResponse.data,
                isLoading: false,
                error: null,
            });
            return { success: true };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể tải dữ liệu admin.";
            set({ isLoading: false, error: message });
            return { success: false, error: message };
        }
    },
    createProduct: async (payload) => {
        const accessToken = token();
        if (!accessToken)
            return { success: false, error: "Bạn cần đăng nhập admin để tạo sản phẩm." };
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest("/admin/products", {
                method: "POST",
                token: accessToken,
                body: payload,
            });
            set((state) => ({
                products: [response.data, ...state.products],
                isSaving: false,
                error: null,
            }));
            await refreshStorefrontCatalog();
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể tạo sản phẩm.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    updateProduct: async (productId, payload) => {
        const accessToken = token();
        if (!accessToken)
            return { success: false, error: "Bạn cần đăng nhập admin để cập nhật sản phẩm." };
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest(`/admin/products/${productId}`, {
                method: "PUT",
                token: accessToken,
                body: payload,
            });
            set((state) => ({
                products: state.products.map((product) => (product.id === productId ? response.data : product)),
                isSaving: false,
                error: null,
            }));
            await refreshStorefrontCatalog();
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể cập nhật sản phẩm.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    deleteProduct: async (productId) => {
        const accessToken = token();
        if (!accessToken)
            return { success: false, error: "Bạn cần đăng nhập admin để ẩn sản phẩm." };
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest(`/admin/products/${productId}`, {
                method: "DELETE",
                token: accessToken,
            });
            set((state) => ({
                products: state.products.map((product) => product.id === productId ? response.data : product),
                isSaving: false,
                error: null,
            }));
            await refreshStorefrontCatalog();
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể ẩn sản phẩm.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    createCategory: async (payload) => {
        const accessToken = token();
        if (!accessToken)
            return { success: false, error: "Bạn cần đăng nhập admin để tạo danh mục." };
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest("/admin/categories", {
                method: "POST",
                token: accessToken,
                body: payload,
            });
            set((state) => ({
                categories: [...state.categories, response.data],
                isSaving: false,
                error: null,
            }));
            await refreshStorefrontCatalog();
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể tạo danh mục.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    updateCategory: async (categoryId, payload) => {
        const accessToken = token();
        if (!accessToken)
            return { success: false, error: "Bạn cần đăng nhập admin để cập nhật danh mục." };
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest(`/admin/categories/${categoryId}`, {
                method: "PUT",
                token: accessToken,
                body: payload,
            });
            set((state) => ({
                categories: state.categories.map((category) => (category.id === categoryId ? response.data : category)),
                isSaving: false,
                error: null,
            }));
            await refreshStorefrontCatalog();
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể cập nhật danh mục.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    deleteCategory: async (categoryId) => {
        const accessToken = token();
        if (!accessToken)
            return { success: false, error: "Bạn cần đăng nhập admin để ẩn danh mục." };
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest(`/admin/categories/${categoryId}`, {
                method: "DELETE",
                token: accessToken,
            });
            set((state) => ({
                categories: state.categories.map((category) => category.id === categoryId ? response.data : category),
                isSaving: false,
                error: null,
            }));
            await refreshStorefrontCatalog();
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể ẩn danh mục.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    createSupplier: async (payload) => {
        const accessToken = token();
        if (!accessToken)
            return { success: false, error: "Bạn cần đăng nhập admin để tạo nhà cung cấp." };
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest("/admin/suppliers", {
                method: "POST",
                token: accessToken,
                body: payload,
            });
            set((state) => ({
                suppliers: [...state.suppliers, response.data],
                isSaving: false,
                error: null,
            }));
            await refreshStorefrontCatalog();
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể tạo nhà cung cấp.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    updateSupplier: async (supplierId, payload) => {
        const accessToken = token();
        if (!accessToken)
            return { success: false, error: "Bạn cần đăng nhập admin để cập nhật nhà cung cấp." };
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest(`/admin/suppliers/${supplierId}`, {
                method: "PUT",
                token: accessToken,
                body: payload,
            });
            set((state) => ({
                suppliers: state.suppliers.map((supplier) => supplier.id === supplierId ? response.data : supplier),
                isSaving: false,
                error: null,
            }));
            await refreshStorefrontCatalog();
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể cập nhật nhà cung cấp.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    deleteSupplier: async (supplierId) => {
        const accessToken = token();
        if (!accessToken)
            return { success: false, error: "Bạn cần đăng nhập admin để ẩn nhà cung cấp." };
        set({ isSaving: true, error: null });
        try {
            const response = await apiRequest(`/admin/suppliers/${supplierId}`, {
                method: "DELETE",
                token: accessToken,
            });
            set((state) => ({
                suppliers: state.suppliers.map((supplier) => supplier.id === supplierId ? response.data : supplier),
                isSaving: false,
                error: null,
            }));
            await refreshStorefrontCatalog();
            return { success: true, data: response.data };
        }
        catch (error) {
            if (isUnauthorizedApiError(error)) {
                useAuthStore.getState().clearSession();
                return { success: false, error: SESSION_EXPIRED_MESSAGE };
            }
            const message = error instanceof Error ? error.message : "Không thể ẩn nhà cung cấp.";
            set({ isSaving: false, error: message });
            return { success: false, error: message };
        }
    },
    reset: () => set(initialState),
}));
registerProtectedSessionCleanup(() => {
    useAdminCatalogStore.getState().reset();
});
