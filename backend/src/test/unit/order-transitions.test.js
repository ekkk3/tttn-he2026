import { describe, expect, it } from 'vitest';
import { ORDER_TRANSITIONS, PAYMENT_TRANSITIONS } from '../../services/orderTransitions.js';

describe('ORDER_TRANSITIONS', () => {
  it('has DELIVERED and CANCELLED as terminal states (no further transitions)', () => {
    expect(ORDER_TRANSITIONS.DELIVERED).toEqual([]);
    expect(ORDER_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it('never lets a shipped/packed/confirmed order jump backward to PENDING', () => {
    // Day chinh la dieu "state machine rat chuan" da duoc xac nhan qua nhieu dot kiem thu
    // song (Dot 9): khong trang thai nao duoc phep quay nguoc ve PENDING.
    for (const [from, nextStates] of Object.entries(ORDER_TRANSITIONS)) {
      if (from === 'PENDING') continue;
      expect(nextStates).not.toContain('PENDING');
    }
  });

  it('only reaches DELIVERED by going through SHIPPED (no shortcuts)', () => {
    for (const [from, nextStates] of Object.entries(ORDER_TRANSITIONS)) {
      if (from === 'SHIPPED') continue;
      expect(nextStates).not.toContain('DELIVERED');
    }
  });

  it('allows CANCELLED from every non-terminal, non-shipping state', () => {
    expect(ORDER_TRANSITIONS.PENDING).toContain('CANCELLED');
    expect(ORDER_TRANSITIONS.CONFIRMED).toContain('CANCELLED');
    expect(ORDER_TRANSITIONS.PACKED).toContain('CANCELLED');
  });
});

describe('PAYMENT_TRANSITIONS', () => {
  it('has REFUNDED as a terminal state', () => {
    expect(PAYMENT_TRANSITIONS.REFUNDED).toEqual([]);
  });

  it('only allows REFUNDED to be reached from SUCCESS (must have been paid first)', () => {
    for (const [from, nextStates] of Object.entries(PAYMENT_TRANSITIONS)) {
      if (from === 'SUCCESS') continue;
      expect(nextStates).not.toContain('REFUNDED');
    }
  });

  it('allows retrying a FAILED payment (back to PENDING or straight to SUCCESS)', () => {
    expect(PAYMENT_TRANSITIONS.FAILED).toContain('PENDING');
    expect(PAYMENT_TRANSITIONS.FAILED).toContain('SUCCESS');
  });
});
