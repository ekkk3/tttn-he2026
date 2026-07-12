import { Link } from "react-router-dom";
import { adminModules, canAccessAdminModule, } from "@/shared/config/admin-modules";
import { routes } from "@/shared/config/routes";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { SidebarNav } from "@/shared/ui";
const adminSections = [
    { id: "overview", label: "Khu điều khiển" },
    { id: "commerce", label: "Thương mại" },
    { id: "supplier", label: "Cổng nhà cung cấp" },
    { id: "warehouse", label: "Cổng kho vận" },
    { id: "system", label: "Hệ thống" },
];
function toShellNavItem(item) {
    return {
        label: item.label,
        to: item.to,
        icon: item.icon,
    };
}
export function AdminSidebar() {
    const user = useAuthStore((state) => state.session?.user ?? null);
    const visibleItems = adminModules
        .filter((item) => canAccessAdminModule(user, item))
        .reduce((groups, item) => {
        groups[item.section] = [...(groups[item.section] ?? []), toShellNavItem(item)];
        return groups;
    }, {
        overview: [],
        commerce: [],
        supplier: [],
        warehouse: [],
        system: [],
    });
    return (<aside className="flex h-full flex-col overflow-hidden border-r border-outline-variant/10 bg-surface-container-lowest px-3 py-5">
            <div className="mb-7 shrink-0 px-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-on-surface-variant">
                    Quản trị
                </p>
                <h2 className="mt-1 font-headline text-xl font-bold tracking-tight text-primary">
                    Heritage Admin
                </h2>
            </div>

            <div className="scrollbar-none min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
                {adminSections.map((section) => visibleItems[section.id].length > 0 ? (<div key={section.id} className="space-y-2">
                            <p className="px-3 text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant/60">
                                {section.label}
                            </p>
                            <SidebarNav items={visibleItems[section.id]}/>
                        </div>) : null)}
            </div>

            <div className="mt-6 shrink-0 space-y-1 border-t border-outline-variant/10 pt-5">
                {user?.role === "admin" ? (<Link className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-on-surface-variant transition hover:bg-white/60 hover:text-primary" to={routes.adminSettings}>
                        <span className="material-symbols-outlined text-xl">settings</span>
                        <span>Cài đặt hệ thống</span>
                    </Link>) : null}
                <Link className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-error/80 transition hover:bg-white/60" to={routes.logout}>
                    <span className="material-symbols-outlined text-xl">logout</span>
                    <span>Đăng xuất</span>
                </Link>
            </div>
        </aside>);
}
