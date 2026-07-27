import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
// Lưu vài tùy chọn UI vặt (không thuộc dữ liệu nghiệp vụ) mà người dùng mong đợi được
// giữ nguyên qua các lần ghé thăm: kiểu hiển thị catalog, và mục đang chọn ở các trang
// chi tiết supplier/warehouse. Giá trị khởi tạo trỏ vào 1 đơn/SKU mẫu để trang chi tiết
// không trống trơn ở lần đầu mở khi chưa từng chọn gì.
const initialState = {
    catalogView: "grid",
    selectedSupplierOrderId: "HH-7721",
    selectedWarehouseSku: "SKU-TEA-014",
};
export const useUiStore = create()(persist((set) => ({
    ...initialState,
    setCatalogView: (catalogView) => set({ catalogView }),
    setSelectedSupplierOrderId: (selectedSupplierOrderId) => set({ selectedSupplierOrderId }),
    setSelectedWarehouseSku: (selectedWarehouseSku) => set({ selectedWarehouseSku }),
    reset: () => set(initialState),
}), {
    name: "heritage-ui-store",
    storage: createJSONStorage(() => localStorage),
}));
