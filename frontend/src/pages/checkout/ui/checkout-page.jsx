import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { routes } from "@/shared/config/routes";
import { formatCurrency } from "@/shared/lib/format";
import { useAccountStore } from "@/shared/lib/store/use-account-store";
import { useAuthStore } from "@/shared/lib/store/use-auth-store";
import { useCartStore } from "@/shared/lib/store/use-cart-store";
import { useCustomerOrdersStore } from "@/shared/lib/store/use-customer-orders-store";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { useStorefrontCatalogStore } from "@/shared/lib/store/use-storefront-catalog-store";
import { useVietnamLocationStore } from "@/shared/lib/store/use-vietnam-location-store";
import { Icon } from "@/shared/ui";
const paymentOptions = [
    {
        id: "COD",
        label: "Thanh toán khi nhận hàng",
        description: "Thanh toán bằng tiền mặt khi đơn hàng được giao thành công",
    },
    {
        id: "BANK_TRANSFER",
        label: "Chuyển khoản ngân hàng",
        description: "Admin sẽ xác nhận thanh toán trước khi xử lý đơn hàng",
    },
];
function getDefaultAddress(profile) {
    return profile.addresses.find((address) => address.isDefault) ?? profile.addresses[0];
}
function buildForm(profile) {
    const defaultAddress = getDefaultAddress(profile);
    const provinceName = defaultAddress?.ghnProvinceName ?? "";
    const districtName = defaultAddress?.ghnDistrictName ?? "";
    const wardName = defaultAddress?.ghnWardName ?? "";
    const line1 = defaultAddress?.line1 ?? profile.address;
    return {
        recipientName: defaultAddress?.recipient ?? profile.name,
        recipientPhone: defaultAddress?.phone ?? profile.phone,
        shippingLine1: line1,
        shippingAddress: [line1, wardName, districtName, provinceName || defaultAddress?.city || profile.city]
            .filter(Boolean)
            .join(", "),
        shippingProvinceId: defaultAddress?.ghnProvinceId ? String(defaultAddress.ghnProvinceId) : "",
        shippingProvinceName: provinceName,
        shippingDistrictId: defaultAddress?.ghnDistrictId ? String(defaultAddress.ghnDistrictId) : "",
        shippingDistrictName: districtName,
        shippingWardCode: defaultAddress?.ghnWardCode ?? "",
        shippingWardName: wardName,
        note: defaultAddress?.note ?? "",
    };
}
function normalizeVietnamese(value) {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/\u0111/g, "d")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d");
}
function isSameLocationName(left, right) {
    return normalizeVietnamese(left).trim() === normalizeVietnamese(right).trim();
}
function calculateShippingFee(subtotal, shippingAddress) {
    if (subtotal >= 500000) {
        return 0;
    }
    const normalizedAddress = normalizeVietnamese(shippingAddress);
    if (normalizedAddress.includes("ha noi")) {
        return 20000;
    }
    const northernKeywords = [
        "ha giang",
        "cao bang",
        "bac kan",
        "tuyen quang",
        "lao cai",
        "yen bai",
        "thai nguyen",
        "lang son",
        "quang ninh",
        "bac giang",
        "phu tho",
        "vinh phuc",
        "bac ninh",
        "hai duong",
        "hai phong",
        "hung yen",
        "thai binh",
        "ha nam",
        "nam dinh",
        "ninh binh",
        "hoa binh",
        "son la",
        "dien bien",
        "lai chau",
    ];
    if (northernKeywords.some((keyword) => normalizedAddress.includes(keyword))) {
        return 30000;
    }
    return 45000;
}
function hashText(input) {
    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
        hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
    }
    return hash;
}
function MockQrCode({ value }) {
    const size = 29;
    const cells = useMemo(() => {
        const base = hashText(value);
        const nextCells = [];
        for (let row = 0; row < size; row += 1) {
            for (let col = 0; col < size; col += 1) {
                const inTopLeft = row < 7 && col < 7;
                const inTopRight = row < 7 && col >= size - 7;
                const inBottomLeft = row >= size - 7 && col < 7;
                if (inTopLeft || inTopRight || inBottomLeft) {
                    const edge = row === 0 || row === 6 || col === 0 || col === 6;
                    const inner = row >= 2 && row <= 4 && col >= 2 && col <= 4;
                    nextCells.push(edge || inner);
                    continue;
                }
                const bit = ((base + row * 97 + col * 131 + row * col * 17) % 5) <= 1;
                nextCells.push(bit);
            }
        }
        return nextCells;
    }, [value]);
    return (<svg viewBox={`0 0 ${size} ${size}`} className="h-48 w-48 rounded-2xl bg-white p-3 shadow-sm">
            <rect x="0" y="0" width={size} height={size} fill="white"/>
            {cells.map((filled, index) => {
            if (!filled) {
                return null;
            }
            const x = index % size;
            const y = Math.floor(index / size);
            return <rect key={index} x={x} y={y} width="1" height="1" fill="#0f172a"/>;
        })}
        </svg>);
}
function paymentInstructionValue(payload, key) {
    const value = payload?.[key];
    return typeof value === "string" ? value : "";
}
function CopyButton({ onClick }) {
    return (<button className="inline-flex items-center gap-2 rounded-full border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700" onClick={onClick}>
            <Icon name="content_copy" className="text-sm"/>
            Sao chép
        </button>);
}
export function CheckoutPage() {
    const navigate = useNavigate();
    const session = useAuthStore((state) => state.session);
    const profile = useAccountStore((state) => state.profile);
    const updateProfile = useAccountStore((state) => state.updateProfile);
    const loadCart = useCartStore((state) => state.loadCart);
    const cart = useCartStore((state) => state.cart);
    const guestItems = useCartStore((state) => state.guestItems);
    const setQuantity = useCartStore((state) => state.setQuantity);
    const removeItem = useCartStore((state) => state.removeItem);
    const isCartLoading = useCartStore((state) => state.isLoading);
    const cartError = useCartStore((state) => state.error);
    const checkout = useCustomerOrdersStore((state) => state.checkout);
    const confirmBankTransferSubmitted = useCustomerOrdersStore((state) => state.confirmBankTransferSubmitted);
    const isSubmitting = useCustomerOrdersStore((state) => state.isSubmitting);
    const pushToast = useFeedbackStore((state) => state.pushToast);
    const products = useStorefrontCatalogStore((state) => state.products);
    const productDetails = useStorefrontCatalogStore((state) => state.productDetails);
    const provinces = useVietnamLocationStore((state) => state.provinces);
    const districtsByProvince = useVietnamLocationStore((state) => state.districtsByProvince);
    const wardsByDistrict = useVietnamLocationStore((state) => state.wardsByDistrict);
    const loadProvinces = useVietnamLocationStore((state) => state.loadProvinces);
    const loadDistricts = useVietnamLocationStore((state) => state.loadDistricts);
    const loadWards = useVietnamLocationStore((state) => state.loadWards);
    const isLoadingProvinces = useVietnamLocationStore((state) => state.isLoadingProvinces);
    const isLoadingDistricts = useVietnamLocationStore((state) => state.isLoadingDistricts);
    const isLoadingWards = useVietnamLocationStore((state) => state.isLoadingWards);
    const locationError = useVietnamLocationStore((state) => state.error);
    const [form, setForm] = useState(() => buildForm(profile));
    const [paymentMethod, setPaymentMethod] = useState("COD");
    const [submitError, setSubmitError] = useState("");
    const [createdBankTransferOrder, setCreatedBankTransferOrder] = useState(null);
    const [bankTransferMessage, setBankTransferMessage] = useState("");
    const districts = useMemo(() => {
        if (!form.shippingProvinceId) {
            return [];
        }

        return districtsByProvince[form.shippingProvinceId] ?? [];
    }, [districtsByProvince, form.shippingProvinceId]);
    const wards = useMemo(() => {
        if (!form.shippingDistrictId) {
            return [];
        }

        return wardsByDistrict[form.shippingDistrictId] ?? [];
    }, [form.shippingDistrictId, wardsByDistrict]);
    useEffect(() => {
        void loadCart();
    }, [loadCart]);
    useEffect(() => {
        void loadProvinces();
    }, [loadProvinces]);
    useEffect(() => {
        setForm(buildForm(profile));
    }, [profile]);
    useEffect(() => {
        if (!form.shippingProvinceId)
            return;
        void loadDistricts(Number(form.shippingProvinceId));
    }, [form.shippingProvinceId, loadDistricts]);
    useEffect(() => {
        if (!form.shippingDistrictId)
            return;
        void loadWards(Number(form.shippingDistrictId));
    }, [form.shippingDistrictId, loadWards]);
    useEffect(() => {
        if (!form.shippingProvinceName || provinces.length === 0) {
            return;
        }
        if (provinces.some((item) => String(item.code) === form.shippingProvinceId)) {
            return;
        }
        const matchedProvince = provinces.find((item) => isSameLocationName(item.name, form.shippingProvinceName));
        if (!matchedProvince) {
            return;
        }
        setForm((current) => ({
            ...current,
            shippingProvinceId: String(matchedProvince.code),
            shippingProvinceName: matchedProvince.name,
        }));
    }, [form.shippingProvinceId, form.shippingProvinceName, provinces]);
    useEffect(() => {
        if (!form.shippingDistrictName || districts.length === 0) {
            return;
        }
        if (districts.some((item) => String(item.code) === form.shippingDistrictId)) {
            return;
        }
        const matchedDistrict = districts.find((item) => isSameLocationName(item.name, form.shippingDistrictName));
        if (!matchedDistrict) {
            return;
        }
        setForm((current) => ({
            ...current,
            shippingDistrictId: String(matchedDistrict.code),
            shippingDistrictName: matchedDistrict.name,
        }));
    }, [districts, form.shippingDistrictId, form.shippingDistrictName]);
    useEffect(() => {
        if (!form.shippingWardName || wards.length === 0) {
            return;
        }
        if (wards.some((item) => String(item.code) === form.shippingWardCode)) {
            return;
        }
        const matchedWard = wards.find((item) => isSameLocationName(item.name, form.shippingWardName));
        if (!matchedWard) {
            return;
        }
        setForm((current) => ({
            ...current,
            shippingWardCode: String(matchedWard.code),
            shippingWardName: matchedWard.name,
        }));
    }, [form.shippingWardCode, form.shippingWardName, wards]);
    const guestCartItems = guestItems.map((item) => {
        const product = productDetails[item.productId] ?? products.find((entry) => entry.id === item.productId);
        return {
            id: `guest-${item.productId}`,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: product?.price ?? 0,
            product: {
                name: product?.name ?? `Sản phẩm #${item.productId}`,
                image: product?.image ?? "https://placehold.co/192x192?text=Product",
                stockQuantity: product?.stockQuantity,
            },
        };
    });
    const cartItems = cart?.items ?? guestCartItems;
    const subtotal = cart?.subtotal ??
        guestCartItems.reduce((totalValue, item) => totalValue + item.unitPrice * item.quantity, 0);
    const fullShippingAddress = [
        form.shippingLine1,
        form.shippingWardName,
        form.shippingDistrictName,
        form.shippingProvinceName,
    ]
        .filter(Boolean)
        .join(", ");
    const hasShippingAddress = fullShippingAddress.trim().length > 0;
    const shippingFee = hasShippingAddress ? calculateShippingFee(subtotal, fullShippingAddress) : null;
    const discount = 0;
    const total = subtotal + (shippingFee ?? 0) - discount;
    const bankTransferPayload = createdBankTransferOrder?.payment?.rawPayload ?? null;
    const bankName = paymentInstructionValue(bankTransferPayload, "bank_name") || "MB Bank";
    const accountName = paymentInstructionValue(bankTransferPayload, "account_name") || "HERITAGE HARVEST";
    const accountNumber = paymentInstructionValue(bankTransferPayload, "account_number") || "0123456789";
    const transferContent = paymentInstructionValue(bankTransferPayload, "transfer_content") ||
        createdBankTransferOrder?.orderNo ||
        "";
    const qrValue = useMemo(() => {
        if (!createdBankTransferOrder) {
            return "";
        }
        return JSON.stringify({
            bankName,
            accountName,
            accountNumber,
            amount: createdBankTransferOrder.totalAmount,
            orderNo: createdBankTransferOrder.orderNo,
        });
    }, [accountName, accountNumber, bankName, createdBankTransferOrder]);
    function updateField(key, value) {
        setForm((current) => ({
            ...current,
            [key]: value,
        }));
    }
    async function handleCopy(value) {
        try {
            await navigator.clipboard.writeText(value);
            pushToast({
                tone: "success",
                message: "Đã sao chép",
            });
        }
        catch {
            pushToast({
                tone: "warning",
                message: "Không thể sao chép lúc này",
            });
        }
    }
    async function handlePlaceOrder() {
        setSubmitError("");
        if (!session) {
            void navigate(`${routes.login}?redirect=${encodeURIComponent(routes.checkout)}`);
            return;
        }
        if (!form.recipientName.trim() ||
            !form.recipientPhone.trim() ||
            !form.shippingLine1.trim() ||
            !form.shippingProvinceId ||
            !form.shippingDistrictId ||
            !form.shippingWardCode) {
            setSubmitError("Vui lòng hoàn tất đầy đủ thông tin nhận hàng trước khi đặt đơn.");
            return;
        }
        const insufficientItem = cartItems.find((item) => item.product.stockQuantity !== undefined && item.quantity > item.product.stockQuantity);
        if (insufficientItem) {
            setSubmitError(`Sản phẩm ${insufficientItem.product.name} chỉ còn ${insufficientItem.product.stockQuantity}, không đủ cho số lượng ${insufficientItem.quantity}.`);
            return;
        }
        const result = await checkout({
            recipient_name: form.recipientName.trim(),
            recipient_phone: form.recipientPhone.trim(),
            shipping_address: fullShippingAddress.trim(),
            shipping_line1: form.shippingLine1.trim(),
            shipping_province_id: Number(form.shippingProvinceId),
            shipping_province_name: form.shippingProvinceName,
            shipping_district_id: Number(form.shippingDistrictId),
            shipping_district_name: form.shippingDistrictName,
            shipping_ward_code: form.shippingWardCode,
            shipping_ward_name: form.shippingWardName,
            note: form.note.trim(),
            payment_method: paymentMethod,
            payment_gateway: paymentMethod === "BANK_TRANSFER" ? "Manual bank transfer" : undefined,
        });
        if (!result.success || !result.data) {
            setSubmitError(result.error ?? "Không thể hoàn tất đơn hàng.");
            return;
        }
        updateProfile({
            name: form.recipientName.trim(),
            phone: form.recipientPhone.trim(),
            address: fullShippingAddress.trim(),
            city: form.shippingProvinceName,
        });
        await loadCart();
        if (paymentMethod === "BANK_TRANSFER") {
            setCreatedBankTransferOrder(result.data);
            setBankTransferMessage("");
            return;
        }
        void navigate(routes.orderSuccess(result.data.id));
    }
    async function handleConfirmTransferSubmitted() {
        if (!createdBankTransferOrder) {
            return;
        }
        const result = await confirmBankTransferSubmitted(createdBankTransferOrder.id);
        if (!result.success) {
            setBankTransferMessage(result.error ?? "Không thể gửi xác nhận chuyển khoản.");
            return;
        }
        pushToast({
            tone: "success",
            message: "Cảm ơn bạn. Admin sẽ kiểm tra giao dịch và xác nhận thanh toán.",
        });
        void navigate(routes.accountOrderDetail(createdBankTransferOrder.id));
    }
    function closeBankTransferModal() {
        if (!createdBankTransferOrder) {
            return;
        }
        void navigate(routes.accountOrderDetail(createdBankTransferOrder.id));
    }
    return (<div className="mx-auto max-w-screen-2xl px-6 pb-20 pt-24">
            <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] xl:items-start">
                <div className="space-y-10">
                    <section>
                        <div className="mb-8 flex items-baseline justify-between">
                            <h1 className="font-headline text-2xl font-semibold tracking-tight">Giỏ hàng của bạn</h1>
                            <span className="text-sm text-zinc-500">
                                {cart?.itemCount ??
            cartItems.reduce((totalValue, item) => totalValue + item.quantity, 0)}{" "}
                                mặt hàng
                            </span>
                        </div>

                        <div className="space-y-6">
                            {cartItems.length === 0 ? (<div className="rounded-xl bg-surface-container-lowest p-10 text-center">
                                    <p className="text-on-surface-variant">
                                        {isCartLoading ? "Đang tải giỏ hàng..." : cartError ?? "Chưa có sản phẩm nào trong giỏ."}
                                    </p>
                                    <Link className="mt-4 inline-block text-primary hover:underline" to={routes.products}>
                                        Quay lại mua sắm
                                    </Link>
                                </div>) : (cartItems.map((item) => (<article key={item.id} className="flex items-center gap-6 rounded-xl bg-surface-container-lowest p-6">
                                        <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-surface-container">
                                            <img src={item.product.image} alt={item.product.name} className="h-full w-full object-cover"/>
                                        </div>
                                        <div className="flex-grow">
                                            <div className="flex justify-between gap-4">
                                                <div>
                                                    <h3 className="font-headline text-lg font-semibold">{item.product.name}</h3>
                                                    <p className="mt-1 font-semibold text-primary">
                                                        {formatCurrency(item.unitPrice)}
                                                    </p>
                                                </div>
                                                <button className="text-zinc-400 transition-colors hover:text-error" onClick={() => void removeItem(item.productId)} aria-label={`Xóa ${item.product.name}`}>
                                                    <Icon name="delete"/>
                                                </button>
                                            </div>
                                            <div className="mt-4 flex items-center justify-between gap-4">
                                                <div className="flex items-center rounded-full bg-surface-container px-2 py-1">
                                                    <button className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white" onClick={() => void setQuantity(item.productId, Math.max(1, item.quantity - 1))} aria-label={`Giảm số lượng ${item.product.name}`}>
                                                        <Icon name="remove" className="text-sm"/>
                                                    </button>
                                                    <span className="px-4 text-sm font-medium">{item.quantity}</span>
                                                    <button className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white" onClick={() => {
                const maxQuantity = item.product.stockQuantity ?? item.quantity;
                if (item.quantity >= maxQuantity) {
                    pushToast({
                        tone: "warning",
                        message: "Số lượng vượt quá tồn kho hiện có.",
                    });
                    return;
                }
                void setQuantity(item.productId, item.quantity + 1);
            }} aria-label={`Tăng số lượng ${item.product.name}`}>
                                                        <Icon name="add" className="text-sm"/>
                                                    </button>
                                                </div>
                                                <span className="rounded-full bg-secondary-fixed px-3 py-1 text-xs text-secondary">
                                                    Cập nhật đơn
                                                </span>
                                            </div>
                                        </div>
                                    </article>)))}
                        </div>
                    </section>

                    <section className="space-y-8">
                        <div className="flex flex-wrap items-end justify-between gap-4">
                            <h2 className="font-headline text-2xl font-semibold">Thông tin nhận hàng</h2>
                            <Link className="text-sm font-medium text-primary hover:underline" to={routes.accountAddresses}>
                                Sổ địa chỉ
                            </Link>
                        </div>

                        <div className="rounded-2xl bg-surface-container-lowest p-8 shadow-sm ring-1 ring-black/5">
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div className="space-y-2">
                                    <label className="text-xs uppercase tracking-widest text-on-surface-variant">
                                        Người nhận
                                    </label>
                                    <input className="w-full rounded-xl border-b-2 border-transparent bg-surface-container-highest px-4 py-3 outline-none transition-all focus:border-primary focus:ring-0" value={form.recipientName} onChange={(event) => updateField("recipientName", event.target.value)}/>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs uppercase tracking-widest text-on-surface-variant">
                                        Số điện thoại
                                    </label>
                                    <input className="w-full rounded-xl border-b-2 border-transparent bg-surface-container-highest px-4 py-3 outline-none transition-all focus:border-primary focus:ring-0" value={form.recipientPhone} onChange={(event) => updateField("recipientPhone", event.target.value)}/>
                                </div>
                            </div>

                            <div className="mt-6 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs uppercase tracking-widest text-on-surface-variant">
                                        Dia chi chi tiet
                                    </label>
                                    <input className="w-full rounded-xl border-b-2 border-transparent bg-surface-container-highest px-4 py-3 outline-none transition-all focus:border-primary focus:ring-0" value={form.shippingLine1} onChange={(event) => updateField("shippingLine1", event.target.value)}/>
                                </div>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                    <label className="space-y-2">
                                        <span className="block text-xs uppercase tracking-widest text-on-surface-variant">
                                            Tinh/thanh
                                        </span>
                                        <select className="w-full rounded-xl border-b-2 border-transparent bg-surface-container-highest px-4 py-3 outline-none transition-all focus:border-primary focus:ring-0" value={form.shippingProvinceId} onChange={(event) => {
            const province = provinces.find((item) => String(item.code) === event.target.value);
            setForm((current) => ({
                ...current,
                shippingProvinceId: event.target.value,
                shippingProvinceName: province?.name ?? "",
                shippingDistrictId: "",
                shippingDistrictName: "",
                shippingWardCode: "",
                shippingWardName: "",
            }));
        }}>
                                            <option value="">
                                                {isLoadingProvinces ? "Dang tai tinh/thanh..." : "Chon tinh/thanh"}
                                            </option>
                                            {provinces.map((province) => (<option key={province.code} value={province.code}>
                                                    {province.name}
                                                </option>))}
                                        </select>
                                    </label>
                                    <label className="space-y-2">
                                        <span className="block text-xs uppercase tracking-widest text-on-surface-variant">
                                            Quan/huyen
                                        </span>
                                        <select className="w-full rounded-xl border-b-2 border-transparent bg-surface-container-highest px-4 py-3 outline-none transition-all focus:border-primary focus:ring-0" value={form.shippingDistrictId} disabled={!form.shippingProvinceId} onChange={(event) => {
            const district = districts.find((item) => String(item.code) === event.target.value);
            setForm((current) => ({
                ...current,
                shippingDistrictId: event.target.value,
                shippingDistrictName: district?.name ?? "",
                shippingWardCode: "",
                shippingWardName: "",
            }));
        }}>
                                            <option value="">
                                                {isLoadingDistricts ? "Dang tai quan/huyen..." : "Chon quan/huyen"}
                                            </option>
                                            {districts.map((district) => (<option key={district.code} value={district.code}>
                                                    {district.name}
                                                </option>))}
                                        </select>
                                    </label>
                                    <label className="space-y-2">
                                        <span className="block text-xs uppercase tracking-widest text-on-surface-variant">
                                            Phuong/xa
                                        </span>
                                        <select className="w-full rounded-xl border-b-2 border-transparent bg-surface-container-highest px-4 py-3 outline-none transition-all focus:border-primary focus:ring-0" value={form.shippingWardCode} disabled={!form.shippingDistrictId} onChange={(event) => {
            const ward = wards.find((item) => String(item.code) === event.target.value);
            setForm((current) => ({
                ...current,
                shippingWardCode: event.target.value,
                shippingWardName: ward?.name ?? "",
            }));
        }}>
                                            <option value="">
                                                {isLoadingWards ? "Dang tai phuong/xa..." : "Chon phuong/xa"}
                                            </option>
                                            {wards.map((ward) => (<option key={ward.code} value={ward.code}>
                                                    {ward.name}
                                                </option>))}
                                        </select>
                                    </label>
                                </div>
                                <div className="rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
                                    {fullShippingAddress || "Dia chi day du se hien thi sau khi chon khu vuc."}
                                </div>
                                {locationError ? <p className="mt-3 text-sm text-error">{locationError}</p> : null}
                            </div>

                            <div className="mt-6 space-y-2">
                                <label className="text-xs uppercase tracking-widest text-on-surface-variant">
                                    Ghi chú
                                </label>
                                <textarea className="min-h-24 w-full rounded-xl border-b-2 border-transparent bg-surface-container-highest px-4 py-3 outline-none transition-all focus:border-primary focus:ring-0" value={form.note} onChange={(event) => updateField("note", event.target.value)}/>
                            </div>

                            <div className="mt-8 space-y-4">
                                <h3 className="font-headline text-xl font-semibold">Phương thức thanh toán</h3>
                                <div className="space-y-3">
                                    {paymentOptions.map((option) => (<label key={option.id} className={`block cursor-pointer rounded-xl border px-4 py-4 transition ${paymentMethod === option.id
                ? "border-primary bg-primary/5"
                : "border-outline-variant/20 bg-surface-container-low"}`}>
                                            <div className="flex items-start gap-3">
                                                <input type="radio" name="paymentMethod" checked={paymentMethod === option.id} onChange={() => setPaymentMethod(option.id)} className="mt-1"/>
                                                <div>
                                                    <p className="font-semibold text-on-surface">{option.label}</p>
                                                    <p className="mt-1 text-sm text-on-surface-variant">
                                                        {option.description}
                                                    </p>
                                                </div>
                                            </div>
                                        </label>))}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <aside className="xl:sticky xl:top-24">
                    <section className="rounded-2xl bg-surface-container-lowest p-8 shadow-sm ring-1 ring-black/5">
                        <h2 className="font-headline text-2xl font-semibold">Tóm tắt đơn hàng</h2>

                        <div className="mt-6 space-y-4 text-sm">
                            <div className="flex justify-between">
                                <span className="text-on-surface-variant">Tạm tính</span>
                                <span>{formatCurrency(subtotal)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-on-surface-variant">Vận chuyển</span>
                                <span>
                                    {shippingFee === null
            ? "Nhập địa chỉ để tính phí vận chuyển"
            : formatCurrency(shippingFee)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-on-surface-variant">Giảm giá</span>
                                <span>-{formatCurrency(discount)}</span>
                            </div>
                            <div className="h-px bg-outline-variant/20"/>
                            <div className="flex justify-between font-headline text-2xl font-bold">
                                <span>{shippingFee === null ? "Tổng tạm tính" : "Tổng cộng"}</span>
                                <span>{formatCurrency(total)}</span>
                            </div>
                        </div>

                        {shippingFee === null ? (<div className="mt-4 rounded-2xl bg-surface-container-low px-4 py-4 text-sm text-on-surface-variant">
                                Phí vận chuyển sẽ được tính sau khi nhập địa chỉ.
                            </div>) : null}

                        {submitError ? (<div className="mt-4 rounded-xl border border-error/20 bg-error-container/60 px-4 py-3 text-sm text-error">
                                {submitError}
                            </div>) : null}

                        <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-4 font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50" disabled={cartItems.length === 0 || isSubmitting} onClick={() => void handlePlaceOrder()}>
                            <span>
                                {session
            ? isSubmitting
                ? "Đang đặt hàng..."
                : "Đặt hàng"
            : "Đăng nhập để đặt hàng"}
                            </span>
                            <Icon name="arrow_forward"/>
                        </button>
                    </section>
                </aside>
            </div>

            {createdBankTransferOrder ? (<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-4">
                    <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[1.5rem] border border-emerald-100 bg-white p-5 shadow-2xl">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 text-center">
                                <h2 className="font-headline text-2xl font-bold text-slate-900">
                                    Thông tin chuyển khoản
                                </h2>
                            </div>
                            <button className="rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700" onClick={closeBankTransferModal}>
                                Đóng
                            </button>
                        </div>

                        <div className="mt-5 grid gap-4 md:grid-cols-[1.08fr_0.92fr]">
                            <div className="space-y-3 rounded-[1.25rem] border border-emerald-200 bg-emerald-100/90 p-4">
                                <div className="rounded-2xl bg-white/95 px-4 py-4 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm text-slate-700">Ngân hàng</p>
                                            <p className="mt-1 font-semibold text-slate-950">{bankName}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-2xl bg-white/95 px-4 py-4 shadow-sm">
                                    <p className="text-sm text-slate-700">Chủ tài khoản</p>
                                    <p className="mt-1 font-semibold text-slate-950">{accountName}</p>
                                </div>
                                <div className="rounded-2xl bg-white/95 px-4 py-4 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm text-slate-700">Số tài khoản</p>
                                            <p className="mt-1 font-semibold text-slate-950">{accountNumber}</p>
                                        </div>
                                        <CopyButton onClick={() => void handleCopy(accountNumber)}/>
                                    </div>
                                </div>
                                <div className="rounded-2xl bg-white/95 px-4 py-4 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm text-slate-700">Số tiền cần chuyển</p>
                                            <p className="mt-1 font-semibold text-slate-950">
                                                {formatCurrency(createdBankTransferOrder.totalAmount)}
                                            </p>
                                        </div>
                                        <CopyButton onClick={() => void handleCopy(String(createdBankTransferOrder.totalAmount))}/>
                                    </div>
                                </div>
                                <div className="rounded-2xl bg-white/95 px-4 py-4 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm text-slate-700">Nội dung chuyển khoản</p>
                                            <p className="mt-1 font-semibold text-slate-950">{transferContent}</p>
                                        </div>
                                        <CopyButton onClick={() => void handleCopy(transferContent)}/>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50/80 p-4">
                                <div className="flex h-full flex-col items-center justify-center">
                                    <MockQrCode value={qrValue}/>
                                    <p className="mt-4 text-center text-xs text-slate-700">
                                        QR mô phỏng theo từng đơn hàng.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            Vui lòng chuyển đúng số tiền và nội dung chuyển khoản để đơn hàng được xử lý nhanh chóng.
                        </div>

                        <div className="mt-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                            Đơn hàng sẽ được xử lý sau khi admin xác nhận đã nhận được chuyển khoản của bạn.
                        </div>

                        {bankTransferMessage ? (<div className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                                {bankTransferMessage}
                            </div>) : null}

                        <div className="mt-5 flex flex-wrap justify-center gap-3">
                            <button className="rounded-full border border-slate-200 px-5 py-3 text-sm font-medium text-slate-700" onClick={closeBankTransferModal}>
                                Xem đơn hàng sau
                            </button>
                            <button className="rounded-full bg-emerald-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={isSubmitting} onClick={() => void handleConfirmTransferSubmitted()}>
                                {isSubmitting ? "Đang gửi..." : "Tôi đã chuyển khoản"}
                            </button>
                        </div>
                    </div>
                </div>) : null}
        </div>);
}
