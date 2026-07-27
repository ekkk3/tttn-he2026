// Barrel: gom lại toàn bộ handler admin.* đã được tách theo domain (xem các file
// *.controller.js trong thư mục này). routes/api.routes.js import một lần từ đây
// (import * as admin from '../controllers/admin/index.js') nên thứ tự route không đổi.
export * from './dashboard.controller.js';
export * from './users.controller.js';
export * from './admins.controller.js';
export * from './products.controller.js';
export * from './orders.controller.js';
export * from './shipping-carriers.controller.js';
export * from './settings.controller.js';
export * from './community.controller.js';
export * from './posts.controller.js';
