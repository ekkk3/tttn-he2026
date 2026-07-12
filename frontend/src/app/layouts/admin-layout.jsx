import { useState } from "react";
import { Outlet } from "react-router-dom";
import { cn } from "@/shared/lib/cn";
import { Icon } from "@/shared/ui";
import { AdminSidebar } from "@/widgets/admin-sidebar";
export function AdminLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    return (<div className="min-h-screen bg-surface">
            <button className={cn("fixed inset-0 z-40 bg-on-surface/30 transition lg:hidden", sidebarOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0")} aria-label="Đóng điều hướng quản trị" onClick={() => setSidebarOpen(false)}/>

            <div className={cn("fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 lg:translate-x-0", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
                <AdminSidebar />
            </div>

            <div className="sticky top-0 z-30 flex items-center justify-between border-b border-outline-variant/10 bg-surface/90 px-4 py-3 backdrop-blur-xl lg:hidden">
                <div>
                    <p className="text-sm uppercase tracking-widest text-on-surface-variant">
                        Quản trị
                    </p>
                    <h1 className="font-headline text-xl font-bold text-primary">
                        Heritage Harvest
                    </h1>
                </div>
                <button className="rounded-xl bg-surface-container-low p-2 text-on-surface-variant" onClick={() => setSidebarOpen(true)} aria-label="Mở điều hướng quản trị">
                    <Icon name="menu" className="text-2xl"/>
                </button>
            </div>

            <main className="min-h-screen px-4 py-5 lg:ml-64 lg:px-10 lg:py-8">
                <Outlet />
            </main>
        </div>);
}
