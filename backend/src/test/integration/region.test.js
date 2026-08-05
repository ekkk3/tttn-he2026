import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import { createRegion } from '../helpers.js';
import { query } from '../../config/db.js';

describe('GET /api/regions', () => {
  it('returns only active regions', async () => {
    const active = await createRegion();
    const inactiveRow = await createRegion();
    await query('UPDATE regions SET is_active = 0 WHERE id = ?', [inactiveRow.id]);

    const res = await request(app).get('/api/regions');
    expect(res.status).toBe(200);
    const ids = res.body.data.map((r) => r.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(inactiveRow.id);
  });
});
