import { describe, expect, it } from 'vitest';
import { computeVoucherDiscount } from '../../controllers/voucherController.js';

function baseVoucher(overrides = {}) {
  return {
    is_active: 1,
    discount_type: 'PERCENT',
    discount_value: 10,
    min_order_amount: 0,
    max_discount_amount: null,
    usage_limit: null,
    used_count: 0,
    starts_at: null,
    expires_at: null,
    ...overrides,
  };
}

describe('computeVoucherDiscount', () => {
  it('computes a PERCENT discount rounded to the nearest đồng', () => {
    const voucher = baseVoucher({ discount_type: 'PERCENT', discount_value: 10 });
    expect(computeVoucherDiscount(voucher, 235000)).toBe(23500);
  });

  it('applies a FIXED discount as-is', () => {
    const voucher = baseVoucher({ discount_type: 'FIXED', discount_value: 30000 });
    expect(computeVoucherDiscount(voucher, 235000)).toBe(30000);
  });

  it('caps a PERCENT discount at max_discount_amount', () => {
    const voucher = baseVoucher({ discount_type: 'PERCENT', discount_value: 50, max_discount_amount: 50000 });
    // 50% cua 1.000.000 = 500.000, nhung tran la 50.000.
    expect(computeVoucherDiscount(voucher, 1000000)).toBe(50000);
  });

  it('never discounts more than the order subtotal (no negative total)', () => {
    const voucher = baseVoucher({ discount_type: 'FIXED', discount_value: 500000 });
    expect(computeVoucherDiscount(voucher, 100000)).toBe(100000);
  });

  it('rejects an inactive or missing voucher', () => {
    expect(() => computeVoucherDiscount(null, 100000)).toThrow(/không tồn tại hoặc đã tắt/);
    expect(() => computeVoucherDiscount(baseVoucher({ is_active: 0 }), 100000)).toThrow(/không tồn tại hoặc đã tắt/);
  });

  it('rejects a voucher that has not started yet', () => {
    const voucher = baseVoucher({ starts_at: new Date(Date.now() + 86_400_000).toISOString() });
    expect(() => computeVoucherDiscount(voucher, 100000)).toThrow(/chưa có hiệu lực/);
  });

  it('rejects an expired voucher', () => {
    const voucher = baseVoucher({ expires_at: new Date(Date.now() - 86_400_000).toISOString() });
    expect(() => computeVoucherDiscount(voucher, 100000)).toThrow(/đã hết hạn/);
  });

  it('rejects a voucher that has exhausted its usage_limit', () => {
    const voucher = baseVoucher({ usage_limit: 5, used_count: 5 });
    expect(() => computeVoucherDiscount(voucher, 100000)).toThrow(/hết lượt sử dụng/);
  });

  it('rejects an order below min_order_amount', () => {
    const voucher = baseVoucher({ min_order_amount: 300000 });
    expect(() => computeVoucherDiscount(voucher, 200000)).toThrow(/tối thiểu/);
  });

  it('every rejection throws with status 422 (so the controller returns a clean 4xx, not a 500)', () => {
    try {
      computeVoucherDiscount(null, 100000);
      throw new Error('should have thrown');
    } catch (err) {
      expect(err.status).toBe(422);
    }
  });
});
