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
// "Xóa" trong trang này thực chất là is_active=false (ẩn khỏi storefront) — is_deleted chỉ
// dùng cho trường hợp xóa hẳn ở tầng khác; 1 bản ghi được coi là "đang hoạt động" khi CẢ
// HAI đều không rơi vào trạng thái ẩn/xóa.
function isAvailable(isActive, isDeleted) {
    return isActive !== false && isDeleted !== true;
}
function activeTone(isActive, isDeleted) {
    return isAvailable(isActive, isDeleted) ? "success" : "warning";
}
function activeLabel(isActive, isDeleted) {
    return isAvailable(isActive, isDeleted) ? "Đang hoạt động" : "Tạm dừng";
}
function FieldValue({ label, value }) {
    return (<div className="rounded-2xl bg-surface-container-low p-4 text-sm">
            <p className="text-xs font-label uppercase tracking-[0.14em] text-on-surface-variant">
                {label}
            </p>
            <p className="mt-2 font-medium text-on-surface">{value || "Chưa cập nhật"}</p>
        </div>);
}
// Trang này quản lý CHUNG 3 "thực thể" (sản phẩm/danh mục/nhà cung cấp) trong 1 component,
// chuyển qua lại bằng tab — `lockedTab` cho phép nhúng trang này vào route CHỈ hiện 1 tab cố
// định (router.jsx dùng lockedTab="products"/"categories"/"suppliers" cho 3 route riêng biệt
// /admin/products, /admin/categories, /admin/suppliers, dù cùng chạy 1 component này).
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
    // Chỉ hiện tab nào user có ÍT NHẤT 1 quyền liên quan (xem/tạo/sửa/xóa) — nếu đang ở
    // route lockedTab (vd /admin/categories) thì thu hẹp danh sách chỉ còn đúng tab đó.
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
    // Nếu route ép cố định 1 tab (lockedTab) thì luôn dùng đúng tab đó; ngược lại nếu tab
    // đang chọn không còn nằm trong visibleTabs (vd quyền vừa thay đổi) thì tự chuyển sang
    // tab hợp lệ đầu tiên, tránh hiển thị 1 tab user không còn quyền thao tác.
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
    // 3 effect giống nhau (product/category/supplier): khi mở drawer ở mode "view"/"edit" cho
    // 1 bản ghi cụ thể, đổ dữ liệu bản ghi đó vào form tương ứng. Bỏ qua khi mode "create" vì
    // lúc đó form phải giữ nguyên giá trị rỗng (emptyXxxForm) đã set lúc bấm "Tạo mới".
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
    // Build payload từ FORM (dùng cho tạo mới/lưu chỉnh sửa — người dùng có thể đã đổi giá trị).
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
    // Build payload từ chính BẢN GHI gốc (không phải form) — dùng riêng cho nút "Khôi phục"
    // ở bảng danh sách: chỉ cần đổi mỗi is_active=true, giữ nguyên mọi field khác y hệt bản
    // ghi hiện có, không cần (và không nên) đi qua state form đang có thể đang trống/khác bản ghi.
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
            pushToast({ tone: "warning", message: "Cần nhập tên, SKU và danh mục cho sản phẩm." });
            return;
        }
        const result = await createProduct(productPayloadFromForm());
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể tạo sản phẩm." });
            return;
        }
        setDrawer({ entity: "products", mode: "view", id: String(result.data.id) });
        pushToast({ tone: "success", message: `Đã tạo sản phẩm ${result.data.name}.` });
    }
    async function handleUpdateProduct() {
        if (!activeProduct)
            return;
        const result = await updateProduct(activeProduct.id, productPayloadFromForm());
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể cập nhật sản phẩm." });
            return;
        }
        setDrawer({ entity: "products", mode: "view", id: String(result.data.id) });
        pushToast({ tone: "success", message: `Đã cập nhật sản phẩm ${result.data.name}.` });
    }
    async function handleDeactivateProduct(product = activeProduct) {
        if (!product)
            return;
        const result = await deleteProduct(product.id);
        if (!result.success) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể ẩn sản phẩm." });
            return;
        }
        setDrawer({ entity: "products", mode: "view", id: String(product.id) });
        pushToast({ tone: "success", message: `Đã ẩn sản phẩm ${product.name}.` });
    }
    async function handleRestoreProduct(product = activeProduct) {
        if (!product)
            return;
        const result = await updateProduct(product.id, productPayloadFromRecord(product, true));
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể khôi phục sản phẩm." });
            return;
        }
        setDrawer({ entity: "products", mode: "view", id: String(result.data.id) });
        pushToast({ tone: "success", message: `Đã khôi phục sản phẩm ${result.data.name}.` });
    }
    async function handleCreateCategory() {
        if (!categoryForm.name.trim()) {
            pushToast({ tone: "warning", message: "Cần nhập tên danh mục." });
            return;
        }
        const result = await createCategory({
            name: categoryForm.name.trim(),
            description: categoryForm.description.trim(),
            is_active: categoryForm.isActive,
            is_deleted: false,
        });
        if (!result.success || !result.data) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể tạo danh mục." });
            return;
        }
        setDrawer({ entity: "categories", mode: "view", id: String(result.data.id) });
        pushToast({ tone: "success", message: `Đã tạo danh mục ${result.data.name}.` });
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
            pushToast({ tone: "warning", message: result.error ?? "Không thể cập nhật danh mục." });
            return;
        }
        setDrawer({ entity: "categories", mode: "view", id: String(result.data.id) });
        pushToast({ tone: "success", message: `Đã cập nhật danh mục ${result.data.name}.` });
    }
    async function handleDeactivateCategory(category = activeCategory) {
        if (!category)
            return;
        const result = await deleteCategory(category.id);
        if (!result.success) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể ẩn danh mục." });
            return;
        }
        setDrawer({ entity: "categories", mode: "view", id: String(category.id) });
        pushToast({ tone: "success", message: `Đã ẩn danh mục ${category.name}.` });
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
            pushToast({ tone: "warning", message: result.error ?? "Không thể khôi phục danh mục." });
            return;
        }
        setDrawer({ entity: "categories", mode: "view", id: String(result.data.id) });
        pushToast({ tone: "success", message: `Đã khôi phục danh mục ${result.data.name}.` });
    }
    async function handleCreateSupplier() {
        if (!supplierForm.supplierCode.trim() || !supplierForm.name.trim() || !supplierForm.phone.trim()) {
            pushToast({ tone: "warning", message: "Cần nhập mã, tên và số điện thoại nhà cung cấp." });
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
            pushToast({ tone: "warning", message: result.error ?? "Không thể tạo nhà cung cấp." });
            return;
        }
        setDrawer({ entity: "suppliers", mode: "view", id: String(result.data.id) });
        pushToast({ tone: "success", message: `Đã tạo nhà cung cấp ${result.data.name}.` });
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
            pushToast({ tone: "warning", message: result.error ?? "Không thể cập nhật nhà cung cấp." });
            return;
        }
        setDrawer({ entity: "suppliers", mode: "view", id: String(result.data.id) });
        pushToast({ tone: "success", message: `Đã cập nhật nhà cung cấp ${result.data.name}.` });
    }
    async function handleDeactivateSupplier(supplier = activeSupplier) {
        if (!supplier)
            return;
        const result = await deleteSupplier(supplier.id);
        if (!result.success) {
            pushToast({ tone: "warning", message: result.error ?? "Không thể ẩn nhà cung cấp." });
            return;
        }
        setDrawer({ entity: "suppliers", mode: "view", id: String(supplier.id) });
        pushToast({ tone: "success", message: `Đã ẩn nhà cung cấp ${supplier.name}.` });
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
            pushToast({ tone: "warning", message: result.error ?? "Không thể khôi phục nhà cung cấp." });
            return;
        }
        setDrawer({ entity: "suppliers", mode: "view", id: String(result.data.id) });
        pushToast({ tone: "success", message: `Đã khôi phục nhà cung cấp ${result.data.name}.` });
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
            render: (product) => product.supplier?.name ?? "Chưa gán",
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
    // Tiêu đề drawer = tổ hợp (entity × mode): 3 loại thực thể x 3 chế độ (create/edit/view)
    // -> 9 tiêu đề khác nhau, tính bằng chuỗi ternary lồng nhau thay vì bảng tra cứu vì mỗi
    // nhánh entity chỉ dùng 1 lần.
    const drawerTitle = drawer?.entity === "products"
        ? drawer.mode === "create"
            ? "Tạo sản phẩm"
            : drawer.mode === "edit"
                ? "Chỉnh sửa sản phẩm"
                : "Chi tiết sản phẩm"
        : drawer?.entity === "categories"
            ? drawer.mode === "create"
                ? "Tạo danh mục"
                : drawer.mode === "edit"
                    ? "Chỉnh sửa danh mục"
                    : "Chi tiết danh mục"
            : drawer?.entity === "suppliers"
                ? drawer.mode === "create"
                    ? "Tạo nhà cung cấp"
                    : drawer.mode === "edit"
                        ? "Chỉnh sửa nhà cung cấp"
                        : "Chi tiết nhà cung cấp"
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
                {activeTab === "categories" ? (<DataTable rows={filteredCategories} columns={categoryColumns} getRowKey={(category) => String(category.id)} isLoading={isLoading} emptyMessage="Không có danh mục phù hợp bộ lọc hiện tại." minWidth="760px" pagination={{ pageSize: 6, itemLabel: "danh mục" }} rowClassName={(category) => drawer?.entity === "categories" && drawer.id === String(category.id)
                ? "border-l-4 border-primary bg-primary/5"
                : undefined} onRowClick={(category) => openRecordDrawer("categories", category.id, "view")}/>) : null}
                {activeTab === "suppliers" ? (<DataTable rows={filteredSuppliers} columns={supplierColumns} getRowKey={(supplier) => String(supplier.id)} isLoading={isLoading} emptyMessage="Không có nhà cung cấp phù hợp bộ lọc hiện tại." minWidth="920px" pagination={{ pageSize: 6, itemLabel: "nhà cung cấp" }} rowClassName={(supplier) => drawer?.entity === "suppliers" && drawer.id === String(supplier.id)
                ? "border-l-4 border-primary bg-primary/5"
                : undefined} onRowClick={(supplier) => openRecordDrawer("suppliers", supplier.id, "view")}/>) : null}
            </SurfaceCard>

            <AdminDrawer open={drawer !== null} mode={drawer?.mode ?? "view"} title={drawerTitle} subtitle={drawer?.entity === "products"
            ? activeProduct?.sku
            : drawer?.entity === "suppliers"
                ? activeSupplier?.supplier_code
                : undefined} onClose={closeDrawer} footer={<div className="flex flex-wrap justify-end gap-3">
                        <Button variant="outline" onClick={closeDrawer}>
                            Đóng
                        </Button>
                        {drawer?.mode === "create" && drawer.entity === "products" ? (<Button disabled={isSaving || !canCreateProduct} onClick={() => void handleCreateProduct()}>
                                Tạo sản phẩm
                            </Button>) : null}
                        {drawer?.mode === "edit" && drawer.entity === "products" ? (<Button disabled={isSaving || !activeProduct || !canUpdateProduct} onClick={() => void handleUpdateProduct()}>
                                Lưu chỉnh sửa
                            </Button>) : null}
                        {drawer?.mode === "view" && drawer.entity === "products" && activeProduct ? (<>
                                <Button variant="secondary" disabled={!canUpdateProduct} onClick={() => setDrawer({ ...drawer, mode: "edit" })}>
                                    Sửa
                                </Button>
                                {isAvailable(activeProduct.is_active, activeProduct.is_deleted) ? (<Button variant="ghost" disabled={isSaving || !canDeleteProduct} onClick={() => void handleDeactivateProduct()}>
                                        Ẩn sản phẩm
                                    </Button>) : (<Button variant="secondary" disabled={isSaving || !canUpdateProduct} onClick={() => void handleRestoreProduct()}>
                                        Khôi phục
                                    </Button>)}
                            </>) : null}
                        {drawer?.mode === "create" && drawer.entity === "categories" ? (<Button disabled={isSaving || !canCreateCategory} onClick={() => void handleCreateCategory()}>
                                Tạo danh mục
                            </Button>) : null}
                        {drawer?.mode === "edit" && drawer.entity === "categories" ? (<Button disabled={isSaving || !activeCategory || !canUpdateCategory} onClick={() => void handleUpdateCategory()}>
                                Lưu chỉnh sửa
                            </Button>) : null}
                        {drawer?.mode === "view" && drawer.entity === "categories" && activeCategory ? (<>
                                <Button variant="secondary" disabled={!canUpdateCategory} onClick={() => setDrawer({ ...drawer, mode: "edit" })}>
                                    Sửa
                                </Button>
                                {!isAvailable(activeCategory.is_active, activeCategory.is_deleted) ? (<Button variant="secondary" disabled={isSaving || !canUpdateCategory} onClick={() => void handleRestoreCategory()}>
                                        Khôi phục
                                    </Button>) : (<Button variant="ghost" disabled={isSaving || !canDeleteCategory} onClick={() => void handleDeactivateCategory()}>
                                        Ẩn danh mục
                                    </Button>)}
                            </>) : null}
                        {drawer?.mode === "create" && drawer.entity === "suppliers" ? (<Button disabled={isSaving || !canCreateSupplier} onClick={() => void handleCreateSupplier()}>
                                Tạo nhà cung cấp
                            </Button>) : null}
                        {drawer?.mode === "edit" && drawer.entity === "suppliers" ? (<Button disabled={isSaving || !activeSupplier || !canUpdateSupplier} onClick={() => void handleUpdateSupplier()}>
                                Lưu chỉnh sửa
                            </Button>) : null}
                        {drawer?.mode === "view" && drawer.entity === "suppliers" && activeSupplier ? (<>
                                <Button variant="secondary" disabled={!canUpdateSupplier} onClick={() => setDrawer({ ...drawer, mode: "edit" })}>
                                    Sửa
                                </Button>
                                {!isAvailable(activeSupplier.is_active, activeSupplier.is_deleted) ? (<Button variant="secondary" disabled={isSaving || !canUpdateSupplier} onClick={() => void handleRestoreSupplier()}>
                                        Khôi phục
                                    </Button>) : (<Button variant="ghost" disabled={isSaving || !canDeleteSupplier} onClick={() => void handleDeactivateSupplier()}>
                                        Ẩn nhà cung cấp
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
                            <FieldValue label="Supplier" value={activeProduct.supplier?.name ?? "Chưa gán"}/>
                            <FieldValue label="Price" value={formatCurrency(Number(activeProduct.sale_price))}/>
                            <FieldValue label="Stock" value={`${activeProduct.stock_quantity} units`}/>
                        </div>
                        <FieldValue label="Mô tả" value={activeProduct.description}/>
                    </div>) : null}

                {drawer?.entity === "products" && (drawer.mode === "create" || drawer.mode === "edit") ? (<div className="grid gap-4 md:grid-cols-2">
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="Tên sản phẩm" value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))}/>
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="SKU" value={productForm.sku} onChange={(event) => setProductForm((current) => ({ ...current, sku: event.target.value }))}/>
                        <select className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" value={productForm.categoryId} onChange={(event) => setProductForm((current) => ({ ...current, categoryId: event.target.value }))}>
                            <option value="">Chọn danh mục</option>
                            {categories.map((category) => (<option key={category.id} value={category.id}>{category.name}</option>))}
                        </select>
                        <select className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none" value={productForm.supplierId} onChange={(event) => setProductForm((current) => ({ ...current, supplierId: event.target.value }))}>
                            <option value="">Không gán nhà cung cấp</option>
                            {suppliers.map((supplier) => (<option key={supplier.id} value={supplier.id}>{supplier.name}</option>))}
                        </select>
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="Giá bán" type="number" min={0} value={productForm.salePrice} onChange={(event) => setProductForm((current) => ({ ...current, salePrice: event.target.value }))}/>
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="Số lượng tồn" type="number" min={0} value={productForm.stockQuantity} onChange={(event) => setProductForm((current) => ({ ...current, stockQuantity: event.target.value }))}/>
                        <textarea className="min-h-28 resize-none rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15 md:col-span-2" placeholder="Mô tả sản phẩm" value={productForm.description} onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))}/>
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15 md:col-span-2" placeholder="URL hình ảnh sản phẩm" value={productForm.imageUrl} onChange={(event) => setProductForm((current) => ({ ...current, imageUrl: event.target.value }))}/>
                        <label className="flex items-center gap-3 rounded-2xl bg-surface-container-highest px-4 py-3 text-sm text-on-surface-variant md:col-span-2">
                            <input type="checkbox" checked={productForm.isActive} onChange={(event) => setProductForm((current) => ({ ...current, isActive: event.target.checked }))}/>
                            Sản phẩm đang hoạt động trên storefront
                        </label>
                    </div>) : null}

                {drawer?.entity === "categories" && drawer.mode === "view" && activeCategory ? (<div className="space-y-5">
                        <div className="flex items-start justify-between gap-4">
                            <h3 className="font-headline text-xl font-bold">{activeCategory.name}</h3>
                            <Badge tone={activeTone(activeCategory.is_active, activeCategory.is_deleted)}>
                                {activeLabel(activeCategory.is_active, activeCategory.is_deleted)}
                            </Badge>
                        </div>
                        <FieldValue label="Mô tả" value={activeCategory.description}/>
                    </div>) : null}

                {drawer?.entity === "categories" && (drawer.mode === "create" || drawer.mode === "edit") ? (<div className="space-y-4">
                        <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="Tên danh mục" value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}/>
                        <textarea className="min-h-28 w-full resize-none rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="Mô tả danh mục" value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))}/>
                        <label className="flex items-center gap-3 rounded-2xl bg-surface-container-highest px-4 py-3 text-sm text-on-surface-variant">
                            <input type="checkbox" checked={categoryForm.isActive} onChange={(event) => setCategoryForm((current) => ({ ...current, isActive: event.target.checked }))}/>
                            Danh mục đang hoạt động
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
                            <FieldValue label="Người liên hệ" value={activeSupplier.contact_name}/>
                            <FieldValue label="Phone" value={activeSupplier.phone}/>
                            <FieldValue label="Email" value={activeSupplier.email}/>
                            <FieldValue label="Địa chỉ" value={activeSupplier.address}/>
                        </div>
                    </div>) : null}

                {drawer?.entity === "suppliers" && (drawer.mode === "create" || drawer.mode === "edit") ? (<div className="grid gap-4 md:grid-cols-2">
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="Mã nhà cung cấp" value={supplierForm.supplierCode} onChange={(event) => setSupplierForm((current) => ({ ...current, supplierCode: event.target.value }))}/>
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="Tên nhà cung cấp" value={supplierForm.name} onChange={(event) => setSupplierForm((current) => ({ ...current, name: event.target.value }))}/>
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="Người liên hệ" value={supplierForm.contactName} onChange={(event) => setSupplierForm((current) => ({ ...current, contactName: event.target.value }))}/>
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="Số điện thoại" value={supplierForm.phone} onChange={(event) => setSupplierForm((current) => ({ ...current, phone: event.target.value }))}/>
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="Email" value={supplierForm.email} onChange={(event) => setSupplierForm((current) => ({ ...current, email: event.target.value }))}/>
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 outline-none focus:ring-2 focus:ring-primary/15" placeholder="Địa chỉ" value={supplierForm.address} onChange={(event) => setSupplierForm((current) => ({ ...current, address: event.target.value }))}/>
                        <label className="flex items-center gap-3 rounded-2xl bg-surface-container-highest px-4 py-3 text-sm text-on-surface-variant md:col-span-2">
                            <input type="checkbox" checked={supplierForm.isActive} onChange={(event) => setSupplierForm((current) => ({ ...current, isActive: event.target.checked }))}/>
                            Nhà cung cấp đang hoạt động
                        </label>
                    </div>) : null}
            </AdminDrawer>
        </div>);
}
