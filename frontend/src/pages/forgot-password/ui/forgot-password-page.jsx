import { useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "@/shared/api/backend-client";
import { routes } from "@/shared/config/routes";
import { Button, SurfaceCard } from "@/shared/ui";

export function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sentMessage, setSentMessage] = useState("");
    const [error, setError] = useState("");

    async function handleSubmit(event) {
        event.preventDefault();
        if (!email.trim()) {
            setError("Vui lòng nhập email đã đăng ký.");
            return;
        }
        setError("");
        setIsSubmitting(true);
        try {
            const response = await apiRequest("/password/forgot", {
                method: "POST",
                body: { email: email.trim() },
            });
            setSentMessage(response.message ?? "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.");
        } catch (submitError) {
            setError(submitError instanceof Error ? submitError.message : "Không thể gửi yêu cầu lúc này.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="mx-auto flex min-h-[calc(100vh-9rem)] items-center justify-center px-6 py-24">
            <div className="w-full max-w-md">
                <SurfaceCard tone="low" className="mx-auto w-full space-y-6">
                    <div className="text-center">
                        <p className="text-xs uppercase tracking-widest text-primary">Quên mật khẩu</p>
                        <p className="mt-2 text-sm text-on-surface-variant">
                            Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.
                        </p>
                    </div>

                    {sentMessage ? (
                        <p className="rounded-2xl bg-surface-container-highest p-4 text-sm text-on-surface">
                            {sentMessage}
                        </p>
                    ) : (
                        <form className="space-y-4" onSubmit={handleSubmit}>
                            <label className="block space-y-2 text-sm">
                                <span className="font-medium text-on-surface">Email</span>
                                <input
                                    className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    placeholder="customer@example.com"
                                    type="email"
                                />
                            </label>
                            {error ? <p className="text-sm text-error">{error}</p> : null}
                            <Button className="w-full" type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Đang gửi..." : "Gửi hướng dẫn đặt lại mật khẩu"}
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
