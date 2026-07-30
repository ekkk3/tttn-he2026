import { Outlet } from "react-router-dom";
import { StorefrontFooter } from "@/widgets/storefront-footer";
import { StorefrontHeader } from "@/widgets/storefront-header";
import { AiChatbot } from "@/widgets/ai-chatbot";
// Dùng chung header/footer với storefront-layout.jsx (khách hàng vẫn đang "ở trong" trang
// bán hàng khi xem tài khoản). Có AiChatbot giống storefront-layout.jsx — UC 2.2.6a chỉ ghi
// điều kiện tiên quyết "Khách hàng truy cập website (đã đăng nhập hoặc chưa)", không giới
// hạn riêng trang mua sắm, nên khu vực tài khoản (cũng thuộc tác nhân Khách hàng) cần có luôn.
export function AccountLayout() {
    return (<div className="min-h-screen bg-surface text-on-surface">
            <StorefrontHeader />
            <main>
                <Outlet />
            </main>
            <StorefrontFooter />
            <AiChatbot />
        </div>);
}
