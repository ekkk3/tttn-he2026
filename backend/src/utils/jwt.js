import jwt from 'jsonwebtoken';
import 'dotenv/config';

// JWT_SECRET rong/mac dinh = token co the bi gia mao. Bat buoc phai dat trong production;
// o dev cho phep fallback de tien khoi dong nhanh nhung canh bao ro.
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET chua duoc cau hinh trong .env — bat buoc khi chay production.');
  }
  console.warn('[jwt] JWT_SECRET chua cau hinh, dang dung secret mac dinh CHI DANH CHO DEV.');
}
const SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

// Frontend (use-auth-store.js) mong doi ca "access_token" + "expires_at" (ISO string)
// tu response dang nhap/dang ky, khong chi "token". Ham nay giai ma lai claim "exp"
// vua ky de tra ve dung dinh dang, tranh phai tu tinh toan lai thoi han.
export function tokenExpiresAtIso(token) {
  const decoded = jwt.decode(token);
  if (!decoded?.exp) return null;
  return new Date(decoded.exp * 1000).toISOString();
}
