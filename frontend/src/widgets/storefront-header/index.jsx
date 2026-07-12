import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { routes } from "@/shared/config/routes";
import { redirectForRole, useAuthStore } from "@/shared/lib/store/use-auth-store";
import { useCartStore } from "@/shared/lib/store/use-cart-store";
import { Icon, cn } from "@/shared/ui";
function getVariant(pathname) {
    if (pathname === routes.home)
        return "home";
    if (pathname === routes.products)
        return "catalog";
    if (pathname.startsWith("/products/"))
        return "detail";
    if (pathname.startsWith("/checkout"))
        return "checkout";
    return "default";
}
export function StorefrontHeader() {
    const navigate = useNavigate();
    const location = useLocation();
    const session = useAuthStore((state) => state.session);
    const cartCount = useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
    const [search, setSearch] = useState("");
    const variant = getVariant(location.pathname);
    const accountTarget = session ? redirectForRole(session.user.role) : routes.login;
    const isCustomerSession = session?.user.role === "customer";
    const canUseStorefrontActions = !session || isCustomerSession;
    const navItems = variant === "catalog"
        ? [
            { label: "Cửa hàng", to: routes.products },
            { label: "Bài viết", to: routes.story },
            { label: "Vùng miền", to: routes.regions },
            { label: "Đăng nhập", to: routes.login },
        ]
        : [
            { label: "Cửa hàng", to: routes.products },
            { label: "Bài viết", to: routes.story },
            { label: "Vùng miền", to: routes.regions },
            { label: "Test Sản Phẩm", to: routes.productTest },
        ];
    const navLinkClasses = ({ isActive }) => cn("pb-1 text-sm font-medium transition-colors", isActive
        ? "border-b-2 border-primary text-primary"
        : "text-zinc-500 hover:text-green-800");
    function handleSearchSubmit(event) {
        event.preventDefault();
        void navigate(routes.productsWithQuery({ search: search.trim() || undefined }));
    }
    return (<nav className="fixed top-0 z-50 w-full bg-white/80 shadow-sm backdrop-blur-xl">
            <div className={cn("mx-auto flex w-full items-center justify-between px-6 py-4 tracking-tight", variant === "home" || variant === "detail" || variant === "checkout"
            ? "max-w-screen-2xl"
            : "max-w-7xl")}>
                <Link to={routes.home} className="text-xl font-bold tracking-tighter text-green-900">
                    Heritage Harvest
                </Link>

                <div className="hidden items-center gap-8 md:flex">
                    {navItems.map((item) => (<NavLink key={item.label} to={item.to} className={navLinkClasses} end={item.to === routes.products}>
                            {item.label}
                        </NavLink>))}
                </div>

                <div className="flex items-center gap-3">
                    {variant === "home" ? (<form className="hidden items-center rounded-full bg-surface-container-low px-3 py-1.5 sm:flex" onSubmit={handleSearchSubmit}>
                            <Icon name="search" className="text-lg text-on-surface-variant"/>
                            <input className="w-40 border-none bg-transparent text-sm outline-none placeholder:text-on-surface-variant" placeholder="Tìm kiếm sản phẩm..." value={search} onChange={(event) => setSearch(event.target.value)}/>
                        </form>) : variant === "catalog" ? (<button className="text-zinc-600 transition hover:text-primary" aria-label="Tìm kiếm sản phẩm" onClick={() => void navigate(routes.products)}>
                            <Icon name="search"/>
                        </button>) : null}

                    {canUseStorefrontActions ? (<Link to={routes.checkout} className="relative rounded-full p-2 text-zinc-600 transition hover:bg-zinc-50 hover:text-primary" aria-label="Giỏ hàng">
                            <Icon name="shopping_cart"/>
                            {cartCount > 0 ? (<span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-tertiary text-[10px] font-bold text-on-tertiary">
                                    {cartCount}
                                </span>) : null}
                        </Link>) : null}

                    <Link to={accountTarget} className={cn("rounded-full p-2 text-zinc-600 transition hover:bg-zinc-50 hover:text-primary", (location.pathname.startsWith("/account") ||
            location.pathname.startsWith("/admin") ||
            location.pathname.startsWith("/supplier") ||
            location.pathname.startsWith("/warehouse")) &&
            "text-green-800")} aria-label={session ? "Khu vực tài khoản" : "Đăng nhập"}>
                        <Icon name="person"/>
                    </Link>

                    {session ? (<Link to={routes.logout} className="rounded-full p-2 text-zinc-600 transition hover:bg-zinc-50 hover:text-primary" aria-label="Đăng xuất">
                            <Icon name="logout"/>
                        </Link>) : null}
                </div>
            </div>
        </nav>);
}
