import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountAddressesPage } from "@/pages/account-addresses/ui/account-addresses-page";
import { resetDemoState } from "@/shared/lib/store/reset-demo";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { getJsonBody, getRequestPath, jsonResponse } from "@/test/backend-test-utils";
function setBackendCustomerSession() {
    useAuthStore.setState({
        session: {
            user: {
                id: "1",
                name: "Nguyen Van A",
                email: "customer@example.com",
                role: "customer",
            },
            loggedInAt: "2026-05-23T08:00:00.000Z",
        },
        accessToken: "token-1",
        accessTokenExpiresAt: "2026-12-31T10:00:00.000Z",
        authSource: "backend",
    });
}
describe("AccountAddressesPage", () => {
    beforeEach(() => {
        localStorage.clear();
        resetDemoState();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });
    it("selects province, district, and ward from the vietnam location API", async () => {
        const fetchMock = vi.fn((input, init) => {
            const path = getRequestPath(input);
            if (path.endsWith("/api/account/profile") && (!init?.method || init.method === "GET")) {
                return jsonResponse({
                    data: {
                        id: 1,
                        name: "Nguyen Van A",
                        email: "customer@example.com",
                        phone: "0909123456",
                        address: "123 Nguyen Trai",
                        city: "Ha Noi",
                        favorite_region: "Thai Nguyen",
                        avatar: null,
                        member_since: "2026-04-20T00:00:00.000000Z",
                        newsletter: false,
                        sms_alerts: false,
                        order_email: true,
                        security_alerts: true,
                        addresses: [],
                        reward_snapshot: {
                            tier: "Member",
                            points: 0,
                            next_tier_points: 100,
                            perks: [],
                        },
                        reward_history: [],
                    },
                });
            }
            if (path.endsWith("/api/account/addresses") && init?.method === "POST") {
                const body = getJsonBody(init);
                return jsonResponse({
                    data: {
                        id: 1,
                        name: "Nguyen Van A",
                        email: "customer@example.com",
                        phone: "0909123456",
                        address: "123 Nguyen Trai",
                        city: "Ha Noi",
                        favorite_region: "Thai Nguyen",
                        avatar: null,
                        member_since: "2026-04-20T00:00:00.000000Z",
                        newsletter: false,
                        sms_alerts: false,
                        order_email: true,
                        security_alerts: true,
                        addresses: [
                            {
                                id: 1,
                                label: body?.label,
                                recipient: body?.recipient,
                                phone: body?.phone,
                                line1: body?.line1,
                                city: body?.city,
                                ghn_province_id: body?.ghn_province_id,
                                ghn_province_name: body?.ghn_province_name,
                                ghn_district_id: body?.ghn_district_id,
                                ghn_district_name: body?.ghn_district_name,
                                ghn_ward_code: body?.ghn_ward_code,
                                ghn_ward_name: body?.ghn_ward_name,
                                note: body?.note,
                                is_default: false,
                            },
                        ],
                        reward_snapshot: {
                            tier: "Member",
                            points: 0,
                            next_tier_points: 100,
                            perks: [],
                        },
                        reward_history: [],
                    },
                }, { status: 201 });
            }
            if (path === "/api/v1/" || path === "/api/v1") {
                return jsonResponse([
                    {
                        code: 1,
                        name: "Ha Noi",
                        codename: "ha_noi",
                        division_type: "thanh pho",
                        districts: [
                            {
                                code: 11,
                                name: "Ba Dinh",
                                codename: "ba_dinh",
                                division_type: "quan",
                                province_code: 1,
                            },
                        ],
                    },
                ]);
            }
            if (path === "/api/v1/d/11") {
                return jsonResponse({
                    code: 11,
                    name: "Ba Dinh",
                    codename: "ba_dinh",
                    division_type: "quan",
                    province_code: 1,
                    wards: [
                        {
                            code: 11111,
                            name: "Phuc Xa",
                            codename: "phuc_xa",
                            division_type: "phuong",
                            district_code: 11,
                        },
                    ],
                });
            }
            throw new Error(`Unexpected request: ${path}`);
        });
        vi.stubGlobal("fetch", fetchMock);
        setBackendCustomerSession();
        const user = userEvent.setup();
        render(<AccountAddressesPage />);
        expect(await screen.findByRole("option", { name: "Ha Noi" })).toBeInTheDocument();
        await user.type(screen.getByLabelText("Nhãn gợi nhớ"), "Nha");
        await user.type(screen.getByLabelText("Người nhận"), "Nguyen Van A");
        await user.type(screen.getByLabelText("Số điện thoại"), "0909123456");
        await user.type(screen.getByLabelText("Địa chỉ chi tiết"), "123 Nguyen Trai");
        await user.selectOptions(screen.getByLabelText("Tỉnh/thành"), "1");
        await user.selectOptions(screen.getByLabelText("Quận/huyện"), "11");
        await waitFor(() => {
            expect(screen.getByRole("option", { name: "Phuc Xa" })).toBeInTheDocument();
        });
        await user.selectOptions(screen.getByLabelText("Phường/xã"), "11111");
        await user.type(screen.getByLabelText("Ghi chú"), "Giao gio hanh chinh");
        await user.click(screen.getByRole("button", { name: "Thêm địa chỉ" }));
        await waitFor(() => {
            expect(fetchMock.mock.calls.some(([input, init]) => getRequestPath(input).endsWith("/api/account/addresses") &&
                init?.method === "POST")).toBe(true);
        });
        const createCall = fetchMock.mock.calls.find(([input, init]) => getRequestPath(input).endsWith("/api/account/addresses") && init?.method === "POST");
        expect(createCall).toBeTruthy();
        expect(getJsonBody(createCall?.[1])).toMatchObject({
            label: "Nha",
            recipient: "Nguyen Van A",
            phone: "0909123456",
            line1: "123 Nguyen Trai",
            city: "Ha Noi",
            ghn_province_id: 1,
            ghn_province_name: "Ha Noi",
            ghn_district_id: 11,
            ghn_district_name: "Ba Dinh",
            ghn_ward_code: "11111",
            ghn_ward_name: "Phuc Xa",
            note: "Giao gio hanh chinh",
        });
    });
});
