import { describe, expect, it } from 'vitest';
import { escapeLike } from '../../utils/sql.js';

describe('escapeLike', () => {
  it('escapes % so it stops matching "any string"', () => {
    expect(escapeLike('100%')).toBe('100\\%');
  });

  it('escapes _ so it stops matching "any single character"', () => {
    // Bug that motivated this function: gõ "_" trơn phải KHÔNG khớp mọi sản phẩm.
    expect(escapeLike('_')).toBe('\\_');
  });

  it('escapes backslash FIRST, before % and _', () => {
    // Neu escape % / _ truoc roi moi escape backslash, cac dau \ moi them vao se bi
    // chinh buoc backslash nhan doi lan nua -> sai. Thu tu dung phai la \\ -> \% -> \_.
    expect(escapeLike('\\_')).toBe('\\\\\\_');
  });

  it('leaves normal text untouched', () => {
    expect(escapeLike('nuoc mam phu quoc')).toBe('nuoc mam phu quoc');
  });

  it('coerces non-string input instead of throwing', () => {
    expect(escapeLike(123)).toBe('123');
  });
});
