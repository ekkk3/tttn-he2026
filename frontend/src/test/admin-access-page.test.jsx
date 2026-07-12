import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAdminsPage } from "@/pages/admin-admins/ui/admin-admins-page";
import { useAdminAdminsStore } from "@/shared/lib/store/use-admin-admins-store";

function seedStore(overrides = {}) {
    const loadAdmins = vi.fn(async () => ({ success: true }));
    const saveAdmin = vi.fn(async (payload) => ({
        success: true,
        data: {
            id: payload.id || 9,
            full_name: payload.fullName,
            email: payload.email,
            phone: payload.phone,
            role: "ADMIN",
            is_active: payload.isActive,
            is_deleted: false,
            created_by_admin: {
                id: 1,
                full_name: "Root Admin",
                email: "root@example.com",
            },
        },
    }));
    const updateAdminStatus = vi.fn(async (adminId, isActive) => ({
        success: true,
        data: {
            id: adminId,
            full_name: "Child Admin",
            email: "child-admin@example.com",
            phone: "0909000011",
            role: "ADMIN",
            is_active: isActive,
            is_deleted: !isActive,
            created_by_admin: {
                id: 1,
                full_name: "Root Admin",
                email: "root@example.com",
            },
        },
    }));
    const updateAdminPassword = vi.fn(async () => ({ success: true }));

    useAdminAdminsStore.setState({
        admins: [
            {
                id: 2,
                full_name: "Child Admin",
                email: "child-admin@example.com",
                phone: "0909000011",
                role: "ADMIN",
                is_active: true,
                is_deleted: false,
                created_by_admin: {
                    id: 1,
                    full_name: "Root Admin",
                    email: "root@example.com",
                },
            },
            {
                id: 3,
                full_name: "Locked Admin",
                email: "locked-admin@example.com",
                phone: "0909000012",
                role: "ADMIN",
                is_active: false,
                is_deleted: true,
                created_by_admin: null,
            },
        ],
        isLoading: false,
        isSaving: false,
        error: null,
        loadAdmins,
        saveAdmin,
        updateAdminStatus,
        updateAdminPassword,
        reset: vi.fn(),
        ...overrides,
    });

    return {
        loadAdmins,
        saveAdmin,
        updateAdminStatus,
        updateAdminPassword,
    };
}

describe("AdminAdminsPage", () => {
    beforeEach(() => {
        seedStore();
    });

    it("renders admin accounts and filters them by search", async () => {
        render(<AdminAdminsPage />);

        expect(await screen.findByRole("heading", { name: /^Tài khoản admin$/i, level: 1 })).toBeInTheDocument();
        expect(screen.getByText("child-admin@example.com")).toBeInTheDocument();
        expect(screen.getByText("locked-admin@example.com")).toBeInTheDocument();

        await userEvent.type(screen.getByPlaceholderText(/Tìm theo tên, email, số điện thoại/i), "locked");

        expect(screen.queryByText("child-admin@example.com")).not.toBeInTheDocument();
        expect(screen.getByText("locked-admin@example.com")).toBeInTheDocument();
    });

    it("loads an admin into the form and toggles status", async () => {
        const { updateAdminStatus } = seedStore();
        render(<AdminAdminsPage />);

        await userEvent.click((await screen.findAllByRole("button", { name: /^Sửa$/i }))[0]);
        expect(screen.getByDisplayValue("Child Admin")).toBeInTheDocument();
        expect(screen.getByDisplayValue("child-admin@example.com")).toBeInTheDocument();

        await userEvent.click(screen.getAllByRole("button", { name: /^Khóa$/i })[0]);
        expect(updateAdminStatus).toHaveBeenCalledWith(2, false);
    });

    it("creates a new admin from the standalone form", async () => {
        const { saveAdmin } = seedStore();
        render(<AdminAdminsPage />);

        await userEvent.clear(screen.getByLabelText(/Họ tên/i));
        await userEvent.type(screen.getByLabelText(/Họ tên/i), "Fresh Admin");
        await userEvent.clear(screen.getByLabelText(/Email/i));
        await userEvent.type(screen.getByLabelText(/Email/i), "fresh-admin@example.com");
        await userEvent.clear(screen.getByLabelText(/Số điện thoại/i));
        await userEvent.type(screen.getByLabelText(/Số điện thoại/i), "0909000099");
        await userEvent.type(screen.getByLabelText(/^Mật khẩu$/i), "password123");
        await userEvent.click(screen.getByRole("button", { name: /^Tạo admin$/i }));

        expect(saveAdmin).toHaveBeenCalledWith(expect.objectContaining({
            id: "",
            fullName: "Fresh Admin",
            email: "fresh-admin@example.com",
            phone: "0909000099",
            password: "password123",
            isActive: true,
        }));
    });
});
