import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { canAccessRoute } from "@/shared/lib/auth";
import { routes } from "@/shared/config/routes";
import { redirectForRole, useAuthStore } from "@/shared/lib/store/use-auth-store";
import { useCartStore } from "@/shared/lib/store/use-cart-store";
import { Button, SurfaceCard } from "@/shared/ui";

// Rỗng ("") thì ẩn nút tương ứng — xem docs/HUONG_DAN_TICH_HOP.md mục 1 để lấy Client ID/App ID
// thật. Đọc 1 lần ở module-level (không đổi giữa các lần render) thay vì trong component.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID || "";

// Nạp 1 script bên ngoài (Google Identity Services / Facebook SDK) đúng 1 lần dù gọi nhiều
// lần (StrictMode gọi effect 2 lần ở dev, hoặc user bấm lại nút trước khi script tải xong) —
// tránh nạp trùng script gây warning/khởi tạo lại SDK giữa chừng.
function loadScriptOnce(src) {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
        if (existing.dataset.loaded === "true") return Promise.resolve();
        return new Promise((resolve, reject) => {
            existing.addEventListener("load", () => resolve());
            existing.addEventListener("error", () => reject(new Error(`Không tải được ${src}`)));
        });
    }
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = () => {
            script.dataset.loaded = "true";
            resolve();
        };
        script.onerror = () => reject(new Error(`Không tải được ${src}`));
        document.head.appendChild(script);
    });
}
export function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const session = useAuthStore((state) => state.session);
    const credentials = useAuthStore((state) => state.credentials);
    const login = useAuthStore((state) => state.login);
    const register = useAuthStore((state) => state.register);
    const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);
    const loginWithFacebook = useAuthStore((state) => state.loginWithFacebook);
    const isSubmitting = useAuthStore((state) => state.isSubmitting);
    const syncGuestCart = useCartStore((state) => state.syncGuestCart);
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");
    const [error, setError] = useState("");
    const [isFacebookLoading, setIsFacebookLoading] = useState(false);
    const googleButtonRef = useRef(null);
    const mode = location.pathname === routes.register ? "register" : "login";
    const redirectTarget = useMemo(() => searchParams.get("redirect") ?? "", [searchParams]);
    // Google Identity Services: nút do CHÍNH Google render (renderButton) vào div bên dưới,
    // không tự vẽ nút riêng — bấm vào sẽ tự mở popup chọn tài khoản Google rồi gọi callback
    // với 1 credential (JWT id_token) mà backend tự verify chữ ký thật, không tin nội dung gửi lên.
    // Đặt TRƯỚC nhánh `if (session) return ...` bên dưới vì Hook không được gọi có điều kiện
    // (Rules of Hooks) — completeSignIn/loginWithGoogle tham chiếu bên trong vẫn hợp lệ dù khai
    // báo textually ở dưới, vì đây là function declaration được hoist trong phạm vi component.
    useEffect(() => {
        if (!GOOGLE_CLIENT_ID || !googleButtonRef.current) return undefined;
        let cancelled = false;
        loadScriptOnce("https://accounts.google.com/gsi/client")
            .then(() => {
                if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;
                window.google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    callback: (response) => {
                        setError("");
                        void (async () => {
                            try {
                                await completeSignIn(await loginWithGoogle(response.credential));
                            }
                            catch {
                                setError("Đăng nhập Google thất bại.");
                            }
                        })();
                    },
                });
                window.google.accounts.id.renderButton(googleButtonRef.current, {
                    theme: "outline",
                    size: "large",
                    width: 320,
                    locale: "vi",
                    text: mode === "register" ? "signup_with" : "signin_with",
                });
            })
            .catch(() => setError("Không thể tải nút Đăng nhập Google."));
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);
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
    // Dùng chung cho cả 3 cách đăng nhập (email/mật khẩu, Google, Facebook) — cả 3 đều gọi
    // xong 1 action store trả về cùng shape { success, error? } rồi cần đúng 1 chuỗi xử lý
    // tiếp theo: đọc role vừa đăng nhập, đồng bộ giỏ hàng nếu là khách, rồi điều hướng.
    async function completeSignIn(result) {
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
    async function handleLogin() {
        await completeSignIn(await login(email, password));
    }
    // Facebook JS SDK: khác Google, KHÔNG có sẵn hàm "vẽ nút" nên tự vẽ 1 nút thường (giữ đúng
    // kiểu dáng chung của trang) rồi mới nạp SDK/gọi FB.login() khi người dùng bấm — script chỉ
    // tải khi thực sự cần, không tải sẵn ngay khi vào trang.
    async function handleFacebookLogin() {
        if (!FACEBOOK_APP_ID) return;
        setError("");
        setIsFacebookLoading(true);
        try {
            if (!window.FB) {
                await loadScriptOnce("https://connect.facebook.net/vi_VN/sdk.js");
                if (!window.FB) throw new Error("Không tải được Facebook SDK.");
                window.FB.init({ appId: FACEBOOK_APP_ID, cookie: true, xfbml: false, version: "v19.0" });
            }
            window.FB.login((response) => {
                void (async () => {
                    if (!response.authResponse?.accessToken) {
                        setError("Bạn đã hủy đăng nhập Facebook.");
                        setIsFacebookLoading(false);
                        return;
                    }
                    await completeSignIn(await loginWithFacebook(response.authResponse.accessToken));
                    setIsFacebookLoading(false);
                })();
            }, { scope: "email" });
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Không thể tải Đăng nhập Facebook.");
            setIsFacebookLoading(false);
        }
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

                {mode === "login" ? (<div className="text-right text-sm">
                        <Link to={routes.forgotPassword} className="text-primary hover:underline">
                            Quên mật khẩu?
                        </Link>
                    </div>) : null}

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

                {GOOGLE_CLIENT_ID || FACEBOOK_APP_ID ? (<div className="space-y-3">
                        <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-on-surface-variant">
                            <span className="h-px flex-1 bg-outline-variant/20"/>
                            Hoặc
                            <span className="h-px flex-1 bg-outline-variant/20"/>
                        </div>

                        {GOOGLE_CLIENT_ID ? (<div ref={googleButtonRef} className="flex justify-center"/>) : null}

                        {FACEBOOK_APP_ID ? (<Button type="button" variant="outline" className="w-full" onClick={() => void handleFacebookLogin()} disabled={isFacebookLoading || isSubmitting}>
                                {isFacebookLoading
                ? mode === "register"
                    ? "Đang tạo tài khoản..."
                    : "Đang đăng nhập..."
                : mode === "register"
                    ? "Đăng ký với Facebook"
                    : "Đăng nhập với Facebook"}
                            </Button>) : null}
                    </div>) : null}
            </div>

            <div className="border-t border-outline-variant/15 pt-4 text-center text-sm text-on-surface-variant">
                {mode === "register" ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
                <Link to={mode === "register" ? routes.login : routes.register} className="font-semibold text-primary hover:underline">
                    {mode === "register" ? "Đăng nhập ngay" : "Đăng ký tại đây"}
                </Link>
            </div>

            <div className="text-center text-sm text-on-surface-variant">
                Là đối tác cung cấp đặc sản?{" "}
                <Link to={routes.supplierRegister} className="font-semibold text-primary hover:underline">
                    Đăng ký làm Nhà cung cấp
                </Link>
            </div>
        </SurfaceCard>
    </div>
    </div>);
}
