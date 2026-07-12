import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { apiRequest, buildApiUrl } from "@/shared/api/backend-client";
import { routes } from "@/shared/config/routes";
import { Button, SurfaceCard } from "@/shared/ui";

const emptyForm = {
    name: "",
    contactName: "",
    phone: "",
    email: "",
    address: "",
    regionId: "",
    categoryId: "",
    note: "",
    password: "",
    passwordConfirmation: "",
};

export function SupplierRegisterPage() {
    const [form, setForm] = useState(emptyForm);
    const [licenseFile, setLicenseFile] = useState(null);
    const [regions, setRegions] = useState([]);
    const [categories, setCategories] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    useEffect(() => {
        void apiRequest("/regions").then((response) => setRegions(response.regions ?? [])).catch(() => {});
        void apiRequest("/categories").then((response) => setCategories(response.categories ?? [])).catch(() => {});
    }, []);

    function updateField(key, value) {
        setForm((current) => ({ ...current, [key]: value }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (!form.name.trim() || !form.contactName.trim() || !form.phone.trim() || !form.email.trim() || !form.address.trim()) {
            setError("Vui lòng nhập đầy đủ các trường bắt buộc (*).");
            return;
        }
        if (form.password.length < 8) {
            setError("Mật khẩu cần tối thiểu 8 ký tự.");
            return;
        }
        if (form.password !== form.passwordConfirmation) {
            setError("Mật khẩu xác nhận chưa khớp.");
            return;
        }
        setError("");
        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append("name", form.name.trim());
            formData.append("contact_name", form.contactName.trim());
            formData.append("phone", form.phone.trim());
            formData.append("email", form.email.trim());
            formData.append("address", form.address.trim());
            if (form.regionId) formData.append("region_id", form.regionId);
            if (form.categoryId) formData.append("category_id", form.categoryId);
            if (form.note.trim()) formData.append("note", form.note.trim());
            formData.append("password", form.password);
            formData.append("password_confirmation", form.passwordConfirmation);
            if (licenseFile) formData.append("license_file", licenseFile);

            const response = await axios.post(buildApiUrl("/suppliers/apply"), formData);
            setSuccessMessage(response.data.message ?? "Đăng ký thành công, vui lòng chờ Admin xét duyệt.");
            setForm(emptyForm);
            setLicenseFile(null);
        } catch (submitError) {
            const message = axios.isAxiosError(submitError)
                ? submitError.response?.data?.message ?? submitError.message
                : "Không thể gửi đăng ký lúc này.";
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="mx-auto max-w-2xl px-6 py-16">
            <SurfaceCard tone="low" className="space-y-6">
                <div className="text-center">
                    <p className="text-xs uppercase tracking-widest text-primary">Đăng ký Nhà cung cấp</p>
                    <h1 className="mt-2 font-headline text-2xl font-bold text-on-surface">
                        Trở thành đối tác cung cấp đặc sản vùng miền
                    </h1>
                    <p className="mt-2 text-sm text-on-surface-variant">
                        Điền hồ sơ bên dưới, đội ngũ Admin sẽ xét duyệt và phản hồi qua email/thông báo trong hệ thống.
                    </p>
                </div>

                {successMessage ? (
                    <div className="space-y-4 text-center">
                        <p className="rounded-2xl bg-surface-container-highest p-4 text-sm text-on-surface">
                            {successMessage}
                        </p>
                        <Link to={routes.login} className="font-semibold text-primary hover:underline">
                            Quay lại đăng nhập
                        </Link>
                    </div>
                ) : (
                    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15 md:col-span-2" placeholder="Tên nhà cung cấp / cơ sở sản xuất *" value={form.name} onChange={(event) => updateField("name", event.target.value)} />
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" placeholder="Người liên hệ *" value={form.contactName} onChange={(event) => updateField("contactName", event.target.value)} />
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" placeholder="Số điện thoại *" value={form.phone} onChange={(event) => updateField("phone", event.target.value)} />
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" placeholder="Email *" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} />
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" placeholder="Địa chỉ *" value={form.address} onChange={(event) => updateField("address", event.target.value)} />
                        <select className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none" value={form.regionId} onChange={(event) => updateField("regionId", event.target.value)}>
                            <option value="">Vùng miền đặc sản</option>
                            {regions.map((region) => (
                                <option key={region.id} value={region.id}>{region.name}</option>
                            ))}
                        </select>
                        <select className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none" value={form.categoryId} onChange={(event) => updateField("categoryId", event.target.value)}>
                            <option value="">Danh mục sản phẩm dự kiến</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                        </select>
                        <label className="block space-y-2 text-sm md:col-span-2">
                            <span className="font-medium text-on-surface">Giấy phép kinh doanh / Giấy chứng nhận ATTP (PDF/JPG/PNG, tối đa 5MB)</span>
                            <input className="w-full rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setLicenseFile(event.target.files?.[0] ?? null)} />
                        </label>
                        <textarea className="min-h-24 w-full resize-none rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15 md:col-span-2" placeholder="Ghi chú" value={form.note} onChange={(event) => updateField("note", event.target.value)} />
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" placeholder="Mật khẩu (dùng để đăng nhập khi được duyệt) *" type="password" value={form.password} onChange={(event) => updateField("password", event.target.value)} />
                        <input className="rounded-2xl bg-surface-container-highest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" placeholder="Xác nhận mật khẩu *" type="password" value={form.passwordConfirmation} onChange={(event) => updateField("passwordConfirmation", event.target.value)} />

                        {error ? <p className="text-sm text-error md:col-span-2">{error}</p> : null}

                        <Button className="md:col-span-2" type="submit" disabled={isSubmitting}>
                            {isSubmitting ? "Đang gửi đăng ký..." : "Gửi đăng ký"}
                        </Button>
                    </form>
                )}
            </SurfaceCard>
        </div>
    );
}
