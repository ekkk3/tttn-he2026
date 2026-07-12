import {
    customerOrderStatusLabels,
    customerPaymentMethodLabels,
    customerPaymentStatusLabels,
    fallbackBackendLabel,
} from "@/shared/lib/customer-order-labels";

export function adminOrderStatusTone(status) {
    if (status === "DELIVERED") return "success";
    if (status === "DELIVERY_FAILED" || status === "CANCELLED") return "danger";
    if (status === "SHIPPED" || status === "PACKED") return "primary";
    if (status === "CONFIRMED") return "secondary";

    return "warning";
}

export function adminPaymentStatusTone(status) {
    if (status === "SUCCESS") return "success";
    if (status === "FAILED" || status === "REFUNDED" || status === "CANCELLED") return "danger";
    if (status === "PENDING") return "warning";

    return "neutral";
}

export function adminOrderStatusLabel(status) {
    return customerOrderStatusLabels[status] ?? fallbackBackendLabel(status);
}

export function adminPaymentStatusLabel(status) {
    return customerPaymentStatusLabels[status] ?? fallbackBackendLabel(status);
}

export function paymentMethodLabel(method) {
    return customerPaymentMethodLabels[method] ?? fallbackBackendLabel(method);
}
