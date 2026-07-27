// Pub/sub đơn giản để tránh import vòng (use-auth-store.js không thể import trực tiếp
// use-cart-store.js/use-account-store.js... vì các store đó lại import ngược use-auth-store).
// Mỗi store "nhạy cảm theo phiên đăng nhập" tự đăng ký 1 hàm dọn dữ liệu của mình qua
// registerProtectedSessionCleanup(); use-auth-store chỉ cần gọi runProtectedSessionCleanup()
// một lần khi đăng xuất/hết phiên mà không cần biết có bao nhiêu store đang lắng nghe.
const cleanupHandlers = new Set();
export function registerProtectedSessionCleanup(handler) {
    cleanupHandlers.add(handler);
    return () => {
        cleanupHandlers.delete(handler);
    };
}
export function runProtectedSessionCleanup() {
    for (const cleanupHandler of cleanupHandlers) {
        cleanupHandler();
    }
}
