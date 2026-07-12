import { useAccountStore } from "@/shared/lib/store/use-account-store";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { useCartStore } from "@/shared/lib/store/use-cart-store";
import { useCustomerOrdersStore } from "@/shared/lib/store/use-customer-orders-store";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { useAdminOrdersStore } from "@/shared/lib/store/use-admin-orders-store";
import { useAdminUserStore } from "@/shared/lib/store/use-admin-user-store";
import { useVietnamLocationStore } from "@/shared/lib/store/use-vietnam-location-store";
import { useOperationsDataStore } from "@/shared/lib/store/use-operations-data-store";
import { usePostStore } from "@/shared/lib/store/use-post-store";
import { useShopStore } from "@/shared/lib/store/use-shop-store";
import { useStorefrontCatalogStore } from "@/shared/lib/store/use-storefront-catalog-store";
import { useUiStore } from "@/shared/lib/store/use-ui-store";
export function resetDemoState() {
    useAuthStore.getState().reset();
    useAccountStore.getState().reset();
    useOperationsDataStore.getState().reset();
    useAdminOrdersStore.getState().reset();
    useAdminUserStore.getState().reset();
    usePostStore.getState().reset();
    useCustomerOrdersStore.getState().reset();
    useCartStore.getState().reset();
    useVietnamLocationStore.getState().reset();
    useShopStore.getState().reset();
    useStorefrontCatalogStore.getState().reset();
    useUiStore.getState().reset();
    useFeedbackStore.getState().clear();
}
