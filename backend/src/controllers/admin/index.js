// Barrel: gom lai toan bo handler admin.* da duoc tach theo domain (xem cac file
// *.controller.js trong thu muc nay). routes/api.routes.js import mot lan tu day
// (import * as admin from '../controllers/admin/index.js') nen thu tu route khong doi.
export * from './dashboard.controller.js';
export * from './users.controller.js';
export * from './admins.controller.js';
export * from './products.controller.js';
export * from './orders.controller.js';
export * from './shipping-carriers.controller.js';
export * from './settings.controller.js';
export * from './community.controller.js';
export * from './posts.controller.js';
