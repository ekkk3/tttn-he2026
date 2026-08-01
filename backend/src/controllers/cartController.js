import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getRedis } from '../config/redis.js';
import { serializeCart } from '../utils/serializers.js';

// "Get or create": mỗi user chỉ có đúng 1 giỏ hàng đang ACTIVE tại 1 thời điểm — nếu chưa
// có (lần đầu thêm sản phẩm) thì tạo mới, có rồi thì tái sử dụng. Nhờ vậy các hàm gọi sau
// (storeItem, updateItem...) không cần tự lo việc cart đã tồn tại hay chưa.
async function getOrCreateCart(userId) {
  const [cart] = await query("SELECT * FROM carts WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1", [userId]);
  if (cart) return cart;
  const result = await query("INSERT INTO carts (user_id, status) VALUES (?, 'ACTIVE')", [userId]);
  return { id: result.insertId, user_id: userId, status: 'ACTIVE' };
}

// Lấy cart + items (kèm quan hệ product) đã serialize sẵn theo định dạng frontend.
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
  // Cache-aside qua Redis (TTL 5 phút) nếu có Redis; không lỗi nếu không có.
  if (redis) await redis.setEx(cacheKey, 300, JSON.stringify(payload));
  res.status(status).json({ data: payload });
}

// GET /api/cart — cache-aside: đọc Redis trước (nhanh, khỏi query MySQL); cache miss (chưa
// có/đã hết hạn TTL) thì respondCart() bên dưới sẽ tự query MySQL rồi ghi lại vào cache.
export const show = asyncHandler(async (req, res) => {
  const redis = await getRedis();
  const cacheKey = `cart:${req.user.id}`;
  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) return res.json({ data: JSON.parse(cached) });
  }
  await respondCart(req.user.id, res);
});

// Số lượng phải là số nguyên dương — cho phép giá trị âm/0/không phải số sẽ làm sai
// line_total (có thể âm) và lọt qua kiểm tra tồn kho ở phía checkout.
function isValidQuantity(quantity) {
  return Number.isInteger(Number(quantity)) && Number(quantity) > 0;
}

export const storeItem = asyncHandler(async (req, res) => {
  const { product_id, quantity = 1 } = req.body;
  if (!isValidQuantity(quantity)) {
    return res.status(422).json({ message: 'Số lượng không hợp lệ.' });
  }
  const qty = Number(quantity);
  const cart = await getOrCreateCart(req.user.id);
  const [product] = await query(
    'SELECT sale_price, stock_quantity FROM products WHERE id = ? AND is_deleted = 0 AND is_active = 1',
    [product_id]
  );
  if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm.' });

  // Sản phẩm đã có trong giỏ -> CỘNG DỒN số lượng mới vào số lượng cũ (không phải thay thế),
  // rồi mới so với tồn kho — tránh trường hợp thêm nhiều lần nhỏ lẻ vượt quá tồn kho thực tế.
  const [existing] = await query('SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?', [cart.id, product_id]);
  const newQty = (existing ? existing.quantity : 0) + qty;
  if (product.stock_quantity !== null && newQty > product.stock_quantity) {
    return res.status(422).json({ message: `Chỉ còn ${product.stock_quantity} sản phẩm trong kho.` });
  }
  if (existing) {
    await query('UPDATE cart_items SET quantity = ?, line_total = ? WHERE id = ?', [
      newQty, newQty * product.sale_price, existing.id,
    ]);
  } else {
    await query(
      'INSERT INTO cart_items (cart_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)',
      [cart.id, product_id, qty, product.sale_price, qty * product.sale_price]
    );
  }
  await invalidateCartCache(req.user.id);
  await respondCart(req.user.id, res, 201);
});

export const updateItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  if (!isValidQuantity(quantity)) {
    return res.status(422).json({ message: 'Số lượng không hợp lệ.' });
  }
  const qty = Number(quantity);
  // Bảo vệ IDOR: cart_items.id là auto-increment dễ đoán, phải kiểm tra item này
  // thuộc giỏ hàng CỦA CHÍNH user đang đăng nhập trước khi cho sửa.
  const [item] = await query(
    `SELECT ci.* FROM cart_items ci JOIN carts c ON c.id = ci.cart_id
     WHERE ci.id = ? AND c.user_id = ?`,
    [req.params.cartItem, req.user.id]
  );
  if (!item) return res.status(404).json({ message: 'Không tìm thấy sản phẩm trong giỏ hàng.' });
  const [product] = await query('SELECT stock_quantity FROM products WHERE id = ?', [item.product_id]);
  if (product && product.stock_quantity !== null && qty > product.stock_quantity) {
    return res.status(422).json({ message: `Chỉ còn ${product.stock_quantity} sản phẩm trong kho.` });
  }
  await query('UPDATE cart_items SET quantity = ?, line_total = unit_price * ? WHERE id = ?', [
    qty, qty, item.id,
  ]);
  await invalidateCartCache(req.user.id);
  await respondCart(req.user.id, res);
});

export const destroyItem = asyncHandler(async (req, res) => {
  // Bảo vệ IDOR: chỉ xóa nếu item thuộc giỏ hàng của chính user này.
  // Điều kiện `c.user_id = ?` đã đủ để dữ liệu người khác an toàn; kiểm tra affectedRows chỉ
  // để trả 404 cho đúng thay vì báo "xóa thành công" trong khi chẳng xóa được gì
  // (updateItem ở trên vốn đã trả 404 — làm cho 2 endpoint nhất quán với nhau).
  const result = await query(
    `DELETE ci FROM cart_items ci JOIN carts c ON c.id = ci.cart_id
     WHERE ci.id = ? AND c.user_id = ?`,
    [req.params.cartItem, req.user.id]
  );
  if (result.affectedRows === 0) {
    return res.status(404).json({ message: 'Không tìm thấy sản phẩm trong giỏ hàng.' });
  }
  await invalidateCartCache(req.user.id);
  await respondCart(req.user.id, res);
});
