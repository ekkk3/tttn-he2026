import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import 'dotenv/config';
import apiRoutes from './routes/api.routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// Tuong duong endpoint /backend-status cua ban Laravel.
app.get('/backend-status', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use('/api', apiRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
