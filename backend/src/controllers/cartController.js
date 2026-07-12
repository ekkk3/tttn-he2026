import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getRedis } from '../config/redis.js';

async function getOrCreateCart(userId) {
  const [cart] = await query("SELECT * FROM carts WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1", [userId]);
  if (cart) return cart;
  const result = await query("INSERT INTO carts (user_id, status) VALUES (?, 'ACTIVE')", [userId]);
  return { id: result.insertId, user_id: userId, status: 'ACTIVE' };
}

async function invalidateCartCache(userId) {
  const redis = await getRedis();
  if (redis) await redis.del(`cart:${userId}`);
}

// GET /api/cart — cache-aside qua Redis (TTL 5 phut), tu fallback MySQL neu khong co Redis.
export const show = asyncHandler(async (req, res) => {
  const redis = await getRedis();
  const cacheKey = `cart:${req.user.id}`;
  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) return res.json({ ...JSON.parse(cached), source: 'redis' });
  }
  const cart = await getOrCreateCart(req.user.id);
  const items = await query(
    `SELECT ci.*, p.name, p.image_url, p.slug
     FROM cart_items ci JOIN products p ON p.id = ci.product_id
     WHERE ci.cart_id = ?`,
    [cart.id]
  );
  const payload = { cart, items };
  if (redis) await redis.setEx(cacheKey, 300, JSON.stringify(payload));
  res.json({ ...payload, source: 'mysql' });
});

export const storeItem = asyncHandler(async (req, res) => {
  const { product_id, quantity = 1 } = req.body;
  const cart = await getOrCreateCart(req.user.id);
  const [product] = await query('SELECT sale_price FROM products WHERE id = ? AND is_deleted = 0', [product_id]);
  if (!product) return res.status(404).json({ message: 'Khong tim thay san pham.' });

  const [existing] = await query('SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?', [cart.id, product_id]);
  if (existing) {
    const newQty = existing.quantity + Number(quantity);
    await query('UPDATE cart_items SET quantity = ?, line_total = ? WHERE id = ?', [
      newQty, newQty * product.sale_price, existing.id,
    ]);
  } else {
    await query(
      'INSERT INTO cart_items (cart_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)',
      [cart.id, product_id, quantity, product.sale_price, quantity * product.sale_price]
    );
  }
  await invalidateCartCache(req.user.id);
  res.status(201).json({ message: 'Da them vao gio hang.' });
});

export const updateItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  const [item] = await query('SELECT * FROM cart_items WHERE id = ?', [req.params.cartItem]);
  if (!item) return res.status(404).json({ message: 'Khong tim thay san pham trong gio hang.' });
  await query('UPDATE cart_items SET quantity = ?, line_total = unit_price * ? WHERE id = ?', [
    quantity, quantity, item.id,
  ]);
  await invalidateCartCache(req.user.id);
  res.json({ message: 'Da cap nhat gio hang.' });
});

export const destroyItem = asyncHandler(async (req, res) => {
  await query('DELETE FROM cart_items WHERE id = ?', [req.params.cartItem]);
  await invalidateCartCache(req.user.id);
  res.json({ message: 'Da xoa san pham khoi gio hang.' });
});
