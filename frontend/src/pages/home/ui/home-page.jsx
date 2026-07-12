import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { subscribeNewsletter } from "@/shared/api/newsletter";
import { routes } from "@/shared/config/routes";
import { formatCurrency } from "@/shared/lib/format";
import { useCartStore } from "@/shared/lib/store/use-cart-store";
import { useFeedbackStore } from "@/shared/lib/store/use-feedback-store";
import { useStorefrontCatalogStore } from "@/shared/lib/store/use-storefront-catalog-store";
import { Icon } from "@/shared/ui";
const heroImage = "https://lh3.googleusercontent.com/aida-public/AB6AXuDcmssof0jwM0xU6QZmiOsxgreuA9422kt05Agu0bz4o4TKaU8eEWDZXRrVj4a5lSAYMbjYmhEH_S2z_VnRDZg3z_8SQILTIF16S0nKU5n212T2bVXIWGAtzlWZ7oCt2Lk7me6I2uMG3twWE2u6FtnHTgBEYcGscytys2Px7ZViR3niMDfQmq82u4n22JmyAwFpzbbir2qjsL1MEHbeAQ7p8PHbHSLbJADjEcrlwvcJCeZBwjxVukZqgApwhLt7Tqz5ifAgi_KFnJ8";
function EmptyCatalogMessage({ message }) {
    return (<div className="rounded-xl bg-surface-container-lowest p-8 text-center text-sm text-on-surface-variant">
            {message}
        </div>);
}
export function HomePage() {
    const addItem = useCartStore((state) => state.addItem);
    const pushToast = useFeedbackStore((state) => state.pushToast);
    const products = useStorefrontCatalogStore((state) => state.products);
    const categories = useStorefrontCatalogStore((state) => state.categories);
    const regions = useStorefrontCatalogStore((state) => state.regions);
    const storefrontStatus = useStorefrontCatalogStore((state) => state.status);
    const storefrontError = useStorefrontCatalogStore((state) => state.error);
    const loadCatalog = useStorefrontCatalogStore((state) => state.loadCatalog);
    const [newsletterEmail, setNewsletterEmail] = useState("");
    useEffect(() => {
        void loadCatalog();
    }, [loadCatalog]);
    const featuredProducts = products.slice(0, 4);
    const newArrivals = products.slice(1, 4);
    const isCatalogLoading = storefrontStatus === "loading" || storefrontStatus === "idle";
    async function handleSubscribeNewsletter(event) {
        event?.preventDefault();
        if (newsletterEmail.trim().length === 0) {
            pushToast({
                tone: "warning",
                message: "Vui lòng nhập email để đăng ký bản tin.",
            });
            return;
        }
        await subscribeNewsletter(newsletterEmail.trim(), "home-hero");
        setNewsletterEmail("");
        pushToast({
            tone: "success",
            message: "Đã lưu đăng ký bản tin từ trang chủ.",
        });
    }
    return (<div>
            <section className="relative flex h-[870px] items-center overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <img src={heroImage} alt="Không gian mua sắm online" className="h-full w-full object-cover"/>
                    <div className="absolute inset-0 bg-gradient-to-r from-on-surface/60 to-transparent"/>
                </div>
                <div className="relative z-10 mx-auto w-full max-w-7xl px-8">
                    <div className="max-w-2xl text-white">
                        <span className="mb-6 inline-block rounded-full bg-primary px-3 py-1 text-sm uppercase tracking-widest">
                            Đặc sản vùng miền
                        </span>
                        <h1 className="mb-6 font-headline text-6xl font-bold leading-tight">
                            Khám phá các sản phẩm
                            <br />
                            đặc trưng từ khắp nơi Việt Nam
                        </h1>
                        <p className="mb-8 max-w-lg text-lg font-light leading-relaxed opacity-90">
                            Chọn lựa quà tặng, nông sản và tinh hoa thủ công được tuyển chọn kỹ càng
                            để đặt hàng nhanh chóng và giao tận nơi.
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <Link to={routes.products} className="flex items-center gap-2 rounded-xl bg-primary px-8 py-4 font-medium text-white shadow-lg transition-all active:scale-95">
                                Mở cửa hàng 
                                <Icon name="arrow_forward"/>
                            </Link>
                            <Link to={routes.regions} className="rounded-xl border border-white/20 bg-white/10 px-8 py-4 font-medium text-white backdrop-blur-md transition-all hover:bg-white/20">
                                Khu nội dung vùng miền
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-surface px-8 py-24">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-16 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
                        <div>
                            <p className="text-sm uppercase tracking-widest text-primary">
                                Khám phá
                            </p>
                            <h2 className="mt-3 font-headline text-4xl font-bold">
                                Danh mục đặc sản
                            </h2>
                        </div>
                        <Link className="font-medium text-primary hover:underline" to={routes.products}>
                            Xem toàn bộ sản phẩm
                        </Link>
                    </div>

                    {categories.length === 0 ? (<EmptyCatalogMessage message={isCatalogLoading
                ? "Đang tải danh mục..."
                : storefrontError ?? "Chưa có danh mục nào để hiển thị."}/>) : (<div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-4">
                            {categories.map((category, index) => {
                const product = products[index] ?? products[0];
                return (<Link key={category.id} to={routes.productsWithQuery({ categories: [category.id] })} className="group relative overflow-hidden rounded-xl">
                                        <img src={product?.image} alt={category.name} className="aspect-[4/5] w-full object-cover transition-transform duration-700 group-hover:scale-105"/>
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent p-6">
                                            <div className="flex h-full flex-col justify-end">
                                                <h3 className="font-headline text-2xl font-bold text-white">
                                                    {category.name}
                                                </h3>
                                                <p className="mt-2 text-sm leading-6 text-white/80">
                                                    {category.description}
                                                </p>
                                            </div>
                                        </div>
                                    </Link>);
            })}
                        </div>)}
                </div>
            </section>

            <section className="bg-surface-container-low px-8 py-24">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                        <div>
                            <p className="text-sm uppercase tracking-widest text-primary">
                                Gợi ý hôm nay
                            </p>
                            <h2 className="mt-3 font-headline text-4xl font-bold">
                                Mặt hàng nổi bật
                            </h2>
                        </div>
                        <div className="rounded-xl bg-surface-container px-4 py-2 text-sm text-on-surface-variant">
                            {products.length} sản phẩm đặc sắc
                        </div>
                    </div>

                    {featuredProducts.length === 0 ? (<EmptyCatalogMessage message={isCatalogLoading
                ? "Đang tải sản phẩm..."
                : storefrontError ?? "Chưa có sản phẩm khả dụng."}/>) : (<div className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-4">
                            {featuredProducts.map((product) => (<article key={product.id} className="group flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest">
                                    <Link to={routes.productDetail(product.slug)} className="relative aspect-[4/5] overflow-hidden">
                                        <img src={product.image} alt={product.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"/>
                                    </Link>
                                    <div className="flex flex-1 flex-col space-y-3 p-6">
                                        <div className="flex items-start justify-between gap-3">
                                            <Link to={routes.productDetail(product.slug)} className="font-headline text-lg font-semibold">
                                                {product.name}
                                            </Link>
                                            <div className="flex items-center text-tertiary">
                                                <Icon name="star" className="text-sm" fill/>
                                                <span className="ml-1 text-xs font-bold">
                                                    {product.rating.toFixed(1)}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-sm leading-relaxed text-on-surface-variant">
                                            {product.shortDescription}
                                        </p>
                                        <div className="mt-auto flex items-center justify-between pt-2">
                                            <span className="text-xl font-bold">
                                                {formatCurrency(product.price)}
                                            </span>
                                            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary transition-all active:scale-90 disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant" disabled={(product.stockQuantity ?? 0) <= 0} onClick={() => void addItem(product.id, 1)} aria-label={`Thêm vào giỏ ${product.name}`}>
                                                <Icon name="shopping_basket"/>
                                            </button>
                                        </div>
                                    </div>
                                </article>))}
                        </div>)}
                </div>
            </section>

            <section className="bg-surface px-8 py-24">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-16 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
                        <div>
                            <p className="text-sm uppercase tracking-widest text-primary">
                                Nội dung tĩnh
                            </p>
                            <h2 className="mt-3 font-headline text-4xl font-bold">
                                Vùng miền & câu chuyện
                            </h2>
                        </div>
                        <Link className="font-medium text-primary hover:underline" to={routes.regions}>
                            Xem nội dung vùng miền
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-4">
                        {regions.map((region, index) => {
            const product = products.find((item) => item.regionId === region.id) ?? products[index];
            return (<Link key={region.id} to={routes.regions} className="rounded-xl bg-surface-container-low p-6 transition hover:-translate-y-1">
                                    <img src={product?.image} alt={region.name} className="aspect-[4/3] w-full rounded-xl object-cover"/>
                                    <p className="mt-5 text-xs uppercase tracking-widest text-primary">
                                        Đắm chìm trong câu chuyện vùng miền
                                    </p>
                                    <h3 className="mt-2 font-headline text-2xl font-semibold">
                                        {region.name}
                                    </h3>
                                    <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                                        {region.description}
                                    </p>
                                </Link>);
        })}
                    </div>
                </div>
            </section>

            <section className="bg-surface-container-low px-8 py-24">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-12">
                        <p className="text-sm uppercase tracking-widest text-primary">
                            Vừa cập bến
                        </p>
                        <h2 className="mt-3 font-headline text-4xl font-bold">
                            Sản phẩm mới trên storefront
                        </h2>
                    </div>

                    {newArrivals.length === 0 ? (<EmptyCatalogMessage message={isCatalogLoading
                ? "Đang chờ sản phẩm mới..."
                : "Chưa có sản phẩm mới để hiển thị."}/>) : (<div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                            {newArrivals.map((product) => (<article key={product.id} className="overflow-hidden rounded-xl bg-surface-container-lowest">
                                    <Link to={routes.productDetail(product.slug)}>
                                        <img src={product.image} alt={product.name} className="aspect-[4/3] w-full object-cover"/>
                                    </Link>
                                    <div className="space-y-3 p-6">
                                        <p className="text-xs uppercase tracking-widest text-on-surface-variant">
                                            {product.regionName}
                                        </p>
                                        <Link to={routes.productDetail(product.slug)} className="font-headline text-2xl font-semibold">
                                            {product.name}
                                        </Link>
                                        <p className="text-sm leading-6 text-on-surface-variant">
                                            {product.description}
                                        </p>
                                    </div>
                                </article>))}
                        </div>)}
                </div>
            </section>

            <section className="relative overflow-hidden bg-primary py-20 text-white">
                <div className="relative z-10 mx-auto max-w-4xl px-8 text-center">
                    <h2 className="mb-4 font-headline text-3xl font-bold">
                        Gia nhập cộng đồng Heritage Harvest
                    </h2>
                    <p className="mb-10 opacity-80">
                        Nhận tin về mùa vụ, ưu đãi quà tặng và câu chuyện vùng miền khi bộ sưu tập được
                        cập nhật.
                    </p>
                    <form className="mx-auto flex max-w-lg flex-col gap-4 sm:flex-row" onSubmit={handleSubscribeNewsletter}>
                        <input className="flex-grow rounded-xl border border-white/20 bg-white/10 px-6 py-4 text-white outline-none placeholder:text-white/50 focus:ring-2 focus:ring-white" placeholder="Email của bạn" type="email" value={newsletterEmail} onChange={(event) => setNewsletterEmail(event.target.value)}/>
                        <button className="rounded-xl bg-white px-8 py-4 font-bold text-primary transition-colors hover:bg-zinc-100" type="submit">
                            Đăng ký
                        </button>
                    </form>
                </div>
                <div className="absolute right-0 top-0 h-96 w-96 translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-3xl"/>
                <div className="absolute bottom-0 left-0 h-64 w-64 -translate-x-1/2 translate-y-1/2 rounded-full bg-white/5 blur-3xl"/>
            </section>
        </div>);
}
