import { NavLink } from "react-router-dom";
import { cn } from "@/shared/lib/cn";
import { Icon } from "@/shared/ui/icon";
export function SidebarNav({ items, className }) {
    return (<nav className={cn("space-y-1", className)}>
            {items.map((item) => item.to ? (<NavLink key={item.label} to={item.to} end={item.to === "/" || item.to === "/admin"} className={({ isActive }) => cn("group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium transition-all", isActive
                ? "border-primary/15 bg-primary/10 text-primary shadow-sm"
                : "text-on-surface-variant hover:border-outline-variant/10 hover:bg-white/60 hover:text-primary")}>
                        {({ isActive }) => (<>
                                <Icon name={item.icon} className="text-xl" fill={isActive}/>
                                <span className="truncate">{item.label}</span>
                            </>)}
                    </NavLink>) : (<div key={item.label} className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-on-surface-variant/40">
                        <Icon name={item.icon} className="text-xl"/>
                        <span>{item.label}</span>
                    </div>))}
        </nav>);
}
