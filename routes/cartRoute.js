const express = require('express');
const router = express.Router();
const {
    getCart,
    updateCart,
    deleteItemFromCart,
    deleteAllItemsFromCart,
} = require('../controllers/cartController');
const { authenticateUser, authorizePermissions } = require('../middlewares/authentication');

// Get Cart
router.get('/', authenticateUser, authorizePermissions('user'), getCart);

// Update Cart
router.put(
    '/',
    authenticateUser,
    authorizePermissions('user'),
    updateCart
);

// Delete Item from Cart
router.delete(
    '/:productId',
    authenticateUser,
    authorizePermissions('user'),
    deleteItemFromCart
);

// Delete All Items from Cart
router.delete('/', authenticateUser, authorizePermissions('user'), deleteAllItemsFromCart);

module.exports = router;