const express = require('express')
const { authenticateUser, authorizePermissions } = require('../middlewares/authentication')
const { createStripeAccount, generateAccountLink, withDrawBalance, checkAccountIsActive, getExternalAccount } = require('../controllers/paymentController')
const router = express.Router()


router.post('/create_stripe_account',authenticateUser, authorizePermissions('seller'), createStripeAccount)
router.post('/generate_account_link', authenticateUser, authorizePermissions('seller'), generateAccountLink)
router.post('/withdraw', authenticateUser, authorizePermissions('seller'), withDrawBalance)
router.get('/check-acount-status', authenticateUser, authorizePermissions('seller'), checkAccountIsActive)
// router.post('/get-external-acount', authenticateUser, authorizePermissions('seller'), getExternalAccount)
module.exports = router