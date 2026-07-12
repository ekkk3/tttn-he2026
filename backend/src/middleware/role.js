// Tuong duong middleware phan quyen 4 vai tro (CUSTOMER, ADMIN, WAREHOUSE_STAFF, SUPPLIER)
// da mo ta trong de cuong (Tuan 2: "middleware phan quyen 4 vai tro").
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role.' });
    }
    next();
  };
}
