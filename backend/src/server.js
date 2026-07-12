import 'dotenv/config';
import app from './app.js';

const port = process.env.PORT || 8000;
app.listen(port, () => {
  console.log(`API server dang chay tai http://127.0.0.1:${port}`);
  console.log(`Health check: http://127.0.0.1:${port}/backend-status`);
});
