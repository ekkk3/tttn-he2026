import { create } from "zustand";
export const useFeedbackStore = create((set) => ({
    toasts: [],
    pushToast: (toast) => set((state) => ({
        toasts: [
            ...state.toasts,
            {
                id: `${Date.now()}-${state.toasts.length + 1}`,
                ...toast,
            },
        ],
    })),
    dismissToast: (toastId) => set((state) => ({
        toasts: state.toasts.filter((toast) => toast.id !== toastId),
    })),
    clear: () => set({ toasts: [] }),
}));
