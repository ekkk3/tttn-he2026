import { cn } from "@/shared/lib/cn";
export function Icon({ name, className, fill = false }) {
    return (<span className={cn("material-symbols-outlined select-none", className)} style={{
            fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
        }} aria-hidden="true">
            {name}
        </span>);
}
