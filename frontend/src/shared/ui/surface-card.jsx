import { cn } from "@/shared/lib/cn";
const toneClasses = {
    base: "border border-white/40 bg-surface",
    low: "border border-white/50 bg-surface-container-low",
    lowest: "border border-white/70 bg-surface-container-lowest shadow-[0px_18px_36px_rgba(26,28,28,0.05)]",
    high: "border border-white/35 bg-surface-container-high",
};
export function SurfaceCard({ children, className, tone = "lowest", ...props }) {
    return (<div className={cn("rounded-[1.75rem] p-6 transition-colors duration-200", toneClasses[tone], className)} {...props}>
            {children}
        </div>);
}
