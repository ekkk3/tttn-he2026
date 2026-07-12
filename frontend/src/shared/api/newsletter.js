import { apiRequest } from "@/shared/api/backend-client";
export function subscribeNewsletter(email, source) {
    return apiRequest("/newsletter-subscriptions", {
        method: "POST",
        body: {
            email,
            source,
        },
    });
}
