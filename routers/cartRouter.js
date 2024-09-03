const express = require('express')
const { updateCart, getCart, deleteItemFromCart, deleteAllItemsFromCart } = require('../controllers/cartController')
const router = express.Router()
const { authenticateUser, authorizePermissions } = require('../middlewares/authentication')

router.get('/',authenticateUser,authorizePermissions('user'), getCart)
router.put('/', authenticateUser, authorizePermissions('user'), updateCart)
router.delete('/:id', authenticateUser, authorizePermissions('user') , deleteItemFromCart)
router.delete('/', authenticateUser, authorizePermissions('user'), deleteAllItemsFromCart)


module.exports = router