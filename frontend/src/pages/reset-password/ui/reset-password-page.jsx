import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiRequest } from "@/shared/api/backend-client";
import { routes } from "@/shared/config/routes";
import { Button, SurfaceCard } from "@/shared/ui";

export function ResetPasswordPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const email = searchParams.get("email") ?? "";
    const token = searchParams.get("token") ?? "";
    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();
        if (!email || !token) {
            setError("Liên kết đặt lại mật khẩu không hợp lệ. Vui lòng yêu cầu lại.");
            return;
        }
        if (password.length < 8) {
            setError("Mật khẩu mới cần tối thiểu 8 ký tự.");
            return;
        }
        if (password !== passwordConfirmation) {
            setError("Mật khẩu xác nhận chưa khớp.");
            return;
        }
        setError("");
        setIsSubmitting(true);
        try {
            await apiRequest("/password/reset", {
                method: "POST",
                body: { email, token, password },
            });
            setDone(true);
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Không thể đặt lại mật khẩu lúc này.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="mx-auto flex min-h-[calc(100vh-9rem)] items-center justify-center px-6 py-24">
            <div className="w-full max-w-md">
                <SurfaceCard tone="low" className="mx-auto w-full space-y-6">
                    <div className="text-center">
                        <p className="text-xs uppercase tracking-widest text-primary">Đặt lại mật khẩu</p>
                        {email ? <p className="mt-2 text-sm text-on-surface-variant">Tài khoản: {email}</p> : null}
                    </div>

                    {done ? (
                        <div className="space-y-4 text-center">
                            <p className="text-sm text-on-surface">
                                Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.
                            </p>
                            <Button className="w-full" onClick={() => void navigate(routes.login)}>
                                Đến trang đăng nhập
                            </Button>
                        </div>
                    ) : (
                        <form className="space-y-4" onSubmit={handleSubmit}>
                            <label className="block space-y-2 text-sm">
                                <span className="font-medium text-on-surface">Mật khẩu mới</span>
                                <input
                                    className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15"
                                    type="password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    placeholder="Tối thiểu 8 ký tự"
                                />
                            </label>
                            <label className="block space-y-2 text-sm">
                                <span className="font-medium text-on-surface">Xác nhận mật khẩu mới</span>
                                <input
                                    className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15"
                                    type="password"
                                    value={passwordConfirmation}
                                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                                    placeholder="Nhập lại mật khẩu mới"
                                />
                            </label>
                            {error ? <p className="text-sm text-error">{error}</p> : null}
                            <Button className="w-full" type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Đang lưu..." : "Đặt lại mật khẩu"}
                            </Button>
                        </form>
                    )}

                    <div className="border-t border-outline-variant/15 pt-4 text-center text-sm text-on-surface-variant">
                        <Link to={routes.login} className="font-semibold text-primary hover:underline">
                            Quay lại đăng nhập
                        </Link>
                    </div>
                </SurfaceCard>
            </div>
        </div>
    );
}
