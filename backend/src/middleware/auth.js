import { verifyToken } from '../utils/jwt.js';

// Tuong duong middleware 'auth:sanctum' ben Laravel, nhung dung JWT stateless
// thay vi personal_access_tokens (ban co the bo bang personal_access_tokens neu muon).
export function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: 'Unauthenticated.' });
  }
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthenticated.' });
  }
}
