import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { routes } from "@/shared/config/routes";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
export function LogoutPage() {
    const navigate = useNavigate();
    const session = useAuthStore((state) => state.session);
    const logout = useAuthStore((state) => state.logout);
    useEffect(() => {
        if (!session)
            return;
        void (async () => {
            await logout();
            void navigate(routes.home, { replace: true });
        })();
    }, [logout, navigate, session]);
    if (!session) {
        return <Navigate replace to={routes.home}/>;
    }
    return null;
}
