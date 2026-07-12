import { useEffect, useMemo, useState } from "react";
import { hasAdminPermission } from "@/shared/lib/auth";
import { formatCurrency } from "@/shared/lib/format";
import { useAdminCatalogStore } from "@/shared/lib/store/use-admin-catalog-store";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { ActionIconButton, AdminDrawer, AdminPageHeader, AdminToolbar, Badge, Button, DataTable, Icon, StatCard, SurfaceCard, cn, } from "@/shared/ui";
const emptyProductForm = {
    name: "",
    sku: "",
    categoryId: "",
    supplierId: "",
    description: "",
    imageUrl: "",
    salePrice: "0",
    stockQuantity: "0",
    isActive: true,
};
const emptyCategoryForm = {
    name: "",
    description: "",
    isActive: true,
};
const emptySupplierForm = {
    supplierCode: "",
    name: "",
    contactName: "",
    phone: "",
    email: "",
    address: "",
    isActive: true,
};
function isAvailable(isActive, isDeleted) {
    return isActive !== false && isDeleted !== true;
}
function activeTone(isActive, isDeleted) {
    return isAvailable(isActive, isDeleted) ? "success" : "warning";
}
function activeLabel(isActive, isDeleted) {
    return isAvailable(isActive, isDeleted) ? "Dang hoat dong" : "Tam dung";
}
function FieldValue({ label, value }) {
    return (<div className="rounded-2xl bg-surface-container-low p-4 text-sm">
            <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">
                {label}
            </p>
            <p className="mt-2 font-medium text-on-surface">{value || "Chua cap nhat"}</p>
        </div>);
}
export function AdminRepositoryPage({ initialTab = "products", lockedTab, } = {}) {
    const [tab, setTab] = useState(lockedTab ?? initialTab);
    const [query, setQuery] = useState("");
    const [drawer, setDrawer] = useState(null);
    const [productForm, setProductForm] = useState(emptyProductForm);
    const [categoryForm, setCategoryForm] = useState(emptyCategoryForm);
    const [supplierForm, setSupplierForm] = useState(emptySupplierForm);
    const user = useAuthStore((state) => state.session?.user ?? null);
    const products = useAdminCatalogStore((state) => state.products);
    const categories = useAdminCatalogStore((state) => state.categories);
    const suppliers = useAdminCatalogStore((state) => state.suppliers);
    const isLoading = useAdminCatalogStore((state) => state.isLoading);
    const isSaving = useAdminCatalogStore((state) => state.isSaving);
    const error = useAdminCatalogStore((state) => state.error);
    const loadData = useAdminCatalogStore((state) => state.loadData);
    const createProduct = useAdminCatalogStore((state) => state.createProduct);
    const updateProduct = useAdminCatalogStore((state) => state.updateProduct);
    const deleteProduct = useAdminCatalogStore((state) => state.deleteProduct);
    const createCategory = useAdminCatalogStore((state) => state.createCategory);
    const updateCategory = useAdminCatalogStore((state) => state.updateCategory);
    const deleteCategory = useAdminCatalogStore((state) => state.deleteCategory);
    const createSupplier = useAdminCatalogStore((state) => state.createSupplier);
    const updateSupplier = useAdminCatalogStore((state) => state.updateSupplier);
    const deleteSupplier = useAdminCatalogStore((state) => state.deleteSupplier);
    const pushToast = useFeedbackStore((state) => state.pushToast);
    const canViewProducts = hasAdminPermission(user, "admin.products.view");
    const canCreateProduct = hasAdminPermission(user, "admin.products.create");
    const canUpdateProduct = hasAdminPermission(user, "admin.products.update");
    const canDeleteProduct = hasAdminPermission(user, "admin.products.delete");
    const canCreateCategory = hasAdminPermission(user, "admin.categories.create");
    const canUpdateCategory = hasAdminPermission(user, "admin.categories.update");
    const canDeleteCategory = hasAdminPermission(user, "admin.categories.delete");
    const canCreateSupplier = hasAdminPermission(user, "admin.suppliers.create");
    const canUpdateSupplier = hasAdminPermission(user, "admin.suppliers.update");
    const canDeleteSupplier = hasAdminPermission(user, "admin.suppliers.delete");
    const canManageCategories = canCreateCategory || canUpdateCategory || canDeleteCategory;
    const canManageSuppliers = canCreateSupplier || canUpdateSupplier || canDeleteSupplier;
    const visibleTabs = useMemo(() => {
        const tabs = [
            {
                id: "products",
                label: "Sản phẩm",
                visible: canViewProducts || canCreateProduct || canUpdateProduct || canDeleteProduct,
            },
            {
                id: "categories",
                label: "Danh mục",
                visible: canManageCategories,
            },
            {
                id: "suppliers",
                label: "Nhà cung cấp",
                visible: canManageSuppliers,
            },
        ].filter((item) => item.visible);
        return lockedTab ? tabs.filter((item) => item.id === lockedTab) : tabs;
    }, [
        canCreateProduct,
        canDeleteProduct,
        canManageCategories,
        canManageSuppliers,
        canUpdateProduct,
        canViewProducts,
        lockedTab,
    ]);
    useEffect(() => {
        void loadData({
            includeProducts: canViewProducts,
            includeInactiveCategories: canManageCategories,
            includeInactiveSuppliers: canManageSuppliers,
        });
    }, [canManageCategories, canManageSuppliers, canViewProducts, loadData]);
    useEffect(() => {
        if (lockedTab) {
            setTab(lockedTab);
            return;
        }
        if (visibleTabs.length > 0 && !visibleTabs.some((item) => item.id === tab)) {
            setTab(visibleTabs[0].id);
        }
    }, [lockedTab, tab, visibleTabs]);
    const activeTab = lockedTab ?? (visibleTabs.some((item) => item.id === tab) ? tab : visibleTabs[0]?.id);
    const keyword = query.trim().toLowerCase();
    const filteredProducts = useMemo(() => {
        return products.filter((product) => {
            if (!keyword)
                return true;
            return [product.name, product.sku, product.category?.name, product.supplier?.name]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(keyword);
        });
    }, [keyword, products]);
    const filteredCategories = useMemo(() => {
        return categories.filter((category) => {
            if (!keyword)
                return true;
            return [category.name, category.description].filter(Boolean).join(" ").toLowerCase().includes(keyword);
        });
    }, [categories, keyword]);
    const filteredSuppliers = useMemo(() => {
        return suppliers.filter((supplier) => {
            if (!keyword)
                return true;
            return [
                supplier.supplier_code,
                supplier.name,
                supplier.contact_name,
                supplier.phone,
                supplier.email,
                supplier.address,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(keyword);
        });
    }, [keyword, suppliers]);
    const activeProduct = drawer?.entity === "products" && drawer.id
        ? products.find((product) => String(product.id) === drawer.id)
        : undefined;
    const activeCategory = drawer?.entity === "categories" && drawer.id
        ? categories.find((category) => String(category.id) === drawer.id)
        : undefined;
    const activeSupplier = drawer?.entity === "suppliers" && drawer.id
        ? suppliers.find((supplier) => String(supplier.id) === drawer.id)
        : undefined;
    useEffect(() => {
        if (!activeProduct || drawer?.mode === "create")
            return;
        setProductForm({
            name: activeProduct.name,
            sku: activeProduct.sku,
            categoryId: String(activeProduct.category_id),
            supplierId: activeProduct.supplier_id ? String(activeProduct.supplier_id) : "",
            description: activeProduct.description ?? "",
            imageUrl: activeProduct.image_url ?? "",
            salePrice: String(activeProduct.sale_price),
            stockQuantity: String(activeProduct.stock_quantity),
            isActive: isAvailable(activeProduct.is_active, activeProduct.is_deleted),
        });
    }, [activeProduct, drawer?.mode]);
    useEffect(() => {
        if (!activeCategory || drawer?.mode === "create")
            return;
        setCategoryForm({
            name: activeCategory.name,
            description: activeCategory.description ?? "",
            isActive: isAvailable(activeCategory.is_active, activeCategory.is_deleted),
        });
    }, [activeCategory, drawer?.mode]);
    useEffect(() => {
        if (!activeSupplier || drawer?.mode === "create")
            return;
        setSupplierForm({
            supplierCode: activeSupplier.supplier_code ?? "",
            name: activeSupplier.name,
            contactName: activeSupplier.contact_name ?? "",
            phone: activeSupplier.phone ?? "",
            email: activeSupplier.email ?? "",
            address: activeSupplier.address ?? "",
            isActive: isAvailable(activeSupplier.is_active, activeSupplier.is_deleted),
        });
    }, [activeSupplier, drawer?.mode]);
    const stats = [
        {
            id: "repository-products",
            label: "Tổng sản phẩm",
            value: canViewProducts ? `${products.length}` : "-",
            tone: "primary",
            icon: "inventory_2",
            delta: canViewProducts
                ? `${filteredProducts.length} sản phẩm đang hiển thị`
                : "Chưa có quyền xem danh sách sản phẩm",
        },
        {
            id: "repository-categories",
            label: "Danh mục",
            value: `${categories.length}`,
            tone: "secondary",
            icon: "category",
            delta: `${categories.filter((category) => !isAvailable(category.is_active, category.is_deleted)).length} đang tạm dừng`,
        },
        {
            id: "repository-suppliers",
            label: "Nhà cung cấp",
            value: `${suppliers.length}`,
            tone: "tertiary",
            icon: "local_shipping",
            delta: `${suppliers.filter((supplier) => !isAvailable(supplier.is_active, supplier.is_deleted)).length} đang tạm dừng`,
        },
    ];
    function openCreateDrawer(entity) {
        if (entity === "products")
            setProductForm(emptyProductForm);
        if (entity === "categories")
            setCategoryForm(emptyCategoryForm);
        if (entity === "suppliers")
            setSupplierForm(emptySupplierForm);
        setDrawer({ entity, mode: "create" });
    }
    function openRecordDrawer(entity, id, mode) {
        setDrawer({ entity, mode, id: String(id) });
    }
    function closeDrawer() {
        setDrawer(null);
    }
    function productPayloadFromForm() {
        const salePrice = Number(productForm.salePrice);
        const stockQuantity = Number(productForm.stockQuantity);
        return {
            category_id: Number(productForm.categoryId),
            supplier_id: productForm.supplierId ? Number(productForm.supplierId) : null,
            sku: productForm.sku.trim(),
            name: productForm.name.trim(),
            description: productForm.description.trim(),
            image_url: productForm.imageUrl.trim() || null,
            sale_price: Number.isFinite(salePrice) ? salePrice : 0,
            stock_quantity: Number.isFinite(stockQuantity) ? stockQuantity : 0,
            is_active: productForm.isActive,
            is_deleted: false,
        };
    }
    function productPayloadFromRecord(product, isActive) {
        return {
            category_id: product.category_id,
            supplier_id: product.supplier_id,
            sku: product.sku,
            name: product.name,
            description: product.description ?? "",
            image_url: product.image_url ?? null,
            sale_price: Number(product.sale_price),
            stock_quantity: product.stock_quantity,
            is_active: isActive,
            is_deleted: isActive ? false : product.is_deleted,
        };
    }
    async function handleCreateProduct() {
        if (!productForm.name.trim() || !productForm.sku.trim() || !productForm.categoryId) {
            pushToast({ tone: "warning", message: "Can nhap ten, SKU va danh muc cho san pham." });
            return;
        }
        const result = await createProduct(productPayloadFromForm());
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Khong the tao san pham." });
            return;
        }
        setDrawer({ entity: "products", mode: "view", id: String(result.data.id) });
        pushToast({ tone: "success", message: `Da tao san pham ${result.data.name}.` });
    }
    async function handleUpdateProduct() {
        if (!activeProduct)
            return;
        const result = await updateProduct(activeProduct.id, productPayloadFromForm());
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Khong the cap nhat san pham." });
            return;
        }
        setDrawer({ entity: "products", mode: "view", id: String(result.data.id) });
        pushToast({ tone: "success", message: `Da cap nhat san pham ${result.data.name}.` });
    }
    async function handleDeactivateProduct(product = activeProduct) {
        if (!product)
            return;
        const result = await deleteProduct(product.id);
        if (!result.success) {
            pushToast({ tone: "warning", message: result.error ?? "Khong the an san pham." });
            return;
        }
        setDrawer({ entity: "products", mode: "view", id: String(product.id) });
        pushToast({ tone: "success", message: `Da an san pham ${product.name}.` });
    }
    async function handleRestoreProduct(product = activeProduct) {
        if (!product)
            return;
        const result = await updateProduct(product.id, productPayloadFromRecord(product, true));
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Khong the khoi phuc san pham." });
            return;
        }
        setDrawer({ entity: "products", mode: "view", id: String(result.data.id) });
        pushToast({ tone: "success", message: `Da khoi phuc san pham ${result.data.name}.` });
    }
    async function handleCreateCategory() {
        if (!categoryForm.name.trim()) {
            pushToast({ tone: "warning", message: "Can nhap ten danh muc." });
            return;
        }
        const result = await createCategory({
            name: categoryForm.name.trim(),
            description: categoryForm.description.trim(),
            is_active: categoryForm.isActive,
            is_deleted: false,
        });
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Khong the tao danh muc." });
            return;
        }
        setDrawer({ entity: "categories", mode: "view", id: String(result.data.id) });
        pushToast({ tone: "success", message: `Da tao danh muc ${result.data.name}.` });
    }
    async function handleUpdateCategory() {
        if (!activeCategory)
            return;
        const result = await updateCategory(activeCategory.id, {
            name: categoryForm.name.trim(),
            description: categoryForm.description.trim(),
            is_active: categoryForm.isActive,
            is_deleted: false,
        });
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Khong the cap nhat danh muc." });
            return;
        }
        setDrawer({ entity: "categories", mode: "view", id: String(result.data.id) });
        pushToast({ tone: "success", message: `Da cap nhat danh muc ${result.data.name}.` });
    }
    async function handleDeactivateCategory(category = activeCategory) {
        if (!category)
            return;
        const result = await deleteCategory(category.id);
        if (!result.success) {
            pushToast({ tone: "warning", message: result.error ?? "Khong the an danh muc." });
            return;
        }
        setDrawer({ entity: "categories", mode: "view", id: String(category.id) });
        pushToast({ tone: "success", message: `Da an danh muc ${category.name}.` });
    }
    async function handleRestoreCategory(category = activeCategory) {
        if (!category)
            return;
        const result = await updateCategory(category.id, {
            name: category.name,
            description: category.description ?? "",
            is_active: true,
            is_deleted: false,
        });
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Khong the khoi phuc danh muc." });
            return;
        }
        setDrawer({ entity: "categories", mode: "view", id: String(result.data.id) });
        pushToast({ tone: "success", message: `Da khoi phuc danh muc ${result.data.name}.` });
    }
    async function handleCreateSupplier() {
        if (!supplierForm.supplierCode.trim() || !supplierForm.name.trim() || !supplierForm.phone.trim()) {
            pushToast({ tone: "warning", message: "Can nhap ma, ten va so dien thoai nha cung cap." });
            return;
        }
        const result = await createSupplier({
            supplier_code: supplierForm.supplierCode.trim(),
            name: supplierForm.name.trim(),
            contact_name: supplierForm.contactName.trim() || null,
            phone: supplierForm.phone.trim(),
            email: supplierForm.email.trim() || null,
            address: supplierForm.address.trim() || null,
            is_active: supplierForm.isActive,
            is_deleted: false,
        });
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Khong the tao nha cung cap." });
            return;
        }
        setDrawer({ entity: "suppliers", mode: "view", id: String(result.data.id) });
        pushToast({ tone: "success", message: `Da tao nha cung cap ${result.data.name}.` });
    }
    async function handleUpdateSupplier() {
        if (!activeSupplier)
            return;
        const result = await updateSupplier(activeSupplier.id, {
            supplier_code: supplierForm.supplierCode.trim(),
            name: supplierForm.name.trim(),
            contact_name: supplierForm.contactName.trim() || null,
            phone: supplierForm.phone.trim(),
            email: supplierForm.email.trim() || null,
            address: supplierForm.address.trim() || null,
            is_active: supplierForm.isActive,
            is_deleted: false,
        });
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Khong the cap nhat nha cung cap." });
            return;
        }
        setDrawer({ entity: "suppliers", mode: "view", id: String(result.data.id) });
        pushToast({ tone: "success", message: `Da cap nhat nha cung cap ${result.data.name}.` });
    }
    async function handleDeactivateSupplier(supplier = activeSupplier) {
        if (!supplier)
            return;
        const result = await deleteSupplier(supplier.id);
        if (!result.success) {
            pushToast({ tone: "warning", message: result.error ?? "Khong the an nha cung cap." });
            return;
        }
        setDrawer({ entity: "suppliers", mode: "view", id: String(supplier.id) });
        pushToast({ tone: "success", message: `Da an nha cung cap ${supplier.name}.` });
    }
    async function handleRestoreSupplier(supplier = activeSupplier) {
        if (!supplier)
            return;
        const result = await updateSupplier(supplier.id, {
            supplier_code: supplier.supplier_code ?? `SUP-${supplier.id}`,
            name: supplier.name,
            contact_name: supplier.contact_name ?? null,
            phone: supplier.phone ?? "",
            email: supplier.email ?? null,
            address: supplier.address ?? null,
            is_active: true,
            is_deleted: false,
        });
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Khong the khoi phuc nha cung cap." });
            return;
        }
        setDrawer({ entity: "suppliers", mode: "view", id: String(result.data.id) });
        pushToast({ tone: "success", message: `Da khoi phuc nha cung cap ${result.data.name}.` });
    }
    const productColumns = [
        {
            key: "product",
            title: "Sản phẩm",
            width: "28%",
            render: (product) => (<div className="flex items-center gap-4">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-surface-container-low">
                        {product.image_url ? (<img className="h-full w-full object-cover" src={product.image_url} alt=""/>) : (<div className="flex h-full w-full items-center justify-center text-primary">
                                <Icon name="inventory_2"/>
                            </div>)}
                    </div>
                    <div className="min-w-0">
                        <p className="truncate font-semibold">{product.name}</p>
                        <p className="truncate text-xs font-mono text-on-surface-variant">{product.sku}</p>
                    </div>
                </div>),
        },
        {
            key: "category",
            title: "Danh mục",
            width: "14%",
            render: (product) => product.category?.name ?? `#${product.category_id}`,
        },
        {
            key: "price",
            title: "Giá",
            align: "right",
            width: "12%",
            nowrap: true,
            render: (product) => <span className="font-semibold">{formatCurrency(Number(product.sale_price))}</span>,
        },
        {
            key: "stock",
            title: "Tồn kho",
            width: "9%",
            nowrap: true,
            render: (product) => `${product.stock_quantity} units`,
        },
        {
            key: "supplier",
            title: "Nhà cung cấp",
            width: "16%",
            render: (product) => product.supplier?.name ?? "Chua gan",
        },
        {
            key: "status",
            title: "Trạng thái",
            width: "11%",
            nowrap: true,
            render: (product) => (<Badge tone={activeTone(product.is_active, product.is_deleted)}>
                    {activeLabel(product.is_active, product.is_deleted)}
                </Badge>),
        },
        {
            key: "actions",
            title: "Thao tác",
            align: "right",
            width: "10%",
            nowrap: true,
            render: (product) => (<div className="flex justify-end gap-1">
                    <ActionIconButton label={`Xem ${product.name}`} icon="visibility" onClick={() => openRecordDrawer("products", product.id, "view")}/>
                    <ActionIconButton label={`Sửa ${product.name}`} icon="edit" tone="primary" disabled={!canUpdateProduct} onClick={() => openRecordDrawer("products", product.id, "edit")}/>
                    {isAvailable(product.is_active, product.is_deleted) ? (<ActionIconButton label={`Ẩn ${product.name}`} icon="visibility_off" tone="danger" disabled={!canDeleteProduct} onClick={() => void handleDeactivateProduct(product)}/>) : (<ActionIconButton label={`Khôi phục ${product.name}`} icon="settings_backup_restore" tone="success" disabled={!canUpdateProduct} onClick={() => void handleRestoreProduct(product)}/>)}
                </div>),
        },
    ];
    const categoryColumns = [
        {
            key: "name",
            title: "Danh mục",
            width: "68%",
            render: (category) => (<div>
                    <p className="font-semibold">{category.name}</p>
                    <p className="line-clamp-1 text-xs text-on-surface-variant">{category.description || "Không có mô tả"}</p>
                </div>),
        },
        {
            key: "status",
            title: "Trạng thái",
            width: "16%",
            nowrap: true,
            render: (category) => (<Badge tone={activeTone(category.is_active, category.is_deleted)}>
                    {activeLabel(category.is_active, category.is_deleted)}
                </Badge>),
        },
        {
            key: "actions",
            title: "Thao tác",
            align: "right",
            width: "16%",
            nowrap: true,
            render: (category) => (<div className="flex justify-end gap-1">
                    <ActionIconButton label={`Xem ${category.name}`} icon="visibility" onClick={() => openRecordDrawer("categories", category.id, "view")}/>
                    <ActionIconButton label={`Sửa ${category.name}`} icon="edit" tone="primary" disabled={!canUpdateCategory} onClick={() => openRecordDrawer("categories", category.id, "edit")}/>
                    {!isAvailable(category.is_active, category.is_deleted) ? (<ActionIconButton label={`Khôi phục ${category.name}`} icon="settings_backup_restore" tone="success" disabled={!canUpdateCategory} onClick={() => void handleRestoreCategory(category)}/>) : (<ActionIconButton label={`Ẩn ${category.name}`} icon="visibility_off" tone="danger" disabled={!canDeleteCategory} onClick={() => void handleDeactivateCategory(category)}/>)}
                </div>),
        },
    ];
    const supplierColumns = [
        {
            key: "supplier",
            title: "Nhà cung cấp",
            width: "25%",
            render: (supplier) => (<div>
                    <p className="font-semibold">{supplier.name}</p>
                    <p className="text-xs font-mono text-on-surface-variant">{supplier.supplier_code ?? `SUP-${supplier.id}`}</p>
                </div>),
        },
        {
            key: "contact",
            title: "Liên hệ",
            width: "22%",
            render: (supplier) => (<div>
                    <p>{supplier.contact_name || "Chưa có liên hệ"}</p>
                    <p className="text-xs text-on-surface-variant">{supplier.phone || "Chưa có SĐT"}</p>
                </div>),
        },
        {
            key: "email",
            title: "Email",
            width: "23%",
            render: (supplier) => supplier.email || "Chưa có email",
        },
        {
            key: "status",
            title: "Trạng thái",
            width: "14%",
            nowrap: true,
            render: (supplier) => (<Badge tone={activeTone(supplier.is_active, supplier.is_deleted)}>
                    {activeLabel(supplier.is_active, supplier.is_deleted)}
                </Badge>),
        },
        {
            key: "actions",
            title: "Thao tác",
            align: "right",
            width: "16%",
            nowrap: true,
            render: (supplier) => (<div className="flex justify-end gap-1">
                    <ActionIconButton label={`Xem ${supplier.name}`} icon="visibility" onClick={() => openRecordDrawer("suppliers", supplier.id, "view")}/>
                    <ActionIconButton label={`Sửa ${supplier.name}`} icon="edit" tone="primary" disabled={!canUpdateSupplier} onClick={() => openRecordDrawer("suppliers", supplier.id, "edit")}/>
                    {!isAvailable(supplier.is_active, supplier.is_deleted) ? (<ActionIconButton label={`Khôi phục ${supplier.name}`} icon="settings_backup_restore" tone="success" disabled={!canUpdateSupplier} onClick={() => void handleRestoreSupplier(supplier)}/>) : (<ActionIconButton label={`Ẩn ${supplier.name}`} icon="visibility_off" tone="danger" disabled={!canDeleteSupplier} onClick={() => void handleDeactivateSupplier(supplier)}/>)}
                </div>),
        },
    ];
    const pageMeta = {
        products: {
            title: "Sản phẩm",
            description: "Quản lý product repository, giá bán, tồn kho và nhà cung cấp theo mẫu admin.",
        },
        categories: {
            title: "Danh mục",
            description: "Quản lý category storefront và nội dung hiển thị trong catalog.",
        },
        suppliers: {
            title: "Nhà cung cấp",
            description: "Quản lý hồ sơ nhà cung cấp, liên hệ và trạng thái hợp tác.",
        },
    }[activeTab ?? "products"];
    const drawerTitle = drawer?.entity === "products"
        ? drawer.mode === "create"
            ? "Tao san pham"
            : drawer.mode === "edit"
                ? "Chinh sua san pham"
                : "Chi tiet san pham"
        : drawer?.entity === "categories"
            ? drawer.mode === "create"
                ? "Tao danh muc"
                : drawer.mode === "edit"
                    ? "Chinh sua danh muc"
                    : "Chi tiet danh muc"
            : drawer?.entity === "suppliers"
                ? drawer.mode === "create"
                    ? "Tao nha cung cap"
                    : drawer.mode === "edit"
                        ? "Chinh sua nha cung cap"
                        : "Chi tiet nha cung cap"
                : "";
    return (<div className="space-y-8">
            <AdminPageHeader title={pageMeta.title} description={pageMeta.description} actions={activeTab ? (<Button disabled={(activeTab === "products" && !canCreateProduct) ||
                (activeTab === "categories" && !canCreateCategory) ||
                (activeTab === "suppliers" && !canCreateSupplier)} onClick={() => openCreateDrawer(activeTab)}>
                        Tạo mới
                    </Button>) : null}/>

            <section className="grid gap-6 xl:grid-cols-3">
                {stats.map((stat) => (<StatCard key={stat.id} metric={stat}/>))}
            </section>

            {!lockedTab ? (<div className="flex flex-wrap gap-3">
                    {visibleTabs.map((item) => (<button key={item.id} className={cn("rounded-full px-4 py-2 text-sm font-medium", activeTab === item.id
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-low text-on-surface-variant")} onClick={() => setTab(item.id)}>
                            {item.label}
                        </button>))}
                </div>) : null}

            <SurfaceCard className="space-y-5">
                <AdminToolbar>
                    <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" placeholder="Lọc theo tên, mã, danh mục hoặc nhà cung cấp..." value={query} onChange={(event) => setQuery(event.target.value)}/>
                </AdminToolbar>

                {error ? <p className="text-sm text-error">{error}</p> : null}
                {visibleTabs.length === 0 ? (<p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                        Bạn chưa có quyền thao tác trong kho sản phẩm.
                    </p>) : null}

                {activeTab === "products" ? (!canViewProducts ? (<p className="rounded-2xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
                            Bạn chưa có quyền xem danh sách sản phẩm.
                        </p>) : (<DataTable rows={filteredProducts} columns={productColumns} getRowKey={(product) => String(product.id)} isLoading={isLoading} emptyMessage="Không có sản phẩm phù hợp bộ lọc hiện tại." minWidth="1120px" pagination={{ pageSize: 6, itemLabel: "sản phẩm" }} rowClassName={(product) => drawer?.entity === "products" && drawer.id === String(product.id)
                ? "border-l-4 border-primary bg-primary/5"
                : undefined} onRowClick={(product) => openRecordDrawer("products", product.id, "view")}/>)) : null}
                {activeTab === "categories" ? (<DataTable rows={filteredCategories} columns={categoryColumns} getRowKey={(category) => String(category.id)} isLoading={isLoading} emptyMessage="Không có danh mục phù hợp bộ lọc hiện tại." minWidth="760px" pagination={{ pageSize: 6, itemLabel: "danh muc" }} rowClassName={(category) => drawer?.entity === "categories" && drawer.id === String(category.id)
                ? "border-l-4 border-primary bg-primary/5"
                : undefined} onRowClick={(category) => openRecordDrawer("categories", category.id, "view")}/>) : null}
                {activeTab === "suppliers" ? (<DataTable rows={filteredSuppliers} columns={supplierColumns} getRowKey={(supplier) => String(supplier.id)} isLoading={isLoading} emptyMessage="Không có nhà cung cấp phù hợp bộ lọc hiện tại." minWidth="920px" pagination={{ pageSize: 6, itemLabel: "nha cung cap" }} rowClassName={(supplier) => drawer?.entity === "suppliers" && drawer.id === String(supplier.id)
                ? "border-l-4 border-primary bg-primary/5"
                : undefined} onRowClick={(supplier) => openRecordDrawer("suppliers", supplier.id, "view")}/>) : null}
            </SurfaceCard>

            <AdminDrawer open={drawer !== null} mode={drawer?.mode ?? "view"} title={drawerTitle} subtitle={drawer?.entity === "products"
            ? activeProduct?.sku
            : drawer?.entity === "suppliers"
                ? activeSupplier?.supplier_code
                : undefined} onClose={closeDrawer} footer={<div className="flex flex-wrap justify-end gap-3">
                        <Button variant="outline" onClick={closeDrawer}>
                            Dong
                        </Button>
                        {drawer?.mode === "create" && drawer.entity === "products" ? (<Button disabled={isSaving || !canCreateProduct} onClick={() => void handleCreateProduct()}>
                                Tao san pham
                            </Button>) : null}
                        {drawer?.mode === "edit" && drawer.entity === "products" ? (<Button disabled={isSaving || !activeProduct || !canUpdateProduct} onClick={() => void handleUpdateProduct()}>
                                Luu chinh sua
                            </Button>) : null}
                        {drawer?.mode === "view" && drawer.entity === "products" && activeProduct ? (<>
                                <Button variant="secondary" disabled={!canUpdateProduct} onClick={() => setDrawer({ ...drawer, mode: "edit" })}>
                                    Sua
                                </Button>
                                {isAvailable(activeProduct.is_active, activeProduct.is_deleted) ? (<Button variant="ghost" disabled={isSaving || !canDeleteProduct} onClick={() => void handleDeactivateProduct()}>
                                        An san pham
                                    </Button>) : (<Button variant="secondary" disabled={isSaving || !canUpdateProduct} onClick={() => void handleRestoreProduct()}>
                                        Khoi phuc
                                    </Button>)}
                            </>) : null}
                        {drawer?.mode === "create" && drawer.entity === "categories" ? (<Button disabled={isSaving || !canCreateCategory} onClick={() => void handleCreateCategory()}>
                                Tao danh muc
                            </Button>) : null}
                        {drawer?.mode === "edit" && drawer.entity === "categories" ? (<Button disabled={isSaving || !activeCategory || !canUpdateCategory} onClick={() => void handleUpdateCategory()}>
                                Luu chinh sua
                            </Button>) : null}
                        {drawer?.mode === "view" && drawer.entity === "categories" && activeCategory ? (<>
                                <Button variant="secondary" disabled={!canUpdateCategory} onClick={() => setDrawer({ ...drawer, mode: "edit" })}>
                                    Sua
                                </Button>
                                {!isAvailable(activeCategory.is_active, activeCategory.is_deleted) ? (<Button variant="secondary" disabled={isSaving || !canUpdateCategory} onClick={() => void handleRestoreCategory()}>
                                        Khoi phuc
                                    </Button>) : (<Button variant="ghost" disabled={isSaving || !canDeleteCategory} onClick={() => void handleDeactivateCategory()}>
                                        An danh muc
                                    </Button>)}
                            </>) : null}
                        {drawer?.mode === "create" && drawer.entity === "suppliers" ? (<Button disabled={isSaving || !canCreateSupplier} onClick={() => void handleCreateSupplier()}>
                                Tao nha cung cap
                            </Button>) : null}
                        {drawer?.mode === "edit" && drawer.entity === "suppliers" ? (<Button disabled={isSaving || !activeSupplier || !canUpdateSupplier} onClick={() => void handleUpdateSupplier()}>
                                Luu chinh sua
                            </Button>) : null}
                        {drawer?.mode === "view" && drawer.entity === "suppliers" && activeSupplier ? (<>
                                <Button variant="secondary" disabled={!canUpdateSupplier} onClick={() => setDrawer({ ...drawer, mode: "edit" })}>
                                    Sua
                                </Button>
                                {!isAvailable(activeSupplier.is_active, activeSupplier.is_deleted) ? (<Button variant="secondary" disabled={isSaving || !canUpdateSupplier} onClick={() => void handleRestoreSupplier()}>
                                        Khoi phuc
                                    </Button>) : (<Button variant="ghost" disabled={isSaving || !canDeleteSupplier} onClick={() => void handleDeactivateSupplier()}>
                                        An nha cung cap
                                    </Button>)}
                            </>) : null}
                    </div>}>
                {drawer?.entity === "products" && drawer.mode === "view" && activeProduct ? (<div className="space-y-5">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="font-headline text-xl font-bold">{activeProduct.name}</h3>
                                <p className="mt-1 text-sm font-mono text-on-surface-variant">{activeProduct.sku}</p>
                            </div>
                            <Badge tone={activeTone(activeProduct.is_active, activeProduct.is_deleted)}>
                                {activeLabel(activeProduct.is_active, activeProduct.is_deleted)}
                            </Badge>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FieldValue label="Category" value={activeProduct.category?.name ?? `#${activeProduct.category_id}`}/>
                            <FieldValue label="Supplier" value={activeProduct.supplier?.name ?? "Chua gan"}/>
                            <FieldValue label="Price" value={formatCurrency(Number(activeProduct.sale_price))}/>
                            <FieldValue label="Stock" value={`${activeProduct.stock_quantity} units`}/>
                        </div>
                        <FieldValue label="Mo ta" value={activeProduct.description}/>
                    </div>) : null}

                {drawer?.entity === "products" && (drawer.mode === "create" || drawer.mode === "edit") ? (<div className="grid gap-4 md:grid-cols-2">
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="Ten san pham" value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))}/>
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="SKU" value={productForm.sku} onChange={(event) => setProductForm((current) => ({ ...current, sku: event.target.value }))}/>
                        <select className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" value={productForm.categoryId} onChange={(event) => setProductForm((current) => ({ ...current, categoryId: event.target.value }))}>
                            <option value="">Chon danh muc</option>
                            {categories.map((category) => (<option key={category.id} value={category.id}>{category.name}</option>))}
                        </select>
                        <select className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" value={productForm.supplierId} onChange={(event) => setProductForm((current) => ({ ...current, supplierId: event.target.value }))}>
                            <option value="">Khong gan nha cung cap</option>
                            {suppliers.map((supplier) => (<option key={supplier.id} value={supplier.id}>{supplier.name}</option>))}
                        </select>
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="Gia ban" type="number" min={0} value={productForm.salePrice} onChange={(event) => setProductForm((current) => ({ ...current, salePrice: event.target.value }))}/>
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="So luong ton" type="number" min={0} value={productForm.stockQuantity} onChange={(event) => setProductForm((current) => ({ ...current, stockQuantity: event.target.value }))}/>
                        <textarea className="min-h-28 resize-none rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15 md:col-span-2" placeholder="Mo ta san pham" value={productForm.description} onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))}/>
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15 md:col-span-2" placeholder="URL hinh anh san pham" value={productForm.imageUrl} onChange={(event) => setProductForm((current) => ({ ...current, imageUrl: event.target.value }))}/>
                        <label className="flex items-center gap-3 rounded-2xl bg-surface-container-highest px-4 py-3 text-sm text-on-surface-variant md:col-span-2">
                            <input type="checkbox" checked={productForm.isActive} onChange={(event) => setProductForm((current) => ({ ...current, isActive: event.target.checked }))}/>
                            San pham dang hoat dong tren storefront
                        </label>
                    </div>) : null}

                {drawer?.entity === "categories" && drawer.mode === "view" && activeCategory ? (<div className="space-y-5">
                        <div className="flex items-start justify-between gap-4">
                            <h3 className="font-headline text-xl font-bold">{activeCategory.name}</h3>
                            <Badge tone={activeTone(activeCategory.is_active, activeCategory.is_deleted)}>
                                {activeLabel(activeCategory.is_active, activeCategory.is_deleted)}
                            </Badge>
                        </div>
                        <FieldValue label="Mo ta" value={activeCategory.description}/>
                    </div>) : null}

                {drawer?.entity === "categories" && (drawer.mode === "create" || drawer.mode === "edit") ? (<div className="space-y-4">
                        <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="Ten danh muc" value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}/>
                        <textarea className="min-h-28 w-full resize-none rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="Mo ta danh muc" value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))}/>
                        <label className="flex items-center gap-3 rounded-2xl bg-surface-container-highest px-4 py-3 text-sm text-on-surface-variant">
                            <input type="checkbox" checked={categoryForm.isActive} onChange={(event) => setCategoryForm((current) => ({ ...current, isActive: event.target.checked }))}/>
                            Danh muc dang hoat dong
                        </label>
                    </div>) : null}

                {drawer?.entity === "suppliers" && drawer.mode === "view" && activeSupplier ? (<div className="space-y-5">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="font-headline text-xl font-bold">{activeSupplier.name}</h3>
                                <p className="mt-1 text-sm font-mono text-on-surface-variant">{activeSupplier.supplier_code ?? `SUP-${activeSupplier.id}`}</p>
                            </div>
                            <Badge tone={activeTone(activeSupplier.is_active, activeSupplier.is_deleted)}>
                                {activeLabel(activeSupplier.is_active, activeSupplier.is_deleted)}
                            </Badge>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FieldValue label="Nguoi lien he" value={activeSupplier.contact_name}/>
                            <FieldValue label="Phone" value={activeSupplier.phone}/>
                            <FieldValue label="Email" value={activeSupplier.email}/>
                            <FieldValue label="Dia chi" value={activeSupplier.address}/>
                        </div>
                    </div>) : null}

                {drawer?.entity === "suppliers" && (drawer.mode === "create" || drawer.mode === "edit") ? (<div className="grid gap-4 md:grid-cols-2">
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="Ma nha cung cap" value={supplierForm.supplierCode} onChange={(event) => setSupplierForm((current) => ({ ...current, supplierCode: event.target.value }))}/>
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="Ten nha cung cap" value={supplierForm.name} onChange={(event) => setSupplierForm((current) => ({ ...current, name: event.target.value }))}/>
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="Nguoi lien he" value={supplierForm.contactName} onChange={(event) => setSupplierForm((current) => ({ ...current, contactName: event.target.value }))}/>
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="So dien thoai" value={supplierForm.phone} onChange={(event) => setSupplierForm((current) => ({ ...current, phone: event.target.value }))}/>
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="Email" value={supplierForm.email} onChange={(event) => setSupplierForm((current) => ({ ...current, email: event.target.value }))}/>
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="Dia chi" value={supplierForm.address} onChange={(event) => setSupplierForm((current) => ({ ...current, address: event.target.value }))}/>
                        <label className="flex items-center gap-3 rounded-2xl bg-surface-container-highest px-4 py-3 text-sm text-on-surface-variant md:col-span-2">
                            <input type="checkbox" checked={supplierForm.isActive} onChange={(event) => setSupplierForm((current) => ({ ...current, isActive: event.target.checked }))}/>
                            Nha cung cap dang hoat dong
                        </label>
                    </div>) : null}
            </AdminDrawer>
        </div>);
}
