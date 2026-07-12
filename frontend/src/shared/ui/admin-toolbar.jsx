import { cn } from "@/shared/lib/cn";
export function AdminToolbar({ children, actions, className }) {
    return (<section className={cn("flex flex-col gap-3 rounded-[1.25rem] border border-outline-variant/15 bg-surface-container-lowest/90 p-3 shadow-[0px_10px_24px_rgba(26,28,28,0.04)] sm:flex-row sm:items-center sm:justify-between", className)}>
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
                {children}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </section>);
}
