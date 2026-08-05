import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AdminModuleGuard } from "@/app/admin-module-guard";
import { AccountLayout } from "@/app/layouts/account-layout";
import { AdminLayout } from "@/app/layouts/admin-layout";
import { PortalLayout } from "@/app/layouts/portal-layout";
import { StorefrontLayout } from "@/app/layouts/storefront-layout";
import { RouteGuard } from "@/app/route-guard";
import { ForgotPasswordPage } from "@/pages/forgot-password/ui/forgot-password-page";
import { ResetPasswordPage } from "@/pages/reset-password/ui/reset-password-page";
import { SupplierRegisterPage } from "@/pages/supplier-register/ui/supplier-register-page";
import { ProductCatalogPage } from "@/pages/catalog/ui/product-catalog-page";
import { CheckoutPage } from "@/pages/checkout/ui/checkout-page";
import { HomePage } from "@/pages/home/ui/home-page";
import { LoginPage } from "@/pages/login/ui/login-page";
import { LogoutPage } from "@/pages/logout/ui/logout-page";
import { OrderSuccessPage } from "@/pages/order-success/ui/order-success-page";
import { PaymentResultPage } from "@/pages/payment-result/ui/payment-result-page";
import { ProductDetailPage } from "@/pages/product-detail/ui/product-detail-page";
import { RegionsPage } from "@/pages/regions/ui/regions-page";
import { StoryPage } from "@/pages/story/ui/story-page";
import { UnauthorizedPage } from "@/pages/unauthorized/ui/unauthorized-page";
import { getFirstAccessibleAdminModule } from "@/shared/config/admin-modules";
import { routes as appRoutes } from "@/shared/config/routes";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";

// Toàn bộ trang bên dưới chỉ dùng được sau khi đăng nhập đúng vai trò (Khách hàng/Admin/NCC/
// Nhân viên kho) — phần lớn khách vãng lai/khách mua hàng thông thường (chiếm đa số traffic
// thực tế) không bao giờ tải tới các trang này. Trước đây import tĩnh (`import { X } from ...`)
// khiến TOÀN BỘ ~34 trang này bị gộp chung vào 1 file JS ban đầu (1,29MB, vượt ngưỡng cảnh
// báo 500KB của Vite) dù khách chỉ xem trang chủ/giỏ hàng. Đổi sang `lazy()` để Vite tách mỗi
// trang thành 1 chunk riêng, chỉ tải khi thực sự điều hướng tới route đó — không đổi hành vi
// hiển thị, chỉ đổi THỜI ĐIỂM tải file JS xuống trình duyệt.
const AccountAddressesPage = lazy(() => import("@/pages/account-addresses/ui/account-addresses-page").then((m) => ({ default: m.AccountAddressesPage })));
const AccountDisputesPage = lazy(() => import("@/pages/account-disputes/ui/account-disputes-page").then((m) => ({ default: m.AccountDisputesPage })));
const AccountNotificationsPage = lazy(() => import("@/pages/account-notifications/ui/account-notifications-page").then((m) => ({ default: m.AccountNotificationsPage })));
const AccountWishlistPage = lazy(() => import("@/pages/account-wishlist/ui/account-wishlist-page").then((m) => ({ default: m.AccountWishlistPage })));
const AccountOrdersPage = lazy(() => import("@/pages/account-orders/ui/account-orders-page").then((m) => ({ default: m.AccountOrdersPage })));
const AccountProfilePage = lazy(() => import("@/pages/account-profile/ui/account-profile-page").then((m) => ({ default: m.AccountProfilePage })));
const AccountRewardsPage = lazy(() => import("@/pages/account-rewards/ui/account-rewards-page").then((m) => ({ default: m.AccountRewardsPage })));
const AccountSecurityPage = lazy(() => import("@/pages/account-security/ui/account-security-page").then((m) => ({ default: m.AccountSecurityPage })));
const AdminCommunityPage = lazy(() => import("@/pages/admin-community/ui/admin-community-page").then((m) => ({ default: m.AdminCommunityPage })));
const AdminAdminsPage = lazy(() => import("@/pages/admin-admins/ui/admin-admins-page").then((m) => ({ default: m.AdminAdminsPage })));
const AdminSupplierApplicationsPage = lazy(() => import("@/pages/admin-supplier-applications/ui/admin-supplier-applications-page").then((m) => ({ default: m.AdminSupplierApplicationsPage })));
const AdminComplaintsPage = lazy(() => import("@/pages/admin-complaints/ui/admin-complaints-page").then((m) => ({ default: m.AdminComplaintsPage })));
const AdminReviewsPage = lazy(() => import("@/pages/admin-reviews/ui/admin-reviews-page").then((m) => ({ default: m.AdminReviewsPage })));
const AdminVouchersPage = lazy(() => import("@/pages/admin-vouchers/ui/admin-vouchers-page").then((m) => ({ default: m.AdminVouchersPage })));
const AdminDashboardPage = lazy(() => import("@/pages/admin-dashboard/ui/admin-dashboard-page").then((m) => ({ default: m.AdminDashboardPage })));
const AdminLogisticsPage = lazy(() => import("@/pages/admin-logistics/ui/admin-logistics-page").then((m) => ({ default: m.AdminLogisticsPage })));
const AdminRepositoryPage = lazy(() => import("@/pages/admin-repository/ui/admin-repository-page").then((m) => ({ default: m.AdminRepositoryPage })));
const AdminSettingsPage = lazy(() => import("@/pages/admin-settings/ui/admin-settings-page").then((m) => ({ default: m.AdminSettingsPage })));
const AdminShippingCarriersPage = lazy(() => import("@/pages/admin-shipping-carriers/ui/admin-shipping-carriers-page").then((m) => ({ default: m.AdminShippingCarriersPage })));
const AdminUserOrderDetailPage = lazy(() => import("@/pages/admin-user-order-detail/ui/admin-user-order-detail-page").then((m) => ({ default: m.AdminUserOrderDetailPage })));
const AdminUserOrdersPage = lazy(() => import("@/pages/admin-user-orders/ui/admin-user-orders-page").then((m) => ({ default: m.AdminUserOrdersPage })));
const AdminUsersPage = lazy(() => import("@/pages/admin-users/ui/admin-users-page").then((m) => ({ default: m.AdminUsersPage })));
const SupplierHelpPage = lazy(() => import("@/pages/supplier-help/ui/supplier-help-page").then((m) => ({ default: m.SupplierHelpPage })));
const SupplierProductsPage = lazy(() => import("@/pages/supplier-products/ui/supplier-products-page").then((m) => ({ default: m.SupplierProductsPage })));
const SupplierRevenuePage = lazy(() => import("@/pages/supplier-revenue/ui/supplier-revenue-page").then((m) => ({ default: m.SupplierRevenuePage })));
const SupplierInventoryPage = lazy(() => import("@/pages/supplier-inventory/ui/supplier-inventory-page").then((m) => ({ default: m.SupplierInventoryPage })));
const SupplierOrdersPage = lazy(() => import("@/pages/supplier-orders/ui/supplier-orders-page").then((m) => ({ default: m.SupplierOrdersPage })));
const SupplierProcessingPage = lazy(() => import("@/pages/supplier-processing/ui/supplier-processing-page").then((m) => ({ default: m.SupplierProcessingPage })));
const SupplierRequisitionsPage = lazy(() => import("@/pages/supplier-requisitions/ui/supplier-requisitions-page").then((m) => ({ default: m.SupplierRequisitionsPage })));
const WarehouseFulfillmentPage = lazy(() => import("@/pages/warehouse-fulfillment/ui/warehouse-fulfillment-page").then((m) => ({ default: m.WarehouseFulfillmentPage })));
const WarehouseHelpPage = lazy(() => import("@/pages/warehouse-help/ui/warehouse-help-page").then((m) => ({ default: m.WarehouseHelpPage })));
const WarehouseInventoryPage = lazy(() => import("@/pages/warehouse-inventory/ui/warehouse-inventory-page").then((m) => ({ default: m.WarehouseInventoryPage })));
const WarehouseRequisitionsPage = lazy(() => import("@/pages/warehouse-requisitions/ui/warehouse-requisitions-page").then((m) => ({ default: m.WarehouseRequisitionsPage })));
const WarehouseSupplierOrdersPage = lazy(() => import("@/pages/warehouse-supplier-orders/ui/warehouse-supplier-orders-page").then((m) => ({ default: m.WarehouseSupplierOrdersPage })));

// Fallback hiển thị TẠM trong lúc chờ tải chunk của trang đích (thường vài chục-trăm ms trên
// mạng bình thường, có thể lâu hơn lần đầu trên mạng chậm) — giữ tối giản, không cần match
// pixel-perfect với từng layout vì chỉ hiện thoáng qua.
function RouteLoadingFallback() {
    return (<div className="flex min-h-[40vh] items-center justify-center text-sm text-neutral-500">
            Đang tải…
        </div>);
}
// Vào "/admin" (dashboard mặc định) nhưng nếu sau này phân quyền chi tiết hơn khiến admin
// không thấy dashboard, tự điều hướng sang module ĐẦU TIÊN họ có quyền truy cập thay vì
// hiện trang trắng. Hiện tại canAccessAdminModule() luôn cho phép mọi admin (xem admin-modules.js)
// nên trên thực tế luôn rơi vào nhánh "hiện AdminDashboardPage" ở dưới.
function AdminIndexRoute() {
    const user = useAuthStore((state) => state.session?.user ?? null);
    const firstModule = getFirstAccessibleAdminModule(user);
    if (!firstModule) {
        return <Navigate replace to={appRoutes.unauthorized}/>;
    }
    if (firstModule.id !== "dashboard") {
        return <Navigate replace to={firstModule.to}/>;
    }
    return <AdminDashboardPage />;
}
// "/supplier" và "/warehouse" (không path con) là URL rút gọn hay được gõ tay/đánh dấu —
// điều hướng tới trang phù hợp theo role: admin xem qua giao diện quản trị (/admin/supplier/*),
// còn chính NCC/nhân viên kho xem qua cổng portal riêng (/supplier/*, /warehouse/*) — cùng
// dữ liệu, khác layout bọc ngoài (AdminLayout vs PortalLayout).
function SupplierRootRedirect() {
    const role = useAuthStore((state) => state.session?.user.role);
    return (<Navigate replace to={role === "admin" ? appRoutes.adminSupplierOrders : appRoutes.supplierOrders}/>);
}
function WarehouseRootRedirect() {
    const role = useAuthStore((state) => state.session?.user.role);
    return (<Navigate replace to={role === "admin" ? appRoutes.adminWarehouseInventory : appRoutes.warehouseInventory}/>);
}
// Placeholder: hiện chỉ render children, không thêm kiểm tra gì — chỗ dự phòng nếu sau
// này cần chặn thêm (vd chỉ admin có quyền cụ thể mới xem được đơn hàng của 1 khách).
function AdminUserOrdersGuard({ children }) {
    return <>{children}</>;
}
// Cấu trúc route chia thành 4 nhóm, mỗi nhóm bọc trong 1 <Route> cha dùng chung 1 Layout +
// (nếu cần) 1 RouteGuard theo role — mọi route con thừa hưởng layout/bảo vệ của cha:
// 1) StorefrontLayout: public, ai cũng vào được (trang chủ, catalog, checkout...).
// 2) AccountLayout + RouteGuard(customer): trang tài khoản khách hàng.
// 3) AdminLayout + RouteGuard(admin): toàn bộ khu quản trị, mỗi route con còn thêm 1 lớp
//    AdminModuleGuard riêng theo moduleId (2 lớp bảo vệ: role cấp route + module cấp trang).
// 4) PortalLayout + RouteGuard(supplier, warehouse): cổng dành cho NCC/nhân viên kho.
export function AppRoutes() {
    return (<Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
            <Route element={<StorefrontLayout />}>
                <Route path={appRoutes.home} element={<HomePage />}/>
                <Route path={appRoutes.login} element={<LoginPage />}/>
                <Route path={appRoutes.register} element={<LoginPage />}/>
                <Route path={appRoutes.forgotPassword} element={<ForgotPasswordPage />}/>
                <Route path={appRoutes.resetPassword} element={<ResetPasswordPage />}/>
                <Route path={appRoutes.supplierRegister} element={<SupplierRegisterPage />}/>
                <Route path={appRoutes.logout} element={<LogoutPage />}/>
                <Route path={appRoutes.unauthorized} element={<UnauthorizedPage />}/>
                <Route path={appRoutes.products} element={<ProductCatalogPage />}/>
                <Route path={appRoutes.productDetail()} element={<ProductDetailPage />}/>
                <Route path={appRoutes.story} element={<StoryPage />}/>
                <Route path={appRoutes.regions} element={<RegionsPage />}/>
                <Route path={appRoutes.checkout} element={<CheckoutPage />}/>
                <Route path={appRoutes.vnpayReturn} element={<PaymentResultPage gateway="vnpay"/>}/>
                <Route path={appRoutes.momoReturn} element={<PaymentResultPage gateway="momo"/>}/>
                <Route path={appRoutes.orderSuccess()} element={<RouteGuard allowedRoles={["customer"]}>
                            <OrderSuccessPage />
                        </RouteGuard>}/>

            </Route>


            <Route element={<RouteGuard allowedRoles={["customer"]}>
                        <AccountLayout />
                    </RouteGuard>}>
                <Route path={appRoutes.accountProfile} element={<AccountProfilePage />}/>
                <Route path={appRoutes.accountSecurity} element={<AccountSecurityPage />}/>
                <Route path={appRoutes.accountNotifications} element={<AccountNotificationsPage />}/>
                <Route path={appRoutes.accountAddresses} element={<AccountAddressesPage />}/>
                <Route path={appRoutes.accountRewards} element={<AccountRewardsPage />}/>
                <Route path={appRoutes.accountDisputes} element={<AccountDisputesPage />}/>
                <Route path={appRoutes.accountWishlist} element={<AccountWishlistPage />}/>
                <Route path={appRoutes.accountOrders} element={<AccountOrdersPage />}/>
                <Route path={appRoutes.accountOrderDetail()} element={<AccountOrdersPage />}/>
            </Route>

            <Route element={<RouteGuard allowedRoles={["admin"]}>
                        <AdminLayout />
                    </RouteGuard>}>
                <Route path={appRoutes.adminDashboard} element={<AdminIndexRoute />}/>
                <Route path={appRoutes.adminDashboardLegacy} element={<Navigate replace to={appRoutes.adminDashboard}/>}/>
                <Route path={appRoutes.adminCommunity} element={<AdminModuleGuard moduleId="community">
                            <AdminCommunityPage />
                        </AdminModuleGuard>}/>
                <Route path={appRoutes.adminRepository} element={<Navigate replace to={appRoutes.adminProducts}/>}/>
                <Route path={appRoutes.adminUsers} element={<AdminModuleGuard moduleId="users">
                            <AdminUsersPage />
                        </AdminModuleGuard>}/>
                <Route path={appRoutes.adminUserOrders()} element={<AdminUserOrdersGuard>
                            <AdminUserOrdersPage />
                        </AdminUserOrdersGuard>}/>
                <Route path={appRoutes.adminUserOrderDetail()} element={<AdminUserOrdersGuard>
                            <AdminUserOrderDetailPage />
                        </AdminUserOrdersGuard>}/>
                <Route path={appRoutes.adminProducts} element={<AdminModuleGuard moduleId="products">
                            <AdminRepositoryPage lockedTab="products"/>
                        </AdminModuleGuard>}/>
                <Route path={appRoutes.adminCategories} element={<AdminModuleGuard moduleId="categories">
                            <AdminRepositoryPage lockedTab="categories"/>
                        </AdminModuleGuard>}/>
                <Route path={appRoutes.adminSuppliers} element={<AdminModuleGuard moduleId="suppliers">
                            <AdminRepositoryPage lockedTab="suppliers"/>
                        </AdminModuleGuard>}/>
                <Route path={appRoutes.adminSupplierApplications} element={<AdminModuleGuard moduleId="supplierApplications">
                            <AdminSupplierApplicationsPage />
                        </AdminModuleGuard>}/>
                <Route path={appRoutes.adminComplaints} element={<AdminModuleGuard moduleId="complaints">
                            <AdminComplaintsPage />
                        </AdminModuleGuard>}/>
                <Route path={appRoutes.adminReviews} element={<AdminModuleGuard moduleId="reviews">
                            <AdminReviewsPage />
                        </AdminModuleGuard>}/>
                <Route path={appRoutes.adminVouchers} element={<AdminModuleGuard moduleId="vouchers">
                            <AdminVouchersPage />
                        </AdminModuleGuard>}/>
                <Route path={appRoutes.adminShippingCarriers} element={<AdminModuleGuard moduleId="shippingCarriers">
                            <AdminShippingCarriersPage />
                        </AdminModuleGuard>}/>
                <Route path={appRoutes.adminLogistics} element={<AdminModuleGuard moduleId="logistics">
                            <AdminLogisticsPage />
                        </AdminModuleGuard>}/>
                <Route path={appRoutes.adminSettings} element={<AdminModuleGuard moduleId="settings">
                            <AdminSettingsPage />
                        </AdminModuleGuard>}/>
                <Route path={appRoutes.adminAdmins} element={<AdminModuleGuard moduleId="admins">
                            <AdminAdminsPage />
                        </AdminModuleGuard>}/>
                <Route path="/admin/supplier" element={<Navigate replace to={appRoutes.adminSupplierOrders}/>}/>
                <Route path={appRoutes.adminSupplierInventory} element={<AdminModuleGuard moduleId="supplierInventory">
                            <SupplierInventoryPage />
                        </AdminModuleGuard>}/>
                <Route path={appRoutes.adminSupplierRequisitions} element={<AdminModuleGuard moduleId="supplierRequisitions">
                            <SupplierRequisitionsPage />
                        </AdminModuleGuard>}/>
                <Route path={appRoutes.adminSupplierProcessing} element={<AdminModuleGuard moduleId="supplierProcessing">
                            <SupplierProcessingPage />
                        </AdminModuleGuard>}/>
                <Route path={appRoutes.adminSupplierOrders} element={<AdminModuleGuard moduleId="supplierOrders">
                            <SupplierOrdersPage />
                        </AdminModuleGuard>}/>
                <Route path={appRoutes.adminSupplierHelp} element={<AdminModuleGuard moduleId="supplierHelp">
                            <SupplierHelpPage />
                        </AdminModuleGuard>}/>
                <Route path="/admin/warehouse" element={<Navigate replace to={appRoutes.adminWarehouseInventory}/>}/>
                <Route path={appRoutes.adminWarehouseInventory} element={<AdminModuleGuard moduleId="warehouseInventory">
                            <WarehouseInventoryPage />
                        </AdminModuleGuard>}/>
                <Route path={appRoutes.adminWarehouseRequisitions} element={<AdminModuleGuard moduleId="warehouseRequisitions">
                            <WarehouseRequisitionsPage />
                        </AdminModuleGuard>}/>
                <Route path={appRoutes.adminWarehouseFulfillment} element={<AdminModuleGuard moduleId="warehouseFulfillment">
                            <WarehouseFulfillmentPage />
                        </AdminModuleGuard>}/>
                <Route path={appRoutes.adminWarehouseSupplierOrders} element={<AdminModuleGuard moduleId="warehouseSupplierOrders">
                            <WarehouseSupplierOrdersPage />
                        </AdminModuleGuard>}/>
                <Route path={appRoutes.adminWarehouseHelp} element={<AdminModuleGuard moduleId="warehouseHelp">
                            <WarehouseHelpPage />
                        </AdminModuleGuard>}/>
            </Route>

            <Route element={<RouteGuard allowedRoles={["supplier", "warehouse"]}>
                        <PortalLayout />
                    </RouteGuard>}>
                <Route path={appRoutes.supplierProducts} element={<SupplierProductsPage />}/>
                <Route path={appRoutes.supplierRevenue} element={<SupplierRevenuePage />}/>
                <Route path={appRoutes.supplierInventory} element={<SupplierInventoryPage />}/>
                <Route path={appRoutes.supplierRequisitions} element={<SupplierRequisitionsPage />}/>
                <Route path={appRoutes.supplierProcessing} element={<SupplierProcessingPage />}/>
                <Route path={appRoutes.supplierOrders} element={<SupplierOrdersPage />}/>
                <Route path={appRoutes.supplierHelp} element={<SupplierHelpPage />}/>
                <Route path={appRoutes.warehouseInventory} element={<WarehouseInventoryPage />}/>
                <Route path={appRoutes.warehouseRequisitions} element={<WarehouseRequisitionsPage />}/>
                <Route path={appRoutes.warehouseFulfillment} element={<WarehouseFulfillmentPage />}/>
                <Route path={appRoutes.warehouseSupplierOrders} element={<WarehouseSupplierOrdersPage />}/>
                <Route path={appRoutes.warehouseHelp} element={<WarehouseHelpPage />}/>
            </Route>

            <Route path="/account" element={<Navigate replace to={appRoutes.accountProfile}/>}/>
            <Route path="/supplier" element={<SupplierRootRedirect />}/>
            <Route path="/warehouse" element={<WarehouseRootRedirect />}/>
            <Route path="*" element={<Navigate replace to={appRoutes.home}/>}/>
        </Routes>
    </Suspense>);
}
