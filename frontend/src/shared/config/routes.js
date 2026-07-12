function withQuery(path, options = {}) {
    const params = new URLSearchParams();
    if (options.search)
        params.set("search", options.search);
    if (options.categories?.length)
        params.set("categories", options.categories.join(","));
    if (options.suppliers?.length)
        params.set("suppliers", options.suppliers.join(","));
    if (options.regions?.length)
        params.set("regions", options.regions.join(","));
    if (options.sort)
        params.set("sort", options.sort);
    if (options.price)
        params.set("price", String(options.price));
    if (options.ratingMin)
        params.set("ratingMin", String(options.ratingMin));
    const query = params.toString();
    return query ? `${path}?${query}` : path;
}
export const routes = {
    home: "/",
    login: "/login",
    register: "/register",
    logout: "/logout",
    unauthorized: "/unauthorized",
    products: "/products",
    productsWithQuery: (options = {}) => withQuery("/products", options),
    productDetail: (slug = ":slug") => `/products/${slug}`,
    story: "/story",
    regions: "/regions",
    checkout: "/checkout",
    orderSuccess: (orderId = ":orderId") => `/checkout/success/${orderId}`,
    accountProfile: "/account/profile",
    accountSecurity: "/account/security",
    accountNotifications: "/account/notifications",
    accountAddresses: "/account/addresses",
    accountRewards: "/account/rewards",
    accountDisputes: "/account/disputes",
    accountOrders: "/account/orders",
    accountOrderDetail: (orderId = ":orderId") => `/account/orders/${orderId}`,
    accountWishlist: "/account/wishlist",
    adminDashboard: "/admin",
    adminDashboardLegacy: "/admin/dashboard",
    adminCommunity: "/admin/community",
    adminRepository: "/admin/repository",
    adminUsers: "/admin/users",
    adminUserOrders: (userId = ":userId") => `/admin/users/${userId}/orders`,
    adminUserOrderDetail: (userId = ":userId", orderId = ":orderId") => `/admin/users/${userId}/orders/${orderId}`,
    adminProducts: "/admin/products",
    adminCategories: "/admin/categories",
    adminSuppliers: "/admin/suppliers",
    adminShippingCarriers: "/admin/shipping-carriers",
    adminLogistics: "/admin/logistics",
    adminSettings: "/admin/settings",
    adminAdmins: "/admin/admins",
    adminSupplierInventory: "/admin/supplier/inventory",
    adminSupplierRequisitions: "/admin/supplier/requisitions",
    adminSupplierProcessing: "/admin/supplier/processing",
    adminSupplierOrders: "/admin/supplier/orders",
    adminSupplierHelp: "/admin/supplier/help",
    adminWarehouseInventory: "/admin/warehouse/inventory",
    adminWarehouseRequisitions: "/admin/warehouse/requisitions",
    adminWarehouseFulfillment: "/admin/warehouse/fulfillment",
    adminWarehouseSupplierOrders: "/admin/warehouse/supplier-orders",
    adminWarehouseHelp: "/admin/warehouse/help",
    supplierInventory: "/supplier/inventory",
    supplierRequisitions: "/supplier/requisitions",
    supplierProcessing: "/supplier/processing",
    supplierOrders: "/supplier/orders",
    supplierHelp: "/supplier/help",
    warehouseInventory: "/warehouse/inventory",
    warehouseRequisitions: "/warehouse/requisitions",
    warehouseFulfillment: "/warehouse/fulfillment",
    warehouseSupplierOrders: "/warehouse/supplier-orders",
    warehouseHelp: "/warehouse/help",
    productTest: "/product-test"
};
export const roleProtectedPrefixes = [
    {
        prefix: "/account",
        roles: ["customer"],
    },
    {
        prefix: "/admin",
        roles: ["admin"],
    },
    {
        prefix: "/supplier",
        roles: ["supplier"],
    },
    {
        prefix: "/warehouse",
        roles: ["warehouse"],
    },
];
