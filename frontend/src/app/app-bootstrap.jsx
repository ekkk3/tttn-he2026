import { useEffect } from "react";
import { useAccountStore } from "@/shared/lib/store/use-account-store";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { useCartStore } from "@/shared/lib/store/use-cart-store";
import { useShopStore } from "@/shared/lib/store/use-shop-store";
// Component KHÔNG render gì (return null) — mount 1 LẦN ở gốc app (xem main.jsx) chỉ để
// chạy các side-effect cần thiết lúc khởi động: khôi phục phiên đăng nhập từ localStorage,
// rồi (nếu là khách hàng) tải sẵn giỏ hàng/profile/wishlist trước khi người dùng thao tác.
export function AppBootstrap() {
    const hydrateSession = useAuthStore((state) => state.hydrateSession);
    const authSource = useAuthStore((state) => state.authSource);
    const session = useAuthStore((state) => state.session);
    const loadCart = useCartStore((state) => state.loadCart);
    const loadProfile = useAccountStore((state) => state.loadProfile);
    const loadWishlist = useShopStore((state) => state.loadWishlist);
    // Chạy 1 lần khi app mount: gọi API /me để xác nhận token cũ (nếu có) còn hợp lệ.
    useEffect(() => {
        void hydrateSession();
    }, [hydrateSession]);
    // Chạy lại mỗi khi trạng thái đăng nhập đổi (authSource/role/user id) — chỉ tải dữ liệu
    // riêng của khách hàng khi ĐÃ xác nhận là customer đăng nhập thật qua backend; admin/
    // supplier/warehouse dùng store dữ liệu khác nên bỏ qua ở đây.
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
