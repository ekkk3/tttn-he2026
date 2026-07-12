import axios from "axios";
const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000/api";
const DEFAULT_NETWORK_ERROR_MESSAGE = "Xin lỗi, không thể kết nối đến hệ thống. Vui lòng kiểm tra kết nối mạng của bạn và thử lại.";
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
    const headers = new Headers(options.headers);
    if (options.body !== undefined && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    if (options.token) {
        headers.set("Authorization", `Bearer ${options.token}`);
    }
    try {
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
        if (axios.isCancel(error)) {
            throw new DOMException("The operation was aborted.", "AbortError");
        }
        if (axios.isAxiosError(error)) {
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
