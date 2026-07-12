import { cn } from "@/shared/lib/cn";
import { Icon } from "@/shared/ui/icon";
export function SearchField({ className, ...props }) {
    return (<div className={cn("flex items-center gap-3 rounded-full border border-white/60 bg-surface-container-lowest/90 px-4 py-2.5 shadow-[0px_12px_24px_rgba(26,28,28,0.04)] backdrop-blur-xl", className)}>
            <Icon name="search" className="text-lg text-on-surface-variant"/>
            <input className="w-full bg-transparent text-sm text-on-surface outline-none placeholder:text-on-surface-variant/70" {...props}/>
        </div>);
}
