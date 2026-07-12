import { cn } from "@/shared/lib/cn";
export function Input({ className, ...props }) {
    return (<input className={cn("w-full rounded-2xl border border-transparent bg-surface-container-highest px-4 py-3 text-sm text-on-surface outline-none transition focus:border-primary/20 focus:ring-2 focus:ring-primary/15", className)} {...props}/>);
}
