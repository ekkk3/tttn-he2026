import { cn } from "@/shared/lib/cn";
import { Icon } from "@/shared/ui/icon";
const toneMap = {
    primary: "text-primary bg-primary/10",
    secondary: "text-secondary bg-secondary-container/70",
    tertiary: "text-tertiary bg-tertiary-fixed/60",
    success: "text-primary bg-on-primary-container",
    warning: "text-tertiary bg-tertiary/10",
    danger: "text-error bg-error-container",
    neutral: "text-on-surface-variant bg-surface-container-high",
};
export function StatCard({ metric, className }) {
    return (<article className={cn("flex h-full flex-col rounded-[1.25rem] border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-[0px_12px_28px_rgba(26,28,28,0.05)]", className)}>
            <div className="flex items-start gap-3">
                <div className={cn("rounded-xl p-2.5", toneMap[metric.tone])}>
                    <Icon name={metric.icon} className="text-2xl" fill/>
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface">
                        {metric.label}
                    </p>
                    {metric.delta || metric.helperText ? (<p className="mt-1 line-clamp-2 text-xs leading-5 text-on-surface-variant">
                            {metric.delta ?? metric.helperText}
                        </p>) : null}
                </div>
            </div>

            <div className="flex flex-1 items-end pt-6">
                <h3 className="font-headline text-3xl font-bold text-on-surface">{metric.value}</h3>
            </div>
        </article>);
}
