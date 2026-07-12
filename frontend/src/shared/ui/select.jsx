import { cn } from "@/shared/lib/cn";
export function Select({ className, ...props }) {
    return (<select className={cn("w-full appearance-none rounded-2xl border border-transparent bg-surface-container-low px-4 py-2.5 text-sm font-medium text-on-surface outline-none transition focus:border-primary/20 focus:ring-2 focus:ring-primary/15", className)} {...props}/>);
}
