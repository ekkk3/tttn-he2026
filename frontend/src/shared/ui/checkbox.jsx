import { cn } from "@/shared/lib/cn";
export function Checkbox({ className, label, ...props }) {
    return (<label className="flex cursor-pointer items-center gap-3 text-sm text-on-surface-variant">
            <input type="checkbox" className={cn("h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary/30", className)} {...props}/>
            <span>{label}</span>
        </label>);
}
