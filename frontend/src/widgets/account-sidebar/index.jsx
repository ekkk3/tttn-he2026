import { Link, NavLink } from "react-router-dom";
import { routes } from "@/shared/config/routes";
import { ProfileSummaryCard, cn } from "@/shared/ui";
export function AccountSidebar({ profile, rewards }) {
    const itemClasses = ({ isActive }) => cn("block rounded-full px-4 py-2.5 text-sm font-medium transition", isActive
        ? "bg-primary text-on-primary"
        : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary");
    return (<aside className="space-y-6">
            <ProfileSummaryCard profile={profile} rewards={rewards}/>
            <div className="rounded-3xl bg-surface-container-low p-4">
                <nav className="flex flex-col gap-2">
                    <NavLink className={itemClasses} to={routes.accountProfile}>
                        Thông tin cá nhân
                    </NavLink>
                    <NavLink className={itemClasses} to={routes.accountWishlist}>
                        Danh sách yêu thích
                    </NavLink>
                    <NavLink className={itemClasses} to={routes.accountOrders}>
                        Lịch sử đơn hàng
                    </NavLink>
                    <Link className="block rounded-full px-4 py-2.5 text-sm font-medium text-error transition hover:bg-surface-container hover:text-error" to={routes.logout}>
                        Đăng xuất
                    </Link>
                </nav>
            </div>
        </aside>);
}
