import { describe, expect, it } from 'vitest';
import { localDateIso } from '../../utils/dates.js';

describe('localDateIso', () => {
  it('formats using LOCAL time, not UTC (regression for the UTC+7 midnight bug)', () => {
    // 2026-01-05 02:30 gio may chu (VD UTC+7) van la ngay 05, du toISOString() se lui ve
    // ngay 04 (gio UTC). Dung Date(...) voi tham so nam/thang/ngay/gio de luon phan anh
    // dung "gio dia phuong cua may chay test", bat ke may do dat mui gio nao.
    const earlyMorning = new Date(2026, 0, 5, 2, 30);
    expect(localDateIso(earlyMorning)).toBe('2026-01-05');
  });

  it('pads single-digit month and day with a leading zero', () => {
    const date = new Date(2026, 2, 7); // thang 3 (index 2), ngay 7
    expect(localDateIso(date)).toBe('2026-03-07');
  });

  it('defaults to "now" when called without an argument', () => {
    expect(localDateIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
