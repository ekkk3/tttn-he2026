import { cn } from "@/shared/lib/cn";
import { Icon } from "@/shared/ui/icon";
const modeLabels = {
    view: "Chi tiết",
    create: "Tạo mới",
    edit: "Chỉnh sửa",
};
export function AdminDrawer({ open, mode, title, subtitle, children, footer, onClose, className, }) {
    if (!open)
        return null;
    return (<div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/45 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
            <button type="button" className="hidden flex-1 cursor-default lg:block" aria-label="Đóng khung thông tin" onClick={onClose}/>
            <aside className={cn("flex h-full w-full flex-col bg-surface shadow-[-20px_0_44px_rgba(26,28,28,0.16)] sm:max-w-2xl", className)}>
                <header className="border-b border-outline-variant/15 px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-xs font-label font-semibold uppercase tracking-[0.18em] text-primary">
                                {modeLabels[mode]}
                            </p>
                            <h2 className="mt-2 font-headline text-2xl font-bold text-on-surface">
                                {title}
                            </h2>
                            {subtitle ? (<div className="mt-2 text-sm leading-6 text-on-surface-variant">
                                    {subtitle}
                                </div>) : null}
                        </div>
                        <button type="button" className="rounded-xl bg-surface-container-low p-2 text-on-surface-variant transition hover:text-primary" aria-label="Đóng" onClick={onClose}>
                            <Icon name="close"/>
                        </button>
                    </div>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>

                {footer ? (<footer className="border-t border-outline-variant/15 bg-surface px-6 py-4">
                        {footer}
                    </footer>) : null}
            </aside>
        </div>);
}
