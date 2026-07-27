// Định dạng theo locale "vi-VN" — dùng Intl có sẵn của trình duyệt/Node thay vì tự ghép
// chuỗi số, để đúng chuẩn phân cách hàng nghìn/ký hiệu tiền tệ/tên tháng tiếng Việt.
export function formatCurrency(value) {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
    }).format(value);
}
export function formatCompactCurrency(value) {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(value);
}
// Mọi hàm format ngày ở đây đều thủ sẵn "--" cho input rỗng/không parse được, để UI không
// bao giờ hiện "Invalid Date" khi dữ liệu backend trả về null (vd đơn chưa giao thì
// delivered_at là null).
export function formatDate(date) {
    if (!date || Number.isNaN(Date.parse(date))) {
        return "--";
    }
    return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(date));
}
export function formatDateTime(date) {
    if (!date || Number.isNaN(Date.parse(date))) {
        return "--";
    }
    return new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(date));
}
