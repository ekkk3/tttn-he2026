import { query } from '../../config/db.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

// ---------------- Dashboard ----------------
// Frontend (admin-dashboard-page.jsx) đọc một response giàu: metrics, revenue_chart,
// top_customers, work_queue, low_stock_products, featured_products, recent_orders, filters.
// "Doanh thu thực thu" = đơn đã giao (DELIVERED). Xem UC 2.2.19 Báo cáo thống kê.
export const dashboard = asyncHandler(async (req, res) => {
  const chartRange = req.query.chart_range || '30d';
  const dateTo = req.query.date_to || new Date().toISOString().slice(0, 10);
  const dateFrom = req.query.date_from ||
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [settings] = await query('SELECT low_stock_threshold FROM admin_settings ORDER BY id ASC LIMIT 1');
  const lowStockThreshold = settings?.low_stock_threshold ?? 10;

  const countByStatus = async (statuses) => {
    const [{ c }] = await query(
      `SELECT COUNT(*) AS c FROM orders WHERE status IN (${statuses.map(() => '?').join(',')})`, statuses
    );
    return c;
  };

  const [{ revenue, successful_orders }] = await query(
    "SELECT COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS successful_orders FROM orders WHERE status = 'DELIVERED'"
  );
  const [{ today_revenue }] = await query(
    "SELECT COALESCE(SUM(total_amount),0) AS today_revenue FROM orders WHERE status = 'DELIVERED' AND DATE(delivered_at) = CURDATE()"
  );
  const [{ product_count }] = await query('SELECT COUNT(*) AS product_count FROM products WHERE is_deleted = 0 AND is_active = 1');
  const [{ low_stock_products }] = await query(
    'SELECT COUNT(*) AS low_stock_products FROM products WHERE is_deleted = 0 AND stock_quantity <= ?', [lowStockThreshold]
  );
  const [{ customer_reported_transfer }] = await query(
    "SELECT COUNT(*) AS customer_reported_transfer FROM orders WHERE status = 'AWAITING_PAYMENT_CONFIRMATION'"
  );

  const metrics = {
    revenue: Number(revenue),
    successful_orders,
    processing_orders: await countByStatus(['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED']),
    pending_orders: await countByStatus(['PENDING']),
    bank_transfer_pending: await countByStatus(['AWAITING_PAYMENT_CONFIRMATION']),
    customer_reported_transfer,
    shipping_orders: await countByStatus(['SHIPPED']),
    delivery_failed_orders: await countByStatus(['DELIVERY_FAILED']),
    low_stock_products,
    low_stock_threshold: lowStockThreshold,
    average_order_value: successful_orders > 0 ? Math.round(Number(revenue) / successful_orders) : 0,
    today_revenue: Number(today_revenue),
    product_count,
  };

  // Biểu đồ doanh thu theo ngày (số ngày tùy chart_range).
  const days = chartRange === '7d' ? 7 : chartRange === 'this_month' ? new Date().getDate() : 30;
  const revenueRows = await query(
    `SELECT DATE(delivered_at) AS d, COALESCE(SUM(total_amount),0) AS revenue, COUNT(*) AS successful_orders
     FROM orders WHERE status = 'DELIVERED' AND delivered_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(delivered_at) ORDER BY d ASC`,
    [days]
  );
  // Cùng kỹ thuật với supplierController.myRevenue: SQL chỉ trả về NGÀY CÓ dữ liệu, nên phải
  // tự dựng đủ chuỗi ngày liên tiếp ở đây, ngày nào thiếu thì mặc định revenue = 0.
  const revenueMap = new Map(revenueRows.map((r) => [r.d, r]));
  const revenue_chart = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    const row = revenueMap.get(key);
    revenue_chart.push({
      label: `${date.getDate()}/${date.getMonth() + 1}`,
      revenue: row ? Number(row.revenue) : 0,
      successful_orders: row ? row.successful_orders : 0,
    });
  }

  const top_customers = await query(
    `SELECT u.id, u.full_name, u.email, COUNT(o.id) AS successful_orders,
            COALESCE(SUM(o.total_amount),0) AS total_revenue, MAX(o.delivered_at) AS last_delivered_at
     FROM users u JOIN orders o ON o.user_id = u.id AND o.status = 'DELIVERED'
     GROUP BY u.id ORDER BY total_revenue DESC LIMIT 5`
  );

  const recentOrders = await query(
    `SELECT o.*, u.full_name AS customer_name,
            (SELECT payment_status FROM payments WHERE order_id = o.id ORDER BY id DESC LIMIT 1) AS payment_status
     FROM orders o LEFT JOIN users u ON u.id = o.user_id ORDER BY o.id DESC LIMIT 8`
  );
  const withCustomer = (o) => ({ ...o, customer: { full_name: o.customer_name }, total_amount: Number(o.total_amount) });
  const recent_orders = recentOrders.map(withCustomer);

  // Định nghĩa 1 danh sách "nhóm trạng thái cần xử lý" rồi LẶP QUA để query từng nhóm —
  // thêm/bớt 1 nhóm ở đây tự động thêm/bớt 1 cột trong work_queue trả về, không cần sửa
  // logic bên dưới.
  const queueGroups = [
    { key: 'pending', label: 'Chờ xác nhận', statuses: ['PENDING'] },
    { key: 'transfer', label: 'Chờ xác nhận chuyển khoản', statuses: ['AWAITING_PAYMENT_CONFIRMATION'] },
    { key: 'packing', label: 'Chờ đóng gói / giao', statuses: ['CONFIRMED', 'PACKED'] },
    { key: 'shipping', label: 'Đang giao', statuses: ['SHIPPED'] },
  ];
  const work_queue = [];
  for (const g of queueGroups) {
    const orders = await query(
      `SELECT o.*, u.full_name AS customer_name,
              (SELECT payment_status FROM payments WHERE order_id = o.id ORDER BY id DESC LIMIT 1) AS payment_status
       FROM orders o LEFT JOIN users u ON u.id = o.user_id
       WHERE o.status IN (${g.statuses.map(() => '?').join(',')}) ORDER BY o.id DESC LIMIT 5`,
      g.statuses
    );
    work_queue.push({ key: g.key, label: g.label, count: orders.length, orders: orders.map(withCustomer) });
  }

  const lowStockList = await query(
    'SELECT id, name, sku, sale_price, stock_quantity FROM products WHERE is_deleted = 0 AND stock_quantity <= ? ORDER BY stock_quantity ASC LIMIT 6',
    [lowStockThreshold]
  );

  // "Sản phẩm bán chạy": chỉ tính đơn ĐÃ GIAO, cùng bộ lọc trạng thái với metrics.revenue.
  // (Lưu ý: tổng cột revenue ở bảng này KHÔNG bằng đúng metrics.revenue, vì metrics.revenue
  // cộng orders.total_amount — đã gồm phí vận chuyển và trừ giảm giá — còn ở đây cộng
  // order_items.line_total tức chỉ tiền hàng. Phí ship không quy được về từng sản phẩm nên
  // chênh lệch này là đúng bản chất, không phải lỗi.)
  // Trước đây điều kiện lọc nằm trong mệnh đề ON của LEFT JOIN:
  //     LEFT JOIN orders o ON o.id = oi.order_id AND o.status = 'DELIVERED'
  // LEFT JOIN không loại dòng nào cả — dòng order_items thuộc đơn PENDING/CANCELLED vẫn còn
  // (chỉ là cột o.* thành NULL) và vẫn được SUM, nên bảng này cộng cả hàng chưa giao. Kết quả:
  // cùng 1 màn hình báo tổng doanh thu 640.000đ nhưng liệt kê 1 sản phẩm 2.520.000đ.
  // Không chuyển điều kiện xuống WHERE được, vì làm vậy sẽ loại luôn sản phẩm CHƯA bán được
  // dòng nào (mất ý nghĩa của LEFT JOIN). Cách đúng là lọc ngay trong hàm tổng hợp:
  const featured = await query(
    `SELECT p.id, p.sku, p.name, p.stock_quantity,
            COALESCE(SUM(CASE WHEN o.status = 'DELIVERED' THEN oi.quantity   ELSE 0 END),0) AS sold_quantity,
            COALESCE(SUM(CASE WHEN o.status = 'DELIVERED' THEN oi.line_total ELSE 0 END),0) AS revenue
     FROM products p
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON o.id = oi.order_id
     WHERE p.is_deleted = 0
     GROUP BY p.id ORDER BY sold_quantity DESC, p.id DESC LIMIT 5`
  );

  res.json({
    data: {
      filters: { date_from: dateFrom, date_to: dateTo, chart_range: chartRange },
      metrics,
      revenue_chart,
      top_customers: top_customers.map((c) => ({ ...c, total_revenue: Number(c.total_revenue) })),
      work_queue,
      low_stock_products: lowStockList.map((p) => ({ ...p, sale_price: Number(p.sale_price) })),
      featured_products: featured.map((p) => ({ ...p, revenue: Number(p.revenue), sold_quantity: Number(p.sold_quantity) })),
      recent_orders,
    },
  });
});
