const express = require('express')
const { getAllOrders, createOrder } = require('../controllers/orderController')
const router = express.Router()
const { authenticateUser, authorizePermissions } = require('../middlewares/authentication')

router.get('/', authenticateUser, authorizePermissions('user'), getAllOrders)
router.post('/', authenticateUser, authorizePermissions('user'), createOrder)

module.exports = router