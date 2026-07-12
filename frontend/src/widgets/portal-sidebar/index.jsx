import { Link } from "react-router-dom";
import { routes } from "@/shared/config/routes";
import { SidebarNav } from "@/shared/ui";
const supplierItems = [
    { label: "Tồn kho", to: routes.supplierInventory, icon: "inventory_2" },
    { label: "Phiếu yêu cầu", to: routes.supplierRequisitions, icon: "assignment_turned_in" },
    { label: "Xử lý đơn", to: routes.supplierProcessing, icon: "package_2" },
    { label: "Đơn nhà cung cấp", to: routes.supplierOrders, icon: "local_shipping" },
];
const warehouseItems = [
    { label: "Tồn kho", to: routes.warehouseInventory, icon: "inventory_2" },
    { label: "Phiếu tái nhập", to: routes.warehouseRequisitions, icon: "assignment_turned_in" },
    { label: "Fulfillment", to: routes.warehouseFulfillment, icon: "package_2" },
    { label: "Đơn theo supplier", to: routes.warehouseSupplierOrders, icon: "local_shipping" },
];
export function PortalSidebar({ variant }) {
    const items = variant === "supplier" ? supplierItems : warehouseItems;
    const helpRoute = variant === "supplier" ? routes.supplierHelp : routes.warehouseHelp;
    return (<aside className="flex h-full flex-col bg-[#f3f3f3] p-4 shadow-[20px_0px_40px_rgba(26,28,28,0.03)]">
            <div className="mb-8 px-4 py-2">
                <h2 className="font-headline text-lg font-bold tracking-tight text-primary">
                    Heritage Harvest
                </h2>
                <p className="mt-1 text-[11px] uppercase tracking-widest text-on-surface-variant/70">
                    {variant === "supplier" ? "Cổng nhà cung cấp" : "Cổng kho vận"}
                </p>
            </div>

            <SidebarNav items={items}/>

            <div className="mt-auto space-y-1 border-t border-outline-variant/20 pt-4">
                <Link className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-on-surface-variant transition hover:bg-white/40 hover:text-primary" to={helpRoute}>
                    <span className="material-symbols-outlined text-xl">help</span>
                    <span>Trung tâm hỗ trợ</span>
                </Link>
                <Link className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-on-surface-variant transition hover:bg-white/40 hover:text-primary" to={routes.logout}>
                    <span className="material-symbols-outlined text-xl">logout</span>
                    <span>Đăng xuất</span>
                </Link>
            </div>
        </aside>);
}
