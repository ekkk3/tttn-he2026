import { useEffect } from "react";
import { cn } from "@/shared/lib/cn";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
const toneClasses = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-rose-200 bg-rose-50 text-rose-900",
};
export function FeedbackToaster() {
    const toasts = useFeedbackStore((state) => state.toasts);
    const dismissToast = useFeedbackStore((state) => state.dismissToast);
    useEffect(() => {
        if (toasts.length === 0)
            return undefined;
        const timer = window.setTimeout(() => {
            dismissToast(toasts[0].id);
        }, 3200);
        return () => window.clearTimeout(timer);
    }, [dismissToast, toasts]);
    if (toasts.length === 0)
        return null;
    return (<div className="pointer-events-none fixed inset-x-0 top-4 z-[70] mx-auto flex max-w-xl flex-col gap-3 px-4">
            {toasts.map((toast) => (<div key={toast.id} className={cn("pointer-events-auto rounded-2xl border px-4 py-3 text-sm shadow-lg", toneClasses[toast.tone])}>
                    {toast.message}
                </div>))}
        </div>);
}
