const express = require('express')
const { getAllDiscounts, generateDiscount, deleteDiscount ,getDiscount, verifyDiscount, updateDiscount} = require('../controllers/discountController')
const router = express.Router()
const { authenticateUser, authorizePermissions } = require('../middlewares/authentication')

router.get('/', authenticateUser, authorizePermissions('admin'), getAllDiscounts)
router.post('/', authenticateUser,authorizePermissions('admin'), generateDiscount)
router.get('/discount', authenticateUser,authorizePermissions('admin'), getDiscount)
router.put('/discount', authenticateUser,authorizePermissions('admin'), updateDiscount)
router.get('/verify-discount', authenticateUser, verifyDiscount)
router.delete('/', authenticateUser, authorizePermissions('admin') ,deleteDiscount)



module.exports = router