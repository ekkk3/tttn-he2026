import { Outlet } from "react-router-dom";
import { StorefrontFooter } from "@/widgets/storefront-footer";
import { StorefrontHeader } from "@/widgets/storefront-header";
import { AiChatbot } from "@/widgets/ai-chatbot";
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
