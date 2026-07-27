import { Outlet } from "react-router-dom";
import { StorefrontFooter } from "@/widgets/storefront-footer";
import { StorefrontHeader } from "@/widgets/storefront-header";
// Dùng chung header/footer với storefront-layout.jsx (khách hàng vẫn đang "ở trong" trang
// bán hàng khi xem tài khoản) nhưng KHÔNG có AiChatbot — trang tài khoản không cần tư vấn
// mua hàng.
export function AccountLayout() {
    return (<div className="min-h-screen bg-surface text-on-surface">
            <StorefrontHeader />
            <main>
                <Outlet />
            </main>
            <StorefrontFooter />
        </div>);
}
