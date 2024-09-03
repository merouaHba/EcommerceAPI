const express = require('express')
const router = express.Router()

const { register,
    login,
    logout,
    verifyEmail,
    forgotPassword,
    resetPassword,
    changePassword,
    resendVerificationEmail, } = require('../controllers/authController')
const { authenticateUser } = require('../middlewares/authentication')

router.post('/register', register)
router.post('/login', login)
router.delete('/logout', authenticateUser, logout);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification-email', resendVerificationEmail);
router.post('/reset-password', resetPassword);
router.post('/forgot-password', forgotPassword);
router.patch('/change-password',authenticateUser ,changePassword);

module.exports = router