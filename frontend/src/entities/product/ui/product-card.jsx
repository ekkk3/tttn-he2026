import { Link } from "react-router-dom";
import { routes } from "@/shared/config/routes";
import { cn } from "@/shared/lib/cn";
import { formatCurrency } from "@/shared/lib/format";
import { stockStatusLabels } from "@/shared/lib/labels";
import { useShopStore } from "@/shared/lib/store/use-shop-store";
import { Badge, Button, Icon, SurfaceCard } from "@/shared/ui";
export function ProductCard({ product, view = "grid", onAddToCart }) {
    const isList = view === "list";
    const wishlistIds = useShopStore((state) => state.wishlistIds);
    const toggleWishlist = useShopStore((state) => state.toggleWishlist);
    const isWishlisted = wishlistIds.includes(product.id);
    const currentStockQuantity = product.stockQuantity ?? 0;
    const isOutOfStock = currentStockQuantity <= 0;
    const lowStockLabel = currentStockQuantity > 0 && currentStockQuantity <= 5
        ? `Chỉ còn ${currentStockQuantity} sản phẩm`
        : null;
    return (<SurfaceCard className={cn("group overflow-hidden p-0 transition duration-300 hover:-translate-y-1", isList && "flex flex-col md:flex-row")}>
            <div className={cn("relative overflow-hidden", isList ? "md:w-[280px]" : "aspect-[4/5]")}>
                <img src={product.image} alt={product.name} className={cn("h-full w-full object-cover transition duration-700 group-hover:scale-105", isList ? "aspect-square md:aspect-auto" : "aspect-[4/5]")}/>
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-on-surface/35 to-transparent"/>
                {product.badge ? (<Badge tone="primary" className="absolute left-4 top-4 bg-surface/85 text-primary backdrop-blur-md">
                        {product.badge}
                    </Badge>) : null}
                <button className={cn("absolute right-4 top-4 rounded-full p-2 backdrop-blur-md transition", isWishlisted
            ? "bg-error-container text-error"
            : "bg-surface/85 text-on-surface-variant hover:text-error")} onClick={() => toggleWishlist(product.id)} aria-label={isWishlisted ? `Bỏ yêu thích ${product.name}` : `Yêu thích ${product.name}`}>
                    <Icon name="favorite" className="text-xl" fill={isWishlisted}/>
                </button>
            </div>

            <div className="flex flex-1 flex-col gap-4 p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5">
                        <p className="text-xs uppercase tracking-[0.16em] text-secondary">
                            {product.tag}
                        </p>
                        <Link to={routes.productDetail(product.slug)} className="font-headline text-xl font-semibold leading-tight text-on-surface transition hover:text-primary">
                            {product.name}
                        </Link>
                        <p className="text-sm text-on-surface-variant">{product.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-tertiary/10 px-3 py-1.5 text-tertiary">
                        <Icon name="star" className="text-lg" fill/>
                        <span className="text-sm font-semibold">{product.rating}</span>
                    </div>
                </div>

                <p className="max-w-xl text-sm leading-6 text-on-surface-variant">
                    {product.shortDescription}
                </p>

                <div className="flex flex-wrap gap-2">
                    <Badge tone="neutral">{product.categoryName}</Badge>
                    <Badge tone="secondary">{product.regionName}</Badge>
                    <Badge tone={product.stockStatus === "low-stock" ? "warning" : "success"}>
                        {stockStatusLabels[product.stockStatus]}
                    </Badge>
                </div>

                <p className={cn("text-sm font-medium", isOutOfStock
            ? "text-error"
            : lowStockLabel
                ? "text-amber-700"
                : "text-on-surface-variant")}>
                    {isOutOfStock ? "Hết hàng" : lowStockLabel ?? `Còn ${currentStockQuantity} sản phẩm`}
                </p>

                <div className="mt-auto flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="font-headline text-2xl font-bold text-on-surface">
                            {formatCurrency(product.price)}
                        </p>
                        {product.originalPrice ? (<p className="text-sm text-on-surface-variant line-through">
                                {formatCurrency(product.originalPrice)}
                            </p>) : null}
                    </div>

                    <Button iconLeft={<Icon name="shopping_basket" className="text-lg"/>} disabled={isOutOfStock} onClick={() => onAddToCart?.(product.id)}>
                        {isOutOfStock ? "Hết hàng" : "Thêm vào giỏ"}
                    </Button>
                </div>
            </div>
        </SurfaceCard>);
}
