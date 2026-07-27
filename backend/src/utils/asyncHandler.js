// Bọc quanh MỌI route handler async trong dự án (vd: export const login = asyncHandler(async (req, res) => {...})).
// Express không tự bắt Promise bị reject từ 1 async function — nếu controller throw lỗi mà
// không có wrapper này, request sẽ treo mãi (không response) thay vì rơi vào errorHandler.
// Promise.resolve(...).catch(next) đảm bảo lỗi throw/reject được forward sang next(err).
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
