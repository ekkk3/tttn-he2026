import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

import * as authController from '../controllers/authController.js';
import * as accountController from '../controllers/accountController.js';
import * as categoryController from '../controllers/categoryController.js';
import * as productController from '../controllers/productController.js';
import * as regionController from '../controllers/regionController.js';
import * as supplierController from '../controllers/supplierController.js';
import * as cartController from '../controllers/cartController.js';
import * as orderController from '../controllers/orderController.js';
import * as ghnLocationController from '../controllers/ghnLocationController.js';
import * as misc from '../controllers/miscController.js';
import * as operationController from '../controllers/operationController.js';
import * as chatController from '../controllers/chatController.js';
import * as reviewController from '../controllers/reviewController.js';
import * as voucherController from '../controllers/voucherController.js';
import * as admin from '../controllers/admin/admin.controller.js';
import { uploadSupplierLicense } from '../middleware/upload.js';

const router = Router();

// ==================================================================
// Route nay duoc sap xep DUNG THEO THU TU cua routes/api.php ben repo
// Laravel goc, de tien doi chieu tung dong khi ban tiep tuc phat trien.
// ==================================================================

// ---------------- Public ----------------
router.post('/register', authController.register);
router.post('/login', authController.login);

// Bo sung Tuan 1: quen mat khau + dang nhap Google/Facebook (ngoai pham vi UC goc).
router.post('/password/forgot', authController.forgotPassword);
router.post('/password/reset', authController.resetPassword);
router.post('/auth/google', authController.loginWithGoogle);
router.post('/auth/facebook', authController.loginWithFacebook);

// UC 2.2.12a: Dang ky Nha cung cap (public, cho Admin duyet o UC 2.2.12b ben duoi).
router.post('/suppliers/apply', uploadSupplierLicense, supplierController.apply);

router.get('/products', productController.index);
router.get('/products/:id', productController.show);
router.get('/products/:id/reviews', reviewController.listForProduct);
router.get('/regions', regionController.index);
router.post('/newsletter-subscriptions', misc.subscribeNewsletter);
router.get('/shipping/ghn/provinces', ghnLocationController.provinces);
router.get('/shipping/ghn/districts', ghnLocationController.districts);
router.get('/shipping/ghn/wards', ghnLocationController.wards);

router.get('/posts', misc.listPosts);

router.get('/categories', categoryController.index);
router.get('/categories/:category', categoryController.show);
router.get('/categories/:category/products', categoryController.getProducts);

router.get('/suppliers', supplierController.index);
router.get('/suppliers/:supplier', supplierController.show);
router.get('/suppliers/:supplier/products', supplierController.getProducts);

router.get('/test', (req, res) => res.send('ok'));

// Tinh nang moi so voi Laravel: AI Chatbot (dien theo de cuong, chua co ben Laravel).
router.post('/chat', chatController.chat);

// ---------------- Authenticated (tuong duong middleware 'auth:sanctum') ----------------
router.use(auth);

router.get('/me', authController.me);
router.post('/logout', authController.logout);
router.get('/account/profile', accountController.showProfile);
router.put('/account/profile', accountController.updateProfile);
router.patch('/account/password', accountController.changePassword);
router.post('/account/addresses', accountController.storeAddress);
router.put('/account/addresses/:address', accountController.updateAddress);
router.delete('/account/addresses/:address', accountController.destroyAddress);
router.patch('/account/addresses/:address/default', accountController.setDefaultAddress);
router.post('/account/rewards/redeem', accountController.redeemReward);
router.get('/account/wishlist', accountController.wishlist);
router.post('/account/wishlist/items', accountController.storeWishlistItem);
router.delete('/account/wishlist/items/:product', accountController.destroyWishlistItem);

router.get('/notifications', misc.listNotifications);
router.patch('/notifications/:notification/read', misc.markNotificationRead);

router.get('/complaints', misc.listComplaints);
router.post('/complaints', misc.storeComplaint);

router.get('/posts/my-likes', misc.myLikedPosts);
router.post('/posts/:post/comments', misc.storeComment);
router.post('/posts/:post/likes', misc.likePost);
router.delete('/posts/:post/likes', misc.unlikePost);

router.post('/products/:id/reviews', reviewController.store);

router.get('/cart', cartController.show);
router.post('/cart/items', cartController.storeItem);
router.patch('/cart/items/:cartItem', cartController.updateItem);
router.delete('/cart/items/:cartItem', cartController.destroyItem);

router.post('/vouchers/apply', voucherController.apply);

router.post('/orders/checkout', orderController.checkout);
router.get('/orders', orderController.index);
router.get('/orders/:order', orderController.show);
router.patch('/orders/:order/cancel', orderController.cancel);
router.patch('/orders/:order/bank-transfer-submitted', orderController.confirmBankTransferSubmitted);
router.patch('/orders/:order/confirm-delivery', orderController.confirmDelivery);

router.get('/support-tickets', misc.listSupportTickets);
router.post('/support-tickets', misc.storeSupportTicket);
router.patch('/support-tickets/:ticket/resolve', misc.resolveSupportTicket);

// ---------------- Warehouse staff: /api/operations/* ----------------
const operations = Router();
operations.get('/inventory', operationController.inventory);
operations.get('/requisitions', operationController.requisitions);
operations.post('/requisitions', operationController.storeRequisition);
operations.patch('/requisitions/:id/status', operationController.updateRequisitionStatus);
operations.get('/supplier-orders', operationController.supplierOrders);
operations.get('/fulfillment-tasks', operationController.fulfillmentTasks);
operations.patch('/orders/:order/delivery-status', operationController.updateOrderDeliveryStatus);
operations.patch('/fulfillment-tasks/:order/advance', operationController.advanceFulfillmentTask);
router.use('/operations', requireRole('WAREHOUSE_STAFF', 'ADMIN', 'SUPPLIER'), operations);

// ---------------- Nha cung cap quan ly san pham cua minh (UC 2.2.15) ----------------
const supplierPortal = Router();
supplierPortal.get('/products', supplierController.myProducts);
supplierPortal.post('/products', supplierController.storeMyProduct);
supplierPortal.put('/products/:id', supplierController.updateMyProduct);
supplierPortal.get('/revenue', supplierController.myRevenue);
router.use('/supplier', requireRole('SUPPLIER'), supplierPortal);

// ---------------- Admin: /api/admin/* ----------------
const adminRouter = Router();
adminRouter.get('/dashboard', admin.dashboard);
adminRouter.get('/complaints', misc.adminListComplaints);
adminRouter.patch('/complaints/:complaint/resolve', misc.adminResolveComplaint);
adminRouter.get('/reviews', reviewController.adminList);
adminRouter.patch('/reviews/:id/moderate', reviewController.adminModerate);
adminRouter.get('/vouchers', voucherController.adminList);
adminRouter.post('/vouchers', voucherController.adminStore);
adminRouter.put('/vouchers/:voucher', voucherController.adminUpdate);
adminRouter.delete('/vouchers/:voucher', voucherController.adminDestroy);
adminRouter.get('/community', admin.listCommunity);
adminRouter.post('/community/invitations', admin.storeInvitation);
adminRouter.get('/posts', admin.listAdminPosts);
adminRouter.post('/posts', admin.storePost);
adminRouter.put('/posts/:post', admin.updatePost);
adminRouter.delete('/posts/:post', admin.destroyPost);
adminRouter.patch('/posts/comments/:comment/visibility', admin.updateCommentVisibility);
adminRouter.get('/settings', admin.showSettings);
adminRouter.put('/settings', admin.updateSettings);
adminRouter.get('/shipping-carriers', admin.listShippingCarriers);
adminRouter.post('/shipping-carriers', admin.storeShippingCarrier);
adminRouter.put('/shipping-carriers/:carrier', admin.updateShippingCarrier);
adminRouter.delete('/shipping-carriers/:carrier', admin.destroyShippingCarrier);
adminRouter.get('/users', admin.listUsers);
adminRouter.get('/users/:user', admin.showUser);
adminRouter.get('/users/:user/orders', admin.userOrders);
adminRouter.post('/users', admin.storeUser);
adminRouter.put('/users/:user', admin.updateUser);
adminRouter.delete('/users/:user', admin.destroyUser);
adminRouter.get('/admins', admin.listAdmins);
adminRouter.post('/admins', admin.storeAdmin);
adminRouter.put('/admins/:admin', admin.updateAdmin);
adminRouter.patch('/admins/:admin/status', admin.updateAdminStatus);
adminRouter.patch('/admins/:admin/password', admin.updateAdminPassword);

adminRouter.get('/products', admin.listProducts);
adminRouter.get('/products/:id', admin.showProduct);
adminRouter.post('/products', admin.storeProduct);
adminRouter.put('/products/:id', admin.updateProduct);
adminRouter.patch('/products/:id/status', admin.updateProductStatus);
adminRouter.delete('/products/:id', admin.destroyProduct);

adminRouter.get('/orders', admin.listOrders);
adminRouter.get('/orders/:order', admin.showOrder);
adminRouter.post('/orders/bulk-status', admin.bulkUpdateStatus);
adminRouter.patch('/orders/:order/status', admin.updateOrderStatus);
adminRouter.patch('/orders/:order/payment-status', admin.updatePaymentStatus);
adminRouter.post('/orders/:order/shipment', admin.storeShipment);
adminRouter.post('/orders/:order/shipment/sync', admin.syncShipment);
adminRouter.delete('/orders/:order/shipment', admin.destroyShipment);
router.use('/admin', requireRole('ADMIN'), adminRouter);

const adminCategories = Router();
adminCategories.get('/', categoryController.adminIndex);
adminCategories.post('/', categoryController.store);
adminCategories.put('/:category', categoryController.update);
adminCategories.delete('/:category', categoryController.destroy);
router.use('/admin/categories', requireRole('ADMIN'), adminCategories);

const adminSuppliers = Router();
adminSuppliers.get('/', supplierController.adminIndex);
adminSuppliers.get('/pending', supplierController.pending);
adminSuppliers.post('/', supplierController.store);
adminSuppliers.put('/:supplier', supplierController.update);
adminSuppliers.delete('/:supplier', supplierController.destroy);
adminSuppliers.patch('/:supplier/approve', supplierController.approve);
adminSuppliers.patch('/:supplier/reject', supplierController.reject);
router.use('/admin/suppliers', requireRole('ADMIN'), adminSuppliers);

export default router;
