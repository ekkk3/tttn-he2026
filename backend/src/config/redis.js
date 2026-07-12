import { createClient } from 'redis';
import 'dotenv/config';

let client = null;
let connecting = null;

// Cache-aside cho gio hang (carts). Neu REDIS_URL khong duoc cau hinh hoac ket noi
// that bai, moi noi goi getRedis() se tra ve null va code goi se tu fallback ve MySQL.
export async function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (client) return client;
  if (!connecting) {
    const c = createClient({ url: process.env.REDIS_URL });
    c.on('error', (err) => console.error('[redis] error:', err.message));
    connecting = c
      .connect()
      .then(() => {
        client = c;
        return client;
      })
      .catch((err) => {
        console.error('[redis] connection failed, cart se dung MySQL truc tiep:', err.message);
        client = null;
        return null;
      });
  }
  return connecting;
}
