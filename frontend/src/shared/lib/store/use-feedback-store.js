import { create } from "zustand";
// Hàng đợi toast/thông báo nổi toàn cục, hiển thị bởi widgets/feedback-toaster — bất kỳ
// đâu trong app cũng gọi pushToast() để hiện thông báo mà không cần biết component
// toaster đang render ở đâu trong cây UI.
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
