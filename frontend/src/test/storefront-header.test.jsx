import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { routes } from "@/shared/config/routes";
import { resetDemoState } from "@/shared/lib/store/reset-demo";
import { useCartStore } from "@/shared/lib/store/use-cart-store";
import { StorefrontHeader } from "@/widgets/storefront-header";
function renderHeader(route) {
    return render(<MemoryRouter initialEntries={[route]}>
            <StorefrontHeader />
        </MemoryRouter>);
}
describe("StorefrontHeader", () => {
    beforeEach(() => {
        localStorage.clear();
        resetDemoState();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });
    it("shows the cart badge on non-catalog storefront routes when the cart has quantity", () => {
        useCartStore.setState({
            guestItems: [{ productId: "101", quantity: 3 }],
            items: [{ productId: "101", quantity: 3 }],
        });
        for (const route of [routes.home, routes.checkout, routes.story]) {
            const view = renderHeader(route);
            const cartLink = screen.getByRole("link", { name: /Giỏ hàng/i });
            expect(within(cartLink).getByText("3")).toBeInTheDocument();
            view.unmount();
        }
    });
});
