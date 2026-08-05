import { describe, expect, it } from 'vitest';
import {
  PASSWORD_MIN_LENGTH,
  validateEmail,
  validateNewPassword,
  validateOptionalPhone,
  validatePhone,
  validatePositiveQuantity,
  validateProductPricing,
} from '../../utils/validators.js';

describe('validateProductPricing', () => {
  it('rejects a zero or negative sale_price', () => {
    expect(validateProductPricing({ sale_price: 0 })).toMatch(/lớn hơn 0/);
    expect(validateProductPricing({ sale_price: -50000 })).toMatch(/lớn hơn 0/);
  });

  it('accepts a positive sale_price', () => {
    expect(validateProductPricing({ sale_price: 120000 })).toBeNull();
  });

  it('requires sale_price only when requireSalePrice is set (create vs partial update)', () => {
    expect(validateProductPricing({}, { requireSalePrice: true })).toMatch(/lớn hơn 0/);
    // Cap nhat mot phan: khong gui sale_price la hop le (giu nguyen gia cu).
    expect(validateProductPricing({ stock_quantity: 5 })).toBeNull();
  });

  it('rejects a negative or non-integer stock_quantity', () => {
    expect(validateProductPricing({ stock_quantity: -1 })).toMatch(/số nguyên không âm/);
    expect(validateProductPricing({ stock_quantity: 1.5 })).toMatch(/số nguyên không âm/);
  });

  it('accepts zero stock_quantity (out of stock is valid, not an error)', () => {
    expect(validateProductPricing({ sale_price: 1000, stock_quantity: 0 })).toBeNull();
  });
});

describe('validateEmail', () => {
  it('accepts a normal email', () => {
    expect(validateEmail('customer@example.com')).toBeNull();
  });

  it.each(['', 'not-an-email', 'missing-domain@', '@missing-local.com', 'has space@example.com'])(
    'rejects invalid email "%s"',
    (value) => {
      expect(validateEmail(value)).toMatch(/không hợp lệ/);
    }
  );
});

describe('validatePhone', () => {
  it('accepts common Vietnamese mobile formats, with or without separators', () => {
    expect(validatePhone('0912345678')).toBeNull();
    expect(validatePhone('091 234 5678')).toBeNull();
    expect(validatePhone('+84912345678')).toBeNull();
    expect(validatePhone('84912345678')).toBeNull();
  });

  it('rejects letters, too-short numbers, and missing values', () => {
    expect(validatePhone('abcxyz')).toMatch(/không hợp lệ/);
    expect(validatePhone('012345')).toMatch(/không hợp lệ/);
    expect(validatePhone('')).toMatch(/bắt buộc/);
    expect(validatePhone(undefined)).toMatch(/bắt buộc/);
  });
});

describe('validateOptionalPhone', () => {
  it('allows blank (field is optional)', () => {
    expect(validateOptionalPhone('')).toBeNull();
    expect(validateOptionalPhone(undefined)).toBeNull();
  });

  it('still validates format once a value is provided', () => {
    expect(validateOptionalPhone('not-a-phone')).toMatch(/không hợp lệ/);
    expect(validateOptionalPhone('0912345678')).toBeNull();
  });
});

describe('validateNewPassword', () => {
  it(`rejects passwords shorter than ${PASSWORD_MIN_LENGTH} characters`, () => {
    expect(validateNewPassword('short1')).toMatch(new RegExp(`ít nhất ${PASSWORD_MIN_LENGTH}`));
  });

  it('rejects missing password instead of letting it fall through to bcrypt', () => {
    // Ho hai L09/L10 that: thieu new_password truoc day khong bi chan o day nen roi xuong
    // bcrypt.compare(undefined, hash) -> nem loi -> HTTP 500 thay vi 422 co y nghia.
    expect(validateNewPassword(undefined)).toMatch(/bắt buộc/);
    expect(validateNewPassword('')).toMatch(/bắt buộc/);
  });

  it('accepts a password meeting the minimum length', () => {
    expect(validateNewPassword('Abcdefgh1')).toBeNull();
  });

  it('rejects when confirmation does not match', () => {
    expect(validateNewPassword('Abcdefgh1', 'Different1')).toMatch(/xác nhận chưa khớp/);
  });

  it('ignores confirmation entirely when not passed (forms without a "nhập lại" field)', () => {
    expect(validateNewPassword('Abcdefgh1')).toBeNull();
  });
});

describe('validatePositiveQuantity', () => {
  it('rejects zero, negative, and non-integer quantities', () => {
    expect(validatePositiveQuantity(0)).toMatch(/lớn hơn 0/);
    expect(validatePositiveQuantity(-5)).toMatch(/lớn hơn 0/);
    expect(validatePositiveQuantity(2.5)).toMatch(/lớn hơn 0/);
  });

  it('accepts a positive integer', () => {
    expect(validatePositiveQuantity(10)).toBeNull();
  });

  it('includes the custom label in the message', () => {
    expect(validatePositiveQuantity(-1, 'Số lượng duyệt nhập')).toContain('Số lượng duyệt nhập');
  });
});
