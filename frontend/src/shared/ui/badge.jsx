import { cn } from "@/shared/lib/cn";
const toneClasses = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary-container/70 text-on-secondary-fixed-variant",
    tertiary: "bg-tertiary-fixed/70 text-on-tertiary-fixed-variant",
    success: "bg-on-primary-container text-primary",
    warning: "bg-tertiary/10 text-tertiary",
    danger: "bg-error-container text-error",
    neutral: "bg-surface-container-high text-on-surface-variant",
};
export function Badge({ children, tone = "neutral", className }) {
    return (<span className={cn("inline-flex items-center rounded-full px-3 py-1 text-[10px] font-label font-semibold uppercase tracking-[0.14em]", toneClasses[tone], className)}>
            {children}
        </span>);
}
