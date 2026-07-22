export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(err);
  const status = err.status || 500;
  // Loi co status rieng (422/404/403...) la loi nghiep vu, message an toan de hien thi.
  // Loi 500 (khong luong truoc) co the chua chi tiet noi bo (SQL, stack, duong dan)
  // nen chi tra thong bao chung cho client, tranh lo thong tin he thong.
  const message = status === 500 ? 'Da co loi xay ra, vui long thu lai sau.' : (err.message || 'Loi khong xac dinh.');
  res.status(status).json({ message });
}
