import { Link } from "react-router-dom";
import { cn } from "@/shared/lib/cn";
import { Icon } from "@/shared/ui/icon";
export function Breadcrumbs({ items, className }) {
    return (<nav className={cn("flex flex-wrap items-center gap-2 text-sm", className)}>
            {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (<div key={`${item.label}-${index}`} className="flex items-center gap-2">
                        {item.href && !isLast ? (<Link className="text-on-surface-variant hover:text-primary" to={item.href}>
                                {item.label}
                            </Link>) : (<span className={isLast ? "font-medium text-primary" : "text-on-surface-variant"}>
                                {item.label}
                            </span>)}
                        {!isLast && (<Icon name="chevron_right" className="text-base text-outline"/>)}
                    </div>);
        })}
        </nav>);
}
