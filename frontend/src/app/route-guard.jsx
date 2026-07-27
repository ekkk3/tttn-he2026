import { Navigate, useLocation } from "react-router-dom";
import { canAccessRoute } from "@/shared/lib/auth";
import { routes } from "@/shared/config/routes";
import { redirectForRole, useAuthStore } from "@/shared/lib/store/use-auth-store";
// Bọc quanh 1 nhóm route (xem router.jsx) để chặn truy cập theo role. Thứ tự kiểm tra:
// 1) Đang khôi phục phiên (AppBootstrap gọi hydrateSession() chưa xong) -> hiện loading,
//    CHƯA vội kết luận "chưa đăng nhập" kẻo redirect nhầm ngay cả khi có token hợp lệ.
// 2) Không có session -> chưa đăng nhập -> đưa về trang login, kèm ?redirect= để login xong
//    quay lại đúng trang đang định vào.
// 3) Có đăng nhập nhưng role không nằm trong allowedRoles (hoặc route bị chặn riêng theo
//    canAccessRoute) -> đưa về trang mặc định của role đó; nếu trang mặc định lại CHÍNH LÀ
//    trang đang cố vào (vòng lặp), đưa sang trang "Không có quyền" thay vì redirect vô hạn.
export function RouteGuard({ allowedRoles, children }) {
    const location = useLocation();
    const session = useAuthStore((state) => state.session);
    const isHydrating = useAuthStore((state) => state.isHydrating);
    if (isHydrating) {
        return (<div className="mx-auto flex min-h-[40vh] max-w-7xl items-center justify-center px-6 text-sm text-on-surface-variant">
                Đang khởi tạo phiên đăng nhập...
            </div>);
    }
    if (!session) {
        const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
        return <Navigate replace to={`${routes.login}?redirect=${redirect}`}/>;
    }
    if (!allowedRoles.includes(session.user.role) ||
        !canAccessRoute(session.user.role, location.pathname)) {
        const fallbackRoute = redirectForRole(session.user.role);
        return (<Navigate replace to={fallbackRoute === location.pathname ? routes.unauthorized : fallbackRoute}/>);
    }
    return <>{children}</>;
}
