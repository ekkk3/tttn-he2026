import { clsx } from "clsx";
// Helper ghép className có điều kiện, dùng khắp shared/ui/*: cn("btn", isActive && "btn-active")
// bỏ qua các giá trị falsy (false/null/undefined) và join phần còn lại bằng khoảng trắng.
export function cn(...inputs) {
    return clsx(inputs);
}
