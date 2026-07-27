import axios from "axios";
// Client HTTP DUY NHẤT dùng bởi TOÀN BỘ store trong app (xem shared/lib/store/*) — mọi
// store gọi apiRequest() bên dưới thay vì tự dùng axios/fetch trực tiếp, để có cùng 1 cách
// xử lý lỗi/token/base URL nhất quán ở một chỗ.
const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000/api";
const DEFAULT_NETWORK_ERROR_MESSAGE = "Xin lỗi, không thể kết nối đến hệ thống. Vui lòng kiểm tra kết nối mạng của bạn và thử lại.";
// Lỗi CHUẨN HÓA cho mọi lời gọi API — dù lỗi gốc là axios, network, hay response backend,
// nơi gọi (các store) chỉ cần bắt duy nhất kiểu lỗi này với .status/.message/.errors quen thuộc.
export class ApiError extends Error {
    status;
    errors;
    payload;
    constructor(status, message, errors, payload) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.errors = errors ?? null;
        this.payload = payload;
    }
}
// Dùng ở HẦU HẾT mọi store: 401 nghĩa là token hết hạn/không hợp lệ -> nơi gọi thường phản
// ứng bằng cách clearSession() (đăng xuất) thay vì chỉ hiện lỗi thông thường.
export function isUnauthorizedApiError(error) {
    return error instanceof ApiError && error.status === 401;
}
export function getApiBaseUrl() {
    return (import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}
export function buildApiUrl(path) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${getApiBaseUrl()}${normalizedPath}`;
}
function payloadAsErrorPayload(payload) {
    return payload && typeof payload === "object" ? payload : null;
}
export async function apiRequest(path, options = {}) {
    // Tự thêm Content-Type khi có body (trừ khi caller đã tự set), và tự gắn Bearer token
    // nếu store truyền `token` — nhờ vậy mỗi lời gọi ở store chỉ cần { token, body } gọn gàng.
    const headers = new Headers(options.headers);
    if (options.body !== undefined && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    if (options.token) {
        headers.set("Authorization", `Bearer ${options.token}`);
    }
    try {
        // adapter:"fetch" + env:{Request:null}: dùng fetch() trình duyệt thay vì XHR mặc định
        // của axios (cùng workaround với use-vietnam-location-store.js) — cần cho môi trường
        // preview/sandbox chặn XHR trực tiếp.
        const response = await axios.request({
            adapter: "fetch",
            env: {
                Request: null,
            },
            url: buildApiUrl(path),
            method: options.method ?? "GET",
            headers: Object.fromEntries(headers.entries()),
            data: options.body,
            signal: options.signal,
        });
        return response.data;
    }
    catch (error) {
        // Request bị hủy (vd component unmount, đổi trang giữa chừng) -> ném lỗi chuẩn Web
        // API (AbortError) để nơi gọi có thể phân biệt "bị hủy" với "thực sự lỗi".
        if (axios.isCancel(error)) {
            throw new DOMException("The operation was aborted.", "AbortError");
        }
        if (axios.isAxiosError(error)) {
            // status 0 = KHÔNG kết nối được server (mất mạng, server sập...), khác với có
            // phản hồi nhưng là lỗi (4xx/5xx) — 2 trường hợp cần thông báo khác nhau cho người dùng.
            const status = error.response?.status ?? 0;
            const payload = error.response?.data;
            const errorPayload = payloadAsErrorPayload(payload);
            const message = status === 0
                ? error.message
                    ? `${DEFAULT_NETWORK_ERROR_MESSAGE} (${error.message})`
                    : DEFAULT_NETWORK_ERROR_MESSAGE
                : errorPayload?.message ??
                    (typeof payload === "string" && payload.trim() ? payload : undefined) ??
                    error.response?.statusText ??
                    error.message ??
                    "Request failed.";
            throw new ApiError(status, message, errorPayload?.errors, payload);
        }
        throw new ApiError(0, error instanceof Error && error.message
            ? `${DEFAULT_NETWORK_ERROR_MESSAGE} (${error.message})`
            : DEFAULT_NETWORK_ERROR_MESSAGE, undefined, error);
    }
}
