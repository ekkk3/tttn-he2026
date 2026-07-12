import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { routes } from "@/shared/config/routes";
import { cn } from "@/shared/lib/cn";
import { formatCurrency } from "@/shared/lib/format";
import { stockStatusLabels } from "@/shared/lib/labels";
import { useCartStore } from "@/shared/lib/store/use-cart-store";
import { useShopStore } from "@/shared/lib/store/use-shop-store";
import { useStorefrontCatalogStore } from "@/shared/lib/store/use-storefront-catalog-store";
import { Icon } from "@/shared/ui";
const tabLabels = {
    details: "Thông tin chi tiết",
    reviews: "Đánh giá khách hàng",
    brewing: "Hướng dẫn sử dụng",
};
export function ProductDetailPage() {
    const navigate = useNavigate();
    const { slug } = useParams();
    const addItem = useCartStore((state) => state.addItem);
    const wishlistIds = useShopStore((state) => state.wishlistIds);
    const toggleWishlist = useShopStore((state) => state.toggleWishlist);
    const addRecentlyViewed = useShopStore((state) => state.addRecentlyViewed);
    const products = useStorefrontCatalogStore((state) => state.products);
    const productDetails = useStorefrontCatalogStore((state) => state.productDetails);
    const status = useStorefrontCatalogStore((state) => state.status);
    const error = useStorefrontCatalogStore((state) => state.error);
    const loadCatalog = useStorefrontCatalogStore((state) => state.loadCatalog);
    const loadProductById = useStorefrontCatalogStore((state) => state.loadProductById);
    const productIdFromSlug = useMemo(() => {
        if (!slug)
            return null;
        const segments = slug.split("-");
        const productId = segments[segments.length - 1];
        return productId && /^\d+$/.test(productId) ? productId : null;
    }, [slug]);
    const productFromCatalog = products.find((item) => item.slug === slug);
    const product = productFromCatalog
        ? (productDetails[productFromCatalog.id] ?? productFromCatalog)
        : undefined;
    const [quantity, setQuantity] = useState(1);
    const [activeMediaIndex, setActiveMediaIndex] = useState(0);
    const [activeTab, setActiveTab] = useState("details");
    const relatedProducts = useMemo(() => {
        if (!product)
            return [];
        const sameCategory = products.filter((item) => item.id !== product.id && item.categoryId === product.categoryId);
        const fallbackProducts = products.filter((item) => item.id !== product.id && !sameCategory.some((candidate) => candidate.id === item.id));
        return [...sameCategory, ...fallbackProducts].slice(0, 4);
    }, [product, products]);
    useEffect(() => {
        void loadCatalog();
    }, [loadCatalog]);
    useEffect(() => {
        if (!productIdFromSlug) {
            return;
        }
        void loadProductById(productIdFromSlug);
    }, [loadProductById, productIdFromSlug]);
    useEffect(() => {
        if (!product?.id) {
            return;
        }
        addRecentlyViewed(product.id);
        setQuantity(1);
        setActiveMediaIndex(0);
        setActiveTab("details");
    }, [addRecentlyViewed, product?.id]);
    useEffect(() => {
        if (!product) {
            return;
        }
        const currentMaxAvailableQuantity = Math.max(1, product.stockQuantity ?? 0);
        setQuantity((value) => Math.min(Math.max(1, value), currentMaxAvailableQuantity));
    }, [product]);
    if (!product && status === "ready") {
        return <Navigate replace to={routes.products}/>;
    }
    if (!product && status === "error") {
        return (<div className="mx-auto max-w-6xl px-6 pb-16 pt-24">
                <div className="rounded-2xl bg-surface-container-low p-10 text-center text-on-surface-variant">
                    {error ?? "Không thể tải chi tiết sản phẩm."}
                </div>
            </div>);
    }
    if (!product) {
        return (<div className="mx-auto max-w-6xl px-6 pb-16 pt-24">
                <div className="rounded-2xl bg-surface-container-low p-10 text-center text-on-surface-variant">
                    Đang tải chi tiết sản phẩm...
                </div>
            </div>);
    }
    const currentProduct = product;
    const isWishlisted = wishlistIds.includes(currentProduct.id);
    const activeMedia = currentProduct.gallery[activeMediaIndex] ?? currentProduct.gallery[0];
    const currentStockQuantity = currentProduct.stockQuantity ?? 0;
    const isOutOfStock = currentStockQuantity <= 0;
    const maxAvailableQuantity = Math.max(1, currentStockQuantity);
    const lowStockLabel = currentStockQuantity > 0 && currentStockQuantity <= 5
        ? `Chỉ còn ${currentProduct.stockQuantity} sản phẩm`
        : null;
    async function handleAddToCart(redirectToCheckout = false) {
        if (isOutOfStock) {
            return;
        }
        const result = await addItem(currentProduct.id, quantity);
        if (!result.success) {
            return;
        }
        if (redirectToCheckout) {
            void navigate(routes.checkout);
        }
    }
    return (<div className="mx-auto max-w-screen-2xl px-6 pb-16 pt-24">
            <nav className="mb-8 flex items-center space-x-2 text-xs uppercase tracking-widest text-on-surface-variant/60">
                <Link className="transition-colors hover:text-primary" to={routes.home}>
                    Trang chủ
                </Link>
                <Icon name="chevron_right" className="text-sm"/>
                <Link className="transition-colors hover:text-primary" to={routes.products}>
                    Cửa hàng
                </Link>
                <Icon name="chevron_right" className="text-sm"/>
                <span className="font-semibold text-on-surface">{currentProduct.name}</span>
            </nav>

            <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-12">
                <div className="space-y-4 lg:col-span-7">
                    <div className="aspect-[4/3] overflow-hidden rounded-xl bg-surface-container">
                        <img src={activeMedia.src} alt={activeMedia.alt} className="h-full w-full object-cover"/>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                        {currentProduct.gallery.map((media, index) => (<button key={`${media.src}-${index}`} type="button" className={cn("aspect-square overflow-hidden rounded-xl transition-opacity", index === activeMediaIndex
                ? "border-2 border-primary"
                : "opacity-70 hover:opacity-100")} onClick={() => setActiveMediaIndex(index)} aria-label={`Xem ảnh ${index + 1} của ${currentProduct.name}`}>
                                <img src={media.src} alt={media.alt} className="h-full w-full object-cover"/>
                            </button>))}
                    </div>
                </div>

                <div className="space-y-8 lg:col-span-5">
                    <header className="space-y-3">
                        <div className="flex items-center gap-3">
                            <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                                {currentProduct.badge ?? "Đặc sản"}
                            </span>
                            <button type="button" className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all", isWishlisted
            ? "border-error bg-error-container text-error"
            : "border-outline-variant/20 text-on-surface-variant hover:text-primary")} onClick={() => {
            toggleWishlist(currentProduct.id);
        }}>
                                <Icon name="favorite" fill={isWishlisted}/>
                                <span>{isWishlisted ? "Đã yêu thích" : "Lưu sản phẩm"}</span>
                            </button>
                        </div>
                        <h1 className="font-headline text-3xl font-bold leading-tight tracking-tight text-on-surface">
                            {currentProduct.detailTitle}
                        </h1>
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center text-tertiary">
                                {Array.from({ length: Math.floor(currentProduct.rating) }).map((_, index) => (<Icon key={index} name="star" className="text-sm" fill/>))}
                                <span className="ml-2 text-sm font-medium text-on-surface-variant">
                                    {currentProduct.rating.toFixed(1)} ({currentProduct.reviewCount} đánh giá)
                                </span>
                            </div>
                        </div>
                        <p className="pt-2 font-headline text-2xl font-bold text-primary">
                            {formatCurrency(currentProduct.price)}
                        </p>
                    </header>

                    <div className="grid grid-cols-2 gap-y-4 border-y border-outline-variant/15 py-6 text-sm">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs uppercase tracking-wider text-on-surface-variant">
                                Nhà cung cấp
                            </span>
                            <span className="font-medium">{currentProduct.regionName}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs uppercase tracking-wider text-on-surface-variant">
                                SKU / Tag
                            </span>
                            <span className="font-medium">{currentProduct.tag}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs uppercase tracking-wider text-on-surface-variant">
                                Trạng thái
                            </span>
                            <span className="font-medium">
                                {stockStatusLabels[currentProduct.stockStatus]}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs uppercase tracking-wider text-on-surface-variant">
                                Mô tả nhanh
                            </span>
                            <span className="font-medium">{currentProduct.subtitle}</span>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <p className={cn("text-sm font-medium", isOutOfStock ? "text-error" : lowStockLabel ? "text-amber-700" : "text-on-surface-variant")}>
                            {isOutOfStock ? "Hết hàng" : lowStockLabel ?? `Còn ${currentProduct.stockQuantity} sản phẩm`}
                        </p>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center rounded-full border border-outline-variant/20 bg-surface-container-low px-4 py-2">
                                <button type="button" className="flex h-8 w-8 items-center justify-center hover:text-primary" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Giảm số lượng">
                                    <Icon name="remove"/>
                                </button>
                                <input className="w-12 border-none bg-transparent text-center font-bold outline-none" type="text" value={quantity} readOnly/>
                                <button type="button" className="flex h-8 w-8 items-center justify-center hover:text-primary" onClick={() => setQuantity((value) => Math.min(maxAvailableQuantity, value + 1))} aria-label="Tăng số lượng">
                                    <Icon name="add"/>
                                </button>
                            </div>
                            <button type="button" className="flex-1 rounded-full border border-secondary px-6 py-4 font-bold text-secondary transition-all hover:bg-secondary hover:text-white" onClick={() => void handleAddToCart(false)}>
                                Thêm vào giỏ
                            </button>
                        </div>
                        <button type="button" className="w-full rounded-full bg-primary-glow px-6 py-4 font-bold text-white shadow-lg shadow-primary/20 transition-transform active:scale-95" onClick={() => void handleAddToCart(true)}>
                            Mua ngay
                        </button>
                    </div>

                    <div className="flex items-start gap-4 rounded-xl bg-surface-container-low p-4">
                        <Icon name="local_shipping" className="text-primary"/>
                        <div className="text-sm">
                            <p className="font-bold">{currentProduct.shippingNotice.title}</p>
                            <p className="text-on-surface-variant">
                                {currentProduct.shippingNotice.description}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <section className="mt-20">
                <div className="mb-10 flex gap-12 overflow-x-auto border-b border-outline-variant/15 no-scrollbar">
                    {Object.keys(tabLabels).map((tab) => (<button key={tab} type="button" className={cn("whitespace-nowrap pb-4 font-medium transition-colors", activeTab === tab
                ? "border-b-2 border-primary font-bold text-primary"
                : "text-on-surface-variant hover:text-primary")} onClick={() => setActiveTab(tab)}>
                            {tabLabels[tab]}
                        </button>))}
                </div>

                <div className="grid grid-cols-1 gap-16 lg:grid-cols-3">
                    <div className="space-y-12 lg:col-span-2">
                        {activeTab === "details" ? (<div className="space-y-6">
                                <h3 className="font-headline text-2xl font-bold tracking-tight">
                                    {currentProduct.sourcing.title}
                                </h3>
                                <p className="leading-relaxed text-on-surface-variant">
                                    {currentProduct.sourcing.body}
                                </p>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    {currentProduct.sourcing.certificationCards.map((card) => (<div key={card.title} className="rounded-xl bg-surface-container-lowest p-6">
                                            <Icon name={card.icon} className="mb-3 text-tertiary"/>
                                            <h4 className="mb-2 font-bold">{card.title}</h4>
                                            <p className="text-sm text-on-surface-variant">
                                                {card.description}
                                            </p>
                                        </div>))}
                                </div>
                            </div>) : null}

                        {activeTab === "reviews" ? (<div className="space-y-6">
                                <div className="flex flex-wrap items-end justify-between gap-4">
                                    <div>
                                        <h3 className="font-headline text-2xl font-bold tracking-tight">
                                            Đánh giá khách hàng
                                        </h3>
                                        <p className="text-on-surface-variant">
                                            Hiện chưa có đánh giá chi tiết từ khách hàng để hiển thị tại đây.
                                        </p>
                                    </div>
                                    <button type="button" className="cursor-not-allowed rounded-full bg-surface-container px-6 py-3 font-bold text-on-surface-variant" disabled>
                                        Sắp cập nhật
                                    </button>
                                </div>

                                <div className="rounded-2xl bg-surface-container-low p-6 text-sm leading-7 text-on-surface-variant">
                                    Khi có đánh giá khách hàng, tab này sẽ hiển thị phản hồi thật và cho
                                    phép khách hàng gửi nhận xét về sản phẩm.
                                </div>
                            </div>) : null}

                        {activeTab === "brewing" ? (<div className="space-y-6">
                                <h3 className="font-headline text-2xl font-bold tracking-tight">
                                    Cách sử dụng sản phẩm
                                </h3>
                                <div className="grid gap-4 sm:grid-cols-3">
                                    {[
                {
                    title: "Kiểm tra mô tả",
                    body: "Đọc kỹ phần mô tả sản phẩm để chọn đúng loại đặc sản phù hợp nhu cầu.",
                },
                {
                    title: "Thêm vào giỏ",
                    body: "Chọn số lượng phù hợp rồi thêm sản phẩm vào giỏ để chuẩn bị thanh toán.",
                },
                {
                    title: "Checkout",
                    body: "Đơn hàng sẽ được xác nhận và lưu vào lịch sử đặt hàng của bạn.",
                },
            ].map((step) => (<div key={step.title} className="rounded-2xl bg-surface-container-lowest p-6">
                                            <p className="text-xs uppercase tracking-widest text-primary">
                                                {step.title}
                                            </p>
                                            <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                                                {step.body}
                                            </p>
                                        </div>))}
                                </div>
                            </div>) : null}
                    </div>

                    <div className="space-y-8">
                        <div className="space-y-6 rounded-2xl bg-surface-container-high p-8">
                            <h4 className="font-headline text-xl font-bold">Cam kết chất lượng</h4>
                            <ul className="space-y-4">
                                {currentProduct.heritageCommitments.map((item) => (<li key={item.text} className="flex items-start gap-3">
                                        <Icon name={item.icon} className="text-primary"/>
                                        <span className="text-sm">{item.text}</span>
                                    </li>))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            <section className="mt-24">
                <div className="mb-10 flex items-center justify-between">
                    <h3 className="font-headline text-2xl font-bold tracking-tight">
                        Có thể bạn sẽ thích
                    </h3>
                    <Link className="font-bold text-primary hover:underline" to={routes.products}>
                        Xem tất cả
                    </Link>
                </div>
                <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
                    {relatedProducts.map((relatedProduct) => (<article key={relatedProduct.id} className="group cursor-pointer">
                            <Link to={routes.productDetail(relatedProduct.slug)}>
                                <div className="relative mb-4 aspect-[4/5] overflow-hidden rounded-xl bg-surface-container-lowest">
                                    <img src={relatedProduct.image} alt={relatedProduct.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"/>
                                </div>
                                <h4 className="mb-1 font-headline text-lg font-bold">
                                    {relatedProduct.name}
                                </h4>
                            </Link>
                            <p className="font-bold text-primary">
                                {formatCurrency(relatedProduct.price)}
                            </p>
                        </article>))}
                </div>
            </section>
        </div>);
}
