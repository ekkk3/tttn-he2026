import { cn } from "@/shared/lib/cn";
export function TopAppBar({ title, subtitle, search, actions, className }) {
    return (<header className={cn("sticky top-0 z-30 rounded-[1.75rem] border border-white/60 bg-surface/80 px-6 py-4 shadow-[0px_18px_36px_rgba(26,28,28,0.05)] backdrop-blur-2xl", className)}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="space-y-1">
                    <h1 className="font-headline text-2xl font-bold tracking-tight text-primary">
                        {title}
                    </h1>
                    {subtitle ? (<p className="max-w-2xl text-sm leading-6 text-on-surface-variant">
                            {subtitle}
                        </p>) : null}
                </div>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                    {search}
                    {actions}
                </div>
            </div>
        </header>);
}
