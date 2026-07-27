import { Outlet } from "react-router-dom";
import { StorefrontFooter } from "@/widgets/storefront-footer";
import { StorefrontHeader } from "@/widgets/storefront-header";
import { AiChatbot } from "@/widgets/ai-chatbot";
// Layout cho toàn bộ khu vực PUBLIC (trang chủ, catalog, checkout...) — AiChatbot nổi cố
// định ở đây nên xuất hiện xuyên suốt mọi trang storefront, không cần gắn riêng từng trang.
export function StorefrontLayout() {
    return (<div className="min-h-screen bg-surface text-on-surface">
            <StorefrontHeader />
            <main>
                <Outlet />
            </main>
            <StorefrontFooter />
            <AiChatbot />
        </div>);
}
