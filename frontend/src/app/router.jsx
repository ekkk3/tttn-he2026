import { Navigate, Route, Routes } from "react-router-dom";
import { AdminModuleGuard } from "@/app/admin-module-guard";
import { AccountLayout } from "@/app/layouts/account-layout";
import { AdminLayout } from "@/app/layouts/admin-layout";
import { PortalLayout } from "@/app/layouts/portal-layout";
import { StorefrontLayout } from "@/app/layouts/storefront-layout";
import { RouteGuard } from "@/app/route-guard";
import { AccountAddressesPage } from "@/pages/account-addresses/ui/account-addresses-page";
import { AccountDisputesPage } from "@/pages/account-disputes/ui/account-disputes-page";
import { AccountNotificationsPage } from "@/pages/account-notifications/ui/account-notifications-page";
import { AccountWishlistPage } from "@/pages/account-wishlist/ui/account-wishlist-page";
import { AccountOrdersPage } from "@/pages/account-orders/ui/account-orders-page";
import { AccountProfilePage } from "@/pages/account-profile/ui/account-profile-page";
import { AccountRewardsPage } from "@/pages/account-rewards/ui/account-rewards-page";
import { AccountSecurityPage } from "@/pages/account-security/ui/account-security-page";
import { AdminCommunityPage } from "@/pages/admin-community/ui/admin-community-page";
import { AdminAdminsPage } from "@/pages/admin-admins/ui/admin-admins-page";
import { AdminSupplierApplicationsPage } from "@/pages/admin-supplier-applications/ui/admin-supplier-applications-page";
import { AdminComplaintsPage } from "@/pages/admin-complaints/ui/admin-complaints-page";
import { AdminReviewsPage } from "@/pages/admin-reviews/ui/admin-reviews-page";
import { AdminVouchersPage } from "@/pages/admin-vouchers/ui/admin-vouchers-page";
import { ForgotPasswordPage } from "@/pages/forgot-password/ui/forgot-password-page";
import { ResetPasswordPage } from "@/pages/reset-password/ui/reset-password-page";
import { SupplierRegisterPage } from "@/pages/supplier-register/ui/supplier-register-page";
import { AdminDashboardPage } from "@/pages/admin-dashboard/ui/admin-dashboard-page";
import { AdminLogisticsPage } from "@/pages/admin-logistics/ui/admin-logistics-page";
import { AdminRepositoryPage } from "@/pages/admin-repository/ui/admin-repository-page";
import { AdminSettingsPage } from "@/pages/admin-settings/ui/admin-settings-page";
import { AdminShippingCarriersPage } from "@/pages/admin-shipping-carriers/ui/admin-shipping-carriers-page";
import { AdminUserOrderDetailPage } from "@/pages/admin-user-order-detail/ui/admin-user-order-detail-page";
import { AdminUserOrdersPage } from "@/pages/admin-user-orders/ui/admin-user-orders-page";
import { AdminUsersPage } from "@/pages/admin-users/ui/admin-users-page";
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
import { SupplierHelpPage } from "@/pages/supplier-help/ui/supplier-help-page";
import { SupplierProductsPage } from "@/pages/supplier-products/ui/supplier-products-page";
import { SupplierRevenuePage } from "@/pages/supplier-revenue/ui/supplier-revenue-page";
import { SupplierInventoryPage } from "@/pages/supplier-inventory/ui/supplier-inventory-page";
import { SupplierOrdersPage } from "@/pages/supplier-orders/ui/supplier-orders-page";
import { SupplierProcessingPage } from "@/pages/supplier-processing/ui/supplier-processing-page";
import { SupplierRequisitionsPage } from "@/pages/supplier-requisitions/ui/supplier-requisitions-page";
import { UnauthorizedPage } from "@/pages/unauthorized/ui/unauthorized-page";
import { WarehouseFulfillmentPage } from "@/pages/warehouse-fulfillment/ui/warehouse-fulfillment-page";
import { WarehouseHelpPage } from "@/pages/warehouse-help/ui/warehouse-help-page";
import { WarehouseInventoryPage } from "@/pages/warehouse-inventory/ui/warehouse-inventory-page";
import { WarehouseRequisitionsPage } from "@/pages/warehouse-requisitions/ui/warehouse-requisitions-page";
import { WarehouseSupplierOrdersPage } from "@/pages/warehouse-supplier-orders/ui/warehouse-supplier-orders-page";
import { getFirstAccessibleAdminModule } from "@/shared/config/admin-modules";
import { routes as appRoutes } from "@/shared/config/routes";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
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
function SupplierRootRedirect() {
    const role = useAuthStore((state) => state.session?.user.role);
    return (<Navigate replace to={role === "admin" ? appRoutes.adminSupplierOrders : appRoutes.supplierOrders}/>);
}
function WarehouseRootRedirect() {
    const role = useAuthStore((state) => state.session?.user.role);
    return (<Navigate replace to={role === "admin" ? appRoutes.adminWarehouseInventory : appRoutes.warehouseInventory}/>);
}
function AdminUserOrdersGuard({ children }) {
    return <>{children}</>;
}
export function AppRoutes() {
    return (<Routes>
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
        </Routes>);
}
