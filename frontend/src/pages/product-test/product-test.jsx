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


function ProductTest() {
    const navigate = useNavigate();


    return (
        <>
            <div className="mx-auto max-w-7xl px-6 pt-24">test
                ádasdsadasd
            </div>
        </>

    );
}
export default ProductTest;
