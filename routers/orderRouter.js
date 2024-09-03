const express = require('express')
const { getAllOrders, getMyOrders, getUserOrders, createOrder, updateSubOrderStatus, cancelOrder, cancelSubOrder, getOrder, getSubOrder } = require('../controllers/orderController')
const router = express.Router()
const { authenticateUser, authorizePermissions } = require('../middlewares/authentication')

// admin routes
router.get('/', authenticateUser, authorizePermissions('admin'), getAllOrders)
router.get('/myorders', authenticateUser, authorizePermissions('seller', 'user'), getMyOrders)
router.get('/:id/orders', authenticateUser, authorizePermissions('admin'), getUserOrders)


// user routes
router.post('/', authenticateUser, authorizePermissions('user'), createOrder)
router.delete('/:id', authenticateUser, authorizePermissions('user'), cancelOrder)
router.delete('/suborders/:id', authenticateUser, authorizePermissions('user'), cancelSubOrder)


router.put('/:id', authenticateUser, authorizePermissions('seller', 'admin'), updateSubOrderStatus)
router.get('/seller/:id', authenticateUser, authorizePermissions('seller', 'admin'), getSubOrder)
router.get('/:id', authenticateUser, authorizePermissions('admin', 'user'), getOrder)


module.exports = router