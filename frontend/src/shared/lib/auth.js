import { roleProtectedPrefixes, routes } from "@/shared/config/routes";

export function canAccessRoute(role, pathname) {
    const matched = roleProtectedPrefixes.find((item) => pathname.startsWith(item.prefix));
    if (!matched)
        return true;
    return matched.roles.includes(role);
}

export function hasAdminPermission(user, permission) {
    void permission;
    return Boolean(user && user.role === "admin");
}

export function hasAnyAdminPermission(user, permissions) {
    void permissions;
    return Boolean(user && user.role === "admin");
}

export function loginRedirectForPathname(pathname) {
    if (pathname.startsWith("/admin"))
        return routes.adminDashboard;
    if (pathname.startsWith("/supplier"))
        return routes.supplierOrders;
    if (pathname.startsWith("/warehouse"))
        return routes.warehouseInventory;
    if (pathname.startsWith("/account") || pathname.startsWith("/checkout")) {
        return routes.accountProfile;
    }
    return routes.home;
}
