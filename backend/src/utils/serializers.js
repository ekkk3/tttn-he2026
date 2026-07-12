// =====================================================================
// Cac ham "serialize" de shape response khop dung voi cac adapter frontend
// (storefront-adapters.js): frontend doc { data, current_page, ... } theo kieu
// Laravel API Resource, va can cac quan he long nhau (product.category,
// product.supplier, cart.items[].product, order.items, order.payment...).
// Xem PLAN_3_TUAN.md - "Sua backend cho khop frontend".
// =====================================================================

// SQL SELECT cho san pham kem quan he (dung chung cho storefront + admin).
export const PRODUCT_SELECT = `
  SELECT p.*,
         c.name AS category_name,
         s.name AS supplier_name,
         r.name AS region_name
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN suppliers s ON s.id = p.supplier_id
  LEFT JOIN regions r ON r.id = p.region_id
`;

export function serializeProduct(row) {
  if (!row) return null;
  const { category_name, supplier_name, region_name, ...product } = row;
  return {
    ...product,
    category: row.category_id ? { id: row.category_id, name: category_name } : null,
    supplier: row.supplier_id ? { id: row.supplier_id, name: supplier_name } : null,
    region: row.region_id ? { id: row.region_id, name: region_name } : null,
  };
}

export function serializeProducts(rows) {
  return rows.map(serializeProduct);
}

// Bao response theo dinh dang phan trang Laravel.
export function paginated(data, { page, perPage, total }) {
  return {
    data,
    current_page: page,
    last_page: Math.max(1, Math.ceil(total / perPage)),
    per_page: perPage,
    total,
  };
}

// Cart: frontend adaptBackendCart can { id, status, item_count, total_quantity,
// subtotal, items[] } va moi item can { id, product_id, quantity, unit_price,
// line_total, product } (product day du de adaptBackendProduct xu ly).
export function serializeCart(cart, itemRows) {
  const items = itemRows.map((row) => ({
    id: row.id,
    product_id: row.product_id,
    quantity: row.quantity,
    unit_price: Number(row.unit_price),
    line_total: Number(row.line_total),
    product: serializeProduct({
      id: row.product_id,
      category_id: row.category_id,
      supplier_id: row.supplier_id,
      region_id: row.region_id,
      sku: row.sku,
      slug: row.slug,
      name: row.name,
      description: row.description,
      short_description: row.short_description,
      origin: row.origin,
      image_url: row.image_url,
      sale_price: row.sale_price,
      stock_quantity: row.stock_quantity,
      is_active: row.is_active,
      category_name: row.category_name,
      supplier_name: row.supplier_name,
      region_name: row.region_name,
    }),
  }));
  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    id: cart.id,
    status: cart.status,
    item_count: items.length,
    total_quantity: totalQuantity,
    subtotal,
    items,
  };
}

// Payment: adaptPayment() doc transaction_code, payment_method, payment_status,
// amount, gateway_name, gateway_reference, paid_at, raw_payload, created_at, updated_at.
export function serializePayment(payment) {
  if (!payment) return null;
  let rawPayload = payment.raw_payload;
  if (typeof rawPayload === 'string') {
    try { rawPayload = JSON.parse(rawPayload); } catch { rawPayload = null; }
  }
  return {
    id: payment.id,
    transaction_code: payment.transaction_code ?? null,
    payment_method: payment.payment_method ?? payment.provider ?? null,
    payment_status: payment.payment_status,
    amount: Number(payment.amount),
    gateway_name: payment.gateway_name ?? null,
    gateway_reference: payment.gateway_reference ?? null,
    paid_at: payment.paid_at ?? null,
    raw_payload: rawPayload ?? null,
    created_at: payment.created_at,
    updated_at: payment.updated_at ?? payment.created_at,
  };
}

// Order summary + detail. adaptBackendOrderSummary/Detail doc snake_case va can
// item_count, payment (long), items[], status_history[].
export function serializeOrderSummary(order, { itemCount = null, payment = null } = {}) {
  return {
    id: order.id,
    order_no: order.order_no,
    payment_method: order.payment_method,
    status: order.status,
    subtotal: Number(order.subtotal),
    shipping_fee: Number(order.shipping_fee),
    discount_amount: Number(order.discount_amount),
    total_amount: Number(order.total_amount),
    item_count: itemCount,
    payment: payment ? serializePayment(payment) : null,
    created_at: order.created_at,
    updated_at: order.updated_at ?? order.created_at,
  };
}

export function serializeOrderDetail(order, { items = [], statusHistory = [], payment = null } = {}) {
  return {
    ...serializeOrderSummary(order, { itemCount: items.length, payment }),
    recipient_name: order.recipient_name,
    recipient_phone: order.recipient_phone,
    shipping_address: order.shipping_address,
    note: order.note ?? '',
    shipping_code: order.shipping_code ?? null,
    shipping_carrier: order.shipping_carrier ?? null,
    shipped_at: order.shipped_at ?? null,
    delivered_at: order.delivered_at ?? null,
    cancelled_at: order.cancelled_at ?? null,
    items: items.map((item) => ({
      id: item.id,
      product_id: item.product_id,
      product_name_snapshot: item.product_name_snapshot,
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      line_total: Number(item.line_total),
    })),
    status_history: statusHistory.map((history) => ({
      id: history.id,
      changed_by_user_id: history.changed_by_user_id ?? null,
      from_status: history.from_status ?? null,
      to_status: history.to_status,
      note: history.note ?? null,
      changed_at: history.changed_at ?? history.created_at,
    })),
  };
}

export function parsePagination(query, { defaultPerPage = 15, maxPerPage = 100 } = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const perPage = Math.min(maxPerPage, Math.max(1, Number(query.per_page) || defaultPerPage));
  return { page, perPage, offset: (page - 1) * perPage };
}
