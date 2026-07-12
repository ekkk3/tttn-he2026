import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import 'dotenv/config';
import apiRoutes from './routes/api.routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

// credentials:true khong the di chung voi origin '*' (browser se chan) — cho phep ca
// localhost va 127.0.0.1 vi Vite dev server co the duoc mo bang ca hai dang.
const corsAllowlist = [process.env.CORS_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean);
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || corsAllowlist.includes(origin)),
  credentials: true,
}));
app.use(express.json());
app.use(morgan('dev'));
// File dinh kem "Dang ky Nha cung cap" (giay phep kinh doanh / ATTP) — xem middleware/upload.js.
app.use('/uploads', express.static('uploads'));

// Tuong duong endpoint /backend-status cua ban Laravel.
app.get('/backend-status', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
