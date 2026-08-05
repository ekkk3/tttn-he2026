import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/vitest.setup.js'],
    globalSetup: ['./src/test/vitest.global-setup.js'],
    // Nhieu file test dung CHUNG 1 CSDL that (ecommerce_test) — chay song song se dam vao
    // nhau (vd 2 file cung tao user cung email, hoac cung TRUNCATE bang nguoi khac dang doc).
    // Khong co nhieu test nen chay tuan tu khong lam cham dang ke, doi lai chac chan dung.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 20000,
  },
});
