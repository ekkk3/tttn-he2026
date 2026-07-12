import { useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { canAccessRoute } from "@/shared/lib/auth";
import { routes } from "@/shared/config/routes";
import { redirectForRole, useAuthStore } from "@/shared/lib/store/use-auth-store";
import { useCartStore } from "@/shared/lib/store/use-cart-store";
import { Button, SurfaceCard } from "@/shared/ui";
export function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const session = useAuthStore((state) => state.session);
    const credentials = useAuthStore((state) => state.credentials);
    const login = useAuthStore((state) => state.login);
    const register = useAuthStore((state) => state.register);
    const isSubmitting = useAuthStore((state) => state.isSubmitting);
    const syncGuestCart = useCartStore((state) => state.syncGuestCart);
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");
    const [error, setError] = useState("");
    const mode = location.pathname === routes.register ? "register" : "login";
    const redirectTarget = useMemo(() => searchParams.get("redirect") ?? "", [searchParams]);
    if (session) {
        const nextPath = redirectTarget && canAccessRoute(session.user.role, redirectTarget)
            ? redirectTarget
            : redirectForRole(session.user.role);
        return <Navigate replace to={nextPath}/>;
    }
    function resolveRedirect(role) {
        if (redirectTarget && canAccessRoute(role, redirectTarget)) {
            return redirectTarget;
        }
        return redirectForRole(role);
    }
    async function finalizeCustomerSignIn() {
        const syncResult = await syncGuestCart();
        if (!syncResult.success) {
            setError(syncResult.error ?? "Không thể đồng bộ giỏ hàng sau khi đăng nhập.");
            return false;
        }
        return true;
    }
    async function handleLogin() {
        const result = await login(email, password);
        if (!result.success) {
            setError(result.error ?? "Đăng nhập thất bại.");
            return;
        }
        const nextSession = useAuthStore.getState().session;
        const role = nextSession?.user.role;
        if (!role) {
            setError("Không xác định được vai trò sau khi đăng nhập.");
            return;
        }
        if (role === "customer") {
            const synced = await finalizeCustomerSignIn();
            if (!synced) {
                return;
            }
        }
        void navigate(resolveRedirect(role), { replace: true });
    }
    async function handleRegister() {
        if (!fullName.trim() || !phone.trim() || !email.trim() || !password || !passwordConfirmation) {
            setError("Vui lòng nhập đầy đủ thông tin đăng ký.");
            return;
        }
        if (password !== passwordConfirmation) {
            setError("Mật khẩu xác nhận chưa khớp.");
            return;
        }
        const result = await register({
            fullName,
            phone,
            email,
            password,
            passwordConfirmation,
        });
        if (!result.success) {
            setError(result.error ?? "Đăng ký thất bại.");
            return;
        }
        const synced = await finalizeCustomerSignIn();
        if (!synced) {
            return;
        }
        void navigate(resolveRedirect("customer"), { replace: true });
    }
    return (<div className="mx-auto flex min-h-[calc(100vh-9rem)] items-center justify-center px-6 py-24">
    <div className={`w-full ${mode === "register" ? "max-w-xl" : "max-w-md"}`}>
        <SurfaceCard tone="low" className="mx-auto w-full space-y-6">
            <div className="space-y-4">
                {mode === "register" ? (<>
                        <div className="text-center">
                            <p className="text-xs uppercase tracking-widest text-primary">
                                Đăng ký tài khoản
                            </p>
                        </div>

                        <label className="block space-y-2 text-sm">
                            <span className="font-medium text-on-surface">
                                Họ và tên
                            </span>
                            <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nguyễn Văn A"/>
                        </label>

                        <label className="block space-y-2 text-sm">
                            <span className="font-medium text-on-surface">
                                Số điện thoại
                            </span>
                            <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0901234567"/>
                        </label>
                    </>) : (<div className="text-center">
                        <p className="text-xs uppercase tracking-widest text-primary">
                            Đăng nhập tài khoản
                        </p>
                        
                     
                    </div>)}

                <label className="block space-y-2 text-sm">
                    <span className="font-medium text-on-surface">Email</span>
                    <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="customer@example.com"/>
                </label>

                <label className="block space-y-2 text-sm">
                    <span className="font-medium text-on-surface">Mật khẩu</span>
                    <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tối thiểu 8 ký tự"/>
                </label>

                {mode === "register" ? (<label className="block space-y-2 text-sm">
                        <span className="font-medium text-on-surface">
                            Xác nhận mật khẩu
                        </span>
                        <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" type="password" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} placeholder="Nhập lại mật khẩu"/>
                    </label>) : null}

                {error ? (<p className="text-sm text-error">{error}</p>) : null}

                <Button className="w-full" onClick={() => void (mode === "register" ? handleRegister() : handleLogin())} disabled={isSubmitting}>
                    {isSubmitting
            ? mode === "register"
                ? "Đang tạo tài khoản..."
                : "Đang đăng nhập..."
            : mode === "register"
                ? "Đăng ký"
                : "Đăng nhập"}
                </Button>
            </div>

            <div className="border-t border-outline-variant/15 pt-4 text-center text-sm text-on-surface-variant">
                {mode === "register" ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
                <Link to={mode === "register" ? routes.login : routes.register} className="font-semibold text-primary hover:underline">
                    {mode === "register" ? "Đăng nhập ngay" : "Đăng ký tại đây"}
                </Link>
            </div>
        </SurfaceCard>
    </div>
    </div>);
}
