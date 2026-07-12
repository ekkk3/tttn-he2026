import { useEffect, useState } from "react";
import { apiRequest } from "@/shared/api/backend-client";
import { formatCurrency } from "@/shared/lib/format";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";

const emptyForm = {
    id: null,
    name: "",
    sku: "",
    categoryId: "",
    regionId: "",
    salePrice: "0",
    stockQuantity: "0",
    origin: "",
    shortDescription: "",
};

export function SupplierProductsPage() {
    const accessToken = useAuthStore((state) => state.accessToken);
    const pushToast = useFeedbackStore((state) => state.pushToast);

    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [regions, setRegions] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    async function loadProducts() {
        setIsLoading(true);
        setError("");
        try {
            const response = await apiRequest("/supplier/products", { token: accessToken });
            setProducts(response.data ?? []);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Không thể tải sản phẩm.");
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        void loadProducts();
        void apiRequest("/categories").then((r) => setCategories(r.data ?? [])).catch(() => {});
        void apiRequest("/regions").then((r) => setRegions(r.data ?? [])).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken]);

    function updateField(key, value) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    function editProduct(product) {
        setForm({
            id: product.id,
            name: product.name,
            sku: product.sku ?? "",
            categoryId: String(product.category_id ?? ""),
            regionId: String(product.region_id ?? ""),
            salePrice: String(product.sale_price ?? 0),
            stockQuantity: String(product.stock_quantity ?? 0),
            origin: product.origin ?? "",
            shortDescription: product.short_description ?? "",
        });
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (!form.name.trim() || !form.categoryId) {
            pushToast({ tone: "warning", message: "Cần nhập tên và chọn danh mục." });
            return;
        }
        setIsSaving(true);
        const body = {
            name: form.name.trim(),
            sku: form.sku.trim() || null,
            category_id: Number(form.categoryId),
            region_id: form.regionId ? Number(form.regionId) : null,
            sale_price: Number(form.salePrice) || 0,
            stock_quantity: Number(form.stockQuantity) || 0,
            origin: form.origin.trim() || null,
            short_description: form.shortDescription.trim() || null,
        };
        try {
            if (form.id) {
                await apiRequest(`/supplier/products/${form.id}`, { method: "PUT", token: accessToken, body });
                pushToast({ tone: "success", message: "Đã cập nhật sản phẩm." });
            } else {
                await apiRequest("/supplier/products", { method: "POST", token: accessToken, body });
                pushToast({ tone: "success", message: "Đã tạo sản phẩm mới." });
            }
            setForm(emptyForm);
            await loadProducts();
        } catch (saveError) {
            pushToast({ tone: "warning", message: saveError instanceof Error ? saveError.message : "Không thể lưu sản phẩm." });
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="space-y-6 p-6">
            <div>
                <h1 className="font-headline text-2xl font-bold text-on-surface">Sản phẩm của tôi</h1>
                <p className="mt-1 text-sm text-on-surface-variant">
                    Quản lý các sản phẩm do nhà cung cấp của bạn cung cấp (UC 2.2.15).
                </p>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-4 rounded-3xl bg-white p-6 shadow-sm md:grid-cols-3">
                <h2 className="md:col-span-3 font-headline text-lg font-bold">{form.id ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới"}</h2>
                <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none md:col-span-2" placeholder="Tên sản phẩm *" value={form.name} onChange={(e) => updateField("name", e.target.value)} />
                <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none" placeholder="SKU" value={form.sku} onChange={(e) => updateField("sku", e.target.value)} />
                <select className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none" value={form.categoryId} onChange={(e) => updateField("categoryId", e.target.value)}>
                    <option value="">Chọn danh mục *</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none" value={form.regionId} onChange={(e) => updateField("regionId", e.target.value)}>
                    <option value="">Vùng miền</option>
                    {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none" type="number" min={0} placeholder="Giá bán" value={form.salePrice} onChange={(e) => updateField("salePrice", e.target.value)} />
                <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none" type="number" min={0} placeholder="Tồn kho" value={form.stockQuantity} onChange={(e) => updateField("stockQuantity", e.target.value)} />
                <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none" placeholder="Nguồn gốc" value={form.origin} onChange={(e) => updateField("origin", e.target.value)} />
                <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none md:col-span-3" placeholder="Mô tả ngắn" value={form.shortDescription} onChange={(e) => updateField("shortDescription", e.target.value)} />
                <div className="flex gap-2 md:col-span-3">
                    <button type="submit" className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary disabled:opacity-50" disabled={isSaving}>
                        {isSaving ? "Đang lưu..." : form.id ? "Cập nhật" : "Thêm sản phẩm"}
                    </button>
                    {form.id ? (
                        <button type="button" className="rounded-full border border-outline-variant/30 px-6 py-3 text-sm" onClick={() => setForm(emptyForm)}>
                            Hủy
                        </button>
                    ) : null}
                </div>
            </form>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
                <h2 className="font-headline text-lg font-bold">Danh sách sản phẩm ({products.length})</h2>
                {error ? <p className="mt-3 text-sm text-error">{error}</p> : null}
                {isLoading ? (
                    <p className="mt-3 text-sm text-on-surface-variant">Đang tải...</p>
                ) : products.length === 0 ? (
                    <p className="mt-3 text-sm text-on-surface-variant">Chưa có sản phẩm nào.</p>
                ) : (
                    <div className="mt-4 space-y-2">
                        {products.map((product) => (
                            <div key={product.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-container-low p-4">
                                <div>
                                    <p className="font-semibold text-on-surface">{product.name}</p>
                                    <p className="text-sm text-on-surface-variant">
                                        {product.sku ?? "—"} · {product.category?.name ?? "—"} · Tồn: {product.stock_quantity}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-semibold text-primary">{formatCurrency(Number(product.sale_price))}</span>
                                    <button type="button" className="rounded-full border border-outline-variant/30 px-4 py-2 text-sm" onClick={() => editProduct(product)}>
                                        Sửa
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
