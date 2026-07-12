import { routes } from "@/shared/config/routes";

export const adminModules = [
    {
        id: "dashboard",
        label: "Tổng quan",
        to: routes.adminDashboard,
        icon: "dashboard",
        section: "overview",
    },
    {
        id: "users",
        label: "Người dùng",
        to: routes.adminUsers,
        icon: "group",
        section: "commerce",
    },
    {
        id: "products",
        label: "Sản phẩm",
        to: routes.adminProducts,
        icon: "inventory_2",
        section: "commerce",
    },
    {
        id: "categories",
        label: "Danh mục",
        to: routes.adminCategories,
        icon: "category",
        section: "commerce",
    },
    {
        id: "suppliers",
        label: "Nhà cung cấp",
        to: routes.adminSuppliers,
        icon: "local_shipping",
        section: "commerce",
    },
    {
        id: "shippingCarriers",
        label: "Vận chuyển",
        to: routes.adminShippingCarriers,
        icon: "local_shipping",
        section: "commerce",
    },
    {
        id: "logistics",
        label: "Điều phối đơn",
        to: routes.adminLogistics,
        icon: "shopping_cart",
        section: "commerce",
    },
    {
        id: "community",
        label: "Cộng đồng",
        to: routes.adminCommunity,
        icon: "group",
        section: "commerce",
    },
    {
        id: "settings",
        label: "Cài đặt",
        to: routes.adminSettings,
        icon: "settings",
        section: "system",
    },
    {
        id: "admins",
        label: "Tài khoản admin",
        to: routes.adminAdmins,
        icon: "admin_panel_settings",
        section: "system",
    },
    {
        id: "supplierInventory",
        label: "Tồn kho NCC",
        to: routes.adminSupplierInventory,
        icon: "inventory_2",
        section: "supplier",
    },
    {
        id: "supplierRequisitions",
        label: "Phiếu NCC",
        to: routes.adminSupplierRequisitions,
        icon: "assignment_turned_in",
        section: "supplier",
    },
    {
        id: "supplierProcessing",
        label: "Xử lý đơn NCC",
        to: routes.adminSupplierProcessing,
        icon: "package_2",
        section: "supplier",
    },
    {
        id: "supplierOrders",
        label: "Đơn NCC",
        to: routes.adminSupplierOrders,
        icon: "local_shipping",
        section: "supplier",
    },
    {
        id: "supplierHelp",
        label: "Hỗ trợ NCC",
        to: routes.adminSupplierHelp,
        icon: "help",
        section: "supplier",
    },
    {
        id: "warehouseInventory",
        label: "Tồn kho",
        to: routes.adminWarehouseInventory,
        icon: "inventory_2",
        section: "warehouse",
    },
    {
        id: "warehouseRequisitions",
        label: "Phiếu tái nhập",
        to: routes.adminWarehouseRequisitions,
        icon: "assignment_turned_in",
        section: "warehouse",
    },
    {
        id: "warehouseFulfillment",
        label: "Fulfillment",
        to: routes.adminWarehouseFulfillment,
        icon: "package_2",
        section: "warehouse",
    },
    {
        id: "warehouseSupplierOrders",
        label: "Đơn NCC tại kho",
        to: routes.adminWarehouseSupplierOrders,
        icon: "local_shipping",
        section: "warehouse",
    },
    {
        id: "warehouseHelp",
        label: "Hỗ trợ kho",
        to: routes.adminWarehouseHelp,
        icon: "help",
        section: "warehouse",
    },
];

export function isSuperAdmin(user) {
    void user;
    return false;
}

export function canAccessAdminModule(user, module) {
    void module;
    return user?.role === "admin";
}

export function getAdminModule(moduleId) {
    return adminModules.find((module) => module.id === moduleId);
}

export function getFirstAccessibleAdminModule(user) {
    return adminModules.find((module) => canAccessAdminModule(user, module)) ?? null;
}
