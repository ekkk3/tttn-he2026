import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
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
