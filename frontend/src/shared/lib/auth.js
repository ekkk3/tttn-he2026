import { roleProtectedPrefixes, routes } from "@/shared/config/routes";

// Dùng bởi route-guard.jsx: đường dẫn không nằm trong danh sách roleProtectedPrefixes thì
// ai cũng vào được (return true); có khớp prefix thì role hiện tại phải nằm trong danh sách
// role cho phép của prefix đó.
export function canAccessRoute(role, pathname) {
    const matched = roleProtectedPrefixes.find((item) => pathname.startsWith(item.prefix));
    if (!matched)
        return true;
    return matched.roles.includes(role);
}

// LƯU Ý: chưa phải RBAC theo từng quyền chi tiết — tham số `permission` hiện KHÔNG được
// dùng để quyết định (void permission), hàm chỉ kiểm tra role === "admin". Tên hàm gợi ý
// kiểm tra quyền cụ thể nhưng thực tế mọi admin đều có mọi quyền; đây là chỗ để mở rộng
// sau nếu dự án cần phân quyền admin chi tiết hơn (vd admin_role_id ở backend).
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
