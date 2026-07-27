// Tải 1 chuỗi text xuống máy người dùng dưới dạng file (vd export CSV) mà KHÔNG cần gọi
// API nào: tạo Blob trong bộ nhớ trình duyệt, gắn vào 1 thẻ <a download> ẩn rồi tự click.
export function downloadTextFile(filename, content, mimeType = "text/plain") {
    if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
        return;
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    // Giải phóng URL tạm ngay sau khi trình duyệt đã bắt đầu tải — tránh rò rỉ bộ nhớ nếu
    // trang gọi hàm này nhiều lần (vd export nhiều báo cáo liên tiếp).
    URL.revokeObjectURL(url);
}
