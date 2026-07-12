import { Link } from "react-router-dom";
import { buttonStyles } from "@/shared/ui/button.styles";
export function Button({ children, className, variant = "primary", size = "md", iconLeft, iconRight, type = "button", ...props }) {
    return (<button type={type} className={buttonStyles(variant, size, className)} {...props}>
            {iconLeft}
            <span>{children}</span>
            {iconRight}
        </button>);
}
export function ButtonLink({ children, className, variant = "primary", size = "md", iconLeft, iconRight, ...props }) {
    return (<Link className={buttonStyles(variant, size, className)} {...props}>
            {iconLeft}
            <span>{children}</span>
            {iconRight}
        </Link>);
}
