import { useEffect } from "react";
import { useAccountStore } from "@/shared/lib/store/use-account-store";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { useCartStore } from "@/shared/lib/store/use-cart-store";
import { useShopStore } from "@/shared/lib/store/use-shop-store";
export function AppBootstrap() {
    const hydrateSession = useAuthStore((state) => state.hydrateSession);
    const authSource = useAuthStore((state) => state.authSource);
    const session = useAuthStore((state) => state.session);
    const loadCart = useCartStore((state) => state.loadCart);
    const loadProfile = useAccountStore((state) => state.loadProfile);
    const loadWishlist = useShopStore((state) => state.loadWishlist);
    useEffect(() => {
        void hydrateSession();
    }, [hydrateSession]);
    useEffect(() => {
        if (authSource !== "backend" || session?.user.role !== "customer") {
            return;
        }
        void loadCart();
        void loadProfile();
        void loadWishlist();
    }, [authSource, loadCart, loadProfile, loadWishlist, session?.user.id, session?.user.role]);
    return null;
}
