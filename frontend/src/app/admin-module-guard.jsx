import { Navigate } from "react-router-dom";
import { canAccessAdminModule, getAdminModule, } from "@/shared/config/admin-modules";
import { routes } from "@/shared/config/routes";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
// Lớp bảo vệ THỨ HAI, cụ thể hơn RouteGuard: RouteGuard (bọc ngoài, xem router.jsx) đã đảm
// bảo user có role "admin" mới vào được khu vực /admin/*; guard này kiểm tra thêm user có
// được phép truy cập ĐÚNG module này không (moduleId khớp 1 item trong adminModules) — dự
// phòng cho việc phân quyền admin theo từng module trong tương lai (hiện canAccessAdminModule
// vẫn chỉ check role, xem ghi chú trong admin-modules.js).
export function AdminModuleGuard({ moduleId, children }) {
    const user = useAuthStore((state) => state.session?.user ?? null);
    const module = getAdminModule(moduleId);
    if (!module || !canAccessAdminModule(user, module)) {
        return <Navigate replace to={routes.unauthorized}/>;
    }
    return <>{children}</>;
}
