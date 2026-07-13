import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { subscribeNewsletter } from "@/shared/api/newsletter";
import { routes } from "@/shared/config/routes";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { Icon } from "@/shared/ui";
function getFooterVariant(pathname) {
    if (pathname === routes.products)
        return "catalog";
    return "default";
}
export function StorefrontFooter() {
    const location = useLocation();
    const variant = getFooterVariant(location.pathname);
    const pushToast = useFeedbackStore((state) => state.pushToast);
    const [email, setEmail] = useState("");
    async function handleSubscribe(event) {
        event.preventDefault();
        if (email.trim().length === 0) {
            pushToast({
                tone: "warning",
                message: "Vui lòng nhập email trước khi đăng ký bản tin.",
            });
            return;
        }
        await subscribeNewsletter(email.trim(), `footer-${variant}`);
        setEmail("");
        pushToast({
            tone: "success",
            message: "Đã lưu đăng ký bản tin từ chân trang.",
        });
    }
    if (variant === "catalog") {
        return (<footer className="w-full border-t border-zinc-200 bg-[#f3f3f3] text-sm">
                <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-8 py-12 md:flex-row">
                    <div>
                        <div className="mb-2 text-lg font-bold text-[#0d631b]">
                            Heritage Harvest
                        </div>
                        <p className="max-w-xs text-xs text-zinc-500">
                            © 2026 Heritage Harvest. Tôn vinh đặc sản Việt và câu chuyện vùng nguyên
                            liệu.
                        </p>
                    </div>

                    <div className="flex flex-wrap justify-center gap-6 md:gap-12">
                        <Link className="text-zinc-500 transition-colors hover:text-[#0d631b]" to={routes.story}>
                            Bài viết
                        </Link>
                        <Link className="text-zinc-500 transition-colors hover:text-[#0d631b]" to={routes.checkout}>
                            Giao hàng
                        </Link>
                        <Link className="text-zinc-500 transition-colors hover:text-[#0d631b]" to={routes.accountDisputes}>
                            Đổi trả & hỗ trợ
                        </Link>
                        <Link className="text-zinc-500 transition-colors hover:text-[#0d631b]" to={routes.regions}>
                            Nguồn gốc
                        </Link>
                        <Link className="text-zinc-500 transition-colors hover:text-[#0d631b]" to={routes.accountProfile}>
                            Liên hệ
                        </Link>
                        <Link className="text-zinc-500 transition-colors hover:text-[#0d631b]" to={routes.supplierRegister}>
                            Đăng ký NCC
                        </Link>
                    </div>

                    <div className="flex space-x-4">
                        {["public", "eco"].map((icon) => (<div key={icon} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-highest text-[#0d631b]">
                                <Icon name={icon} className="text-[18px]"/>
                            </div>))}
                    </div>
                </div>
            </footer>);
    }
    return (<footer className="w-full border-t border-zinc-200 bg-zinc-100 text-sm leading-relaxed">
            <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-8 py-16 md:grid-cols-4">
                <div className="space-y-4">
                    <div className="text-2xl font-bold text-green-900">Heritage Harvest</div>
                    <p className="text-zinc-600">
                        Tôn vinh nghề nông và nghề thủ công Việt qua những sản phẩm được tuyển chọn
                        từ các vùng nguyên liệu đặc sắc.
                    </p>
                </div>
                <div className="space-y-4">
                    <h5 className="font-bold text-green-900">Về chúng tôi</h5>
                    <ul className="space-y-2">
                        <li>
                            <Link className="inline-block text-zinc-600 transition-all hover:-translate-y-px hover:text-green-700" to={routes.story}>
                                Bài viết cộng đồng
                            </Link>
                        </li>
                        <li>
                            <Link className="inline-block text-zinc-600 transition-all hover:-translate-y-px hover:text-green-700" to={routes.regions}>
                                Hành trình nguồn gốc
                            </Link>
                        </li>
                        <li>
                            <Link className="inline-block text-zinc-600 transition-all hover:-translate-y-px hover:text-green-700" to={routes.supplierRegister}>
                                Đăng ký Nhà cung cấp
                            </Link>
                        </li>
                    </ul>
                </div>
                <div className="space-y-4">
                    <h5 className="font-bold text-green-900">Hỗ trợ</h5>
                    <ul className="space-y-2">
                        <li>
                            <Link className="inline-block text-zinc-600 transition-all hover:-translate-y-px hover:text-green-700" to={routes.checkout}>
                                Chính sách giao hàng
                            </Link>
                        </li>
                        <li>
                            <Link className="inline-block text-zinc-600 transition-all hover:-translate-y-px hover:text-green-700" to={routes.accountDisputes}>
                                Khiếu nại & hỗ trợ đơn
                            </Link>
                        </li>
                    </ul>
                </div>
                <div className="space-y-4">
                    <h5 className="font-bold text-green-900">Bản tin</h5>
                    <p className="text-zinc-600">
                        Nhận câu chuyện mùa vụ mới, gợi ý quà tặng và ưu đãi dành cho thành viên.
                    </p>
                    <form className="flex gap-2" onSubmit={handleSubscribe}>
                        <input className="w-full rounded-full border-none bg-white px-4 py-2 focus:ring-2 focus:ring-green-800" placeholder="Email của bạn" type="email" value={email} onChange={(event) => setEmail(event.target.value)}/>
                        <button className="rounded-full bg-green-800 p-2 text-white transition-opacity hover:opacity-80" type="submit" aria-label="Đăng ký bản tin">
                            <Icon name="arrow_forward"/>
                        </button>
                    </form>
                </div>
            </div>
            <div className="border-t border-zinc-200 px-8 py-6 text-center text-zinc-500">
                © 2026 Heritage Harvest. Tôn vinh đặc sản Việt và câu chuyện vùng nguyên liệu.
            </div>
        </footer>);
}
