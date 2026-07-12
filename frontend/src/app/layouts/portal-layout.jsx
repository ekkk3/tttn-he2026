import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { cn } from "@/shared/lib/cn";
import { Icon } from "@/shared/ui";
import { PortalSidebar } from "@/widgets/portal-sidebar";
export function PortalLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();
    const variant = location.pathname.startsWith("/supplier") ? "supplier" : "warehouse";
    return (<div className="min-h-screen bg-surface">
            <button className={cn("fixed inset-0 z-40 bg-on-surface/30 transition lg:hidden", sidebarOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0")} aria-label="Đóng điều hướng cổng nội bộ" onClick={() => setSidebarOpen(false)}/>

            <div className={cn("fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 lg:translate-x-0", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
                <PortalSidebar variant={variant}/>
            </div>

            <div className="sticky top-0 z-30 flex items-center justify-between bg-surface/80 px-4 py-4 backdrop-blur-xl lg:hidden">
                <div>
                    <p className="text-sm uppercase tracking-widest text-on-surface-variant">
                        {variant === "supplier" ? "Nhà cung cấp" : "Kho vận"}
                    </p>
                    <h1 className="font-headline text-xl font-bold text-primary">
                        Heritage Harvest
                    </h1>
                </div>
                <button className="rounded-full bg-surface-container-low p-2 text-on-surface-variant" onClick={() => setSidebarOpen(true)} aria-label="Mở điều hướng cổng nội bộ">
                    <Icon name="menu" className="text-2xl"/>
                </button>
            </div>

            <main className="min-h-screen px-4 py-4 lg:ml-64 lg:px-8 lg:py-8">
                <Outlet />
            </main>
        </div>);
}
