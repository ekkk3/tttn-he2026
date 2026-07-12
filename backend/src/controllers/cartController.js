import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getRedis } from '../config/redis.js';
import { serializeCart } from '../utils/serializers.js';

async function getOrCreateCart(userId) {
  const [cart] = await query("SELECT * FROM carts WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1", [userId]);
  if (cart) return cart;
  const result = await query("INSERT INTO carts (user_id, status) VALUES (?, 'ACTIVE')", [userId]);
  return { id: result.insertId, user_id: userId, status: 'ACTIVE' };
}

// Lay cart + items (kem quan he product) da serialize san theo dinh dang frontend.
async function loadCartPayload(userId) {
  const cart = await getOrCreateCart(userId);
  const items = await query(
    `SELECT ci.*, p.category_id, p.supplier_id, p.region_id, p.sku, p.slug, p.name, p.description,
            p.short_description, p.origin, p.image_url, p.sale_price, p.stock_quantity, p.is_active,
            c.name AS category_name, s.name AS supplier_name, r.name AS region_name
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN suppliers s ON s.id = p.supplier_id
     LEFT JOIN regions r ON r.id = p.region_id
     WHERE ci.cart_id = ?`,
    [cart.id]
  );
  return serializeCart(cart, items);
}

async function invalidateCartCache(userId) {
  const redis = await getRedis();
  if (redis) await redis.del(`cart:${userId}`);
}

async function respondCart(userId, res, status = 200) {
  const redis = await getRedis();
  const cacheKey = `cart:${userId}`;
  const payload = await loadCartPayload(userId);
  // Cache-aside qua Redis (TTL 5 phut) neu co Redis; khong loi neu khong co.
  if (redis) await redis.setEx(cacheKey, 300, JSON.stringify(payload));
  res.status(status).json({ data: payload });
}

// GET /api/cart
export const show = asyncHandler(async (req, res) => {
  const redis = await getRedis();
  const cacheKey = `cart:${req.user.id}`;
  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) return res.json({ data: JSON.parse(cached) });
  }
  await respondCart(req.user.id, res);
});

export const storeItem = asyncHandler(async (req, res) => {
  const { product_id, quantity = 1 } = req.body;
  const cart = await getOrCreateCart(req.user.id);
  const [product] = await query(
    'SELECT sale_price, stock_quantity FROM products WHERE id = ? AND is_deleted = 0 AND is_active = 1',
    [product_id]
  );
  if (!product) return res.status(404).json({ message: 'Khong tim thay san pham.' });

  const [existing] = await query('SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?', [cart.id, product_id]);
  const newQty = (existing ? existing.quantity : 0) + Number(quantity);
  if (product.stock_quantity !== null && newQty > product.stock_quantity) {
    return res.status(422).json({ message: `Chi con ${product.stock_quantity} san pham trong kho.` });
  }
  if (existing) {
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
  await respondCart(req.user.id, res, 201);
});

export const updateItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  const [item] = await query('SELECT * FROM cart_items WHERE id = ?', [req.params.cartItem]);
  if (!item) return res.status(404).json({ message: 'Khong tim thay san pham trong gio hang.' });
  const [product] = await query('SELECT stock_quantity FROM products WHERE id = ?', [item.product_id]);
  if (product && product.stock_quantity !== null && Number(quantity) > product.stock_quantity) {
    return res.status(422).json({ message: `Chi con ${product.stock_quantity} san pham trong kho.` });
  }
  await query('UPDATE cart_items SET quantity = ?, line_total = unit_price * ? WHERE id = ?', [
    quantity, quantity, item.id,
  ]);
  await invalidateCartCache(req.user.id);
  await respondCart(req.user.id, res);
});

export const destroyItem = asyncHandler(async (req, res) => {
  await query('DELETE FROM cart_items WHERE id = ?', [req.params.cartItem]);
  await invalidateCartCache(req.user.id);
  await respondCart(req.user.id, res);
});
