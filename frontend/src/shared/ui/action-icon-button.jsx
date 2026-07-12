import { cn } from "@/shared/lib/cn";
import { Icon } from "@/shared/ui/icon";
const toneClasses = {
    neutral: "text-on-surface-variant hover:border-outline-variant/25 hover:bg-surface-container-low",
    primary: "text-primary hover:border-primary/20 hover:bg-primary/10",
    success: "text-primary hover:border-primary/20 hover:bg-primary/10",
    danger: "text-error hover:border-error/20 hover:bg-error-container/40",
};
export function ActionIconButton({ label, icon, disabled, tone = "neutral", className, onClick, }) {
    function handleClick(event) {
        event.stopPropagation();
        onClick();
    }
    return (<button type="button" className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent transition disabled:cursor-not-allowed disabled:opacity-40", toneClasses[tone], className)} aria-label={label} title={label} disabled={disabled} onClick={handleClick}>
            <Icon name={icon} className="text-xl"/>
        </button>);
}
