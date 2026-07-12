import { cn } from "@/shared/lib/cn";
export function AdminPageHeader({ title, description, actions, className, }) {
    return (<section className={cn("flex flex-col justify-between gap-4 md:flex-row md:items-end", className)}>
            <div className="min-w-0">
                <h1 className="mt-3 font-headline text-3xl font-bold text-on-surface">
                    {title}
                </h1>
                {description ? (<p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
                        {description}
                    </p>) : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </section>);
}
