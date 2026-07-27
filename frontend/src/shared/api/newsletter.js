import { apiRequest } from "@/shared/api/backend-client";
// Đăng ký nhận bản tin — endpoint PUBLIC (không cần đăng nhập), gọi từ footer storefront.
export function subscribeNewsletter(email, source) {
    return apiRequest("/newsletter-subscriptions", {
        method: "POST",
        body: {
            email,
            source,
        },
    });
}
