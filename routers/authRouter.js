const express = require('express')
const router = express.Router()
const passport = require('passport');
const { attachCookiesToResponse, createTokenUser, createJWT, sendVerificationEmail, sendResetPasswordEmail } = require('../utils');
const { register,
    login,
    refreshToken,
    logout,
    verifyEmail,
    forgotPassword,
    resetPassword,
    changePassword,
    resendVerificationEmail, checkAuthCookies, checkErrorCookies, 
    googleAuth,
    googleCallback,
    facebookAuth,
    facebookCallback} = require('../controllers/authController')
const { authenticateUser } = require('../middlewares/authentication');
const { CustomAPIError } = require('../errors');

router.post('/register', register)
router.post('/login', login)
router.get('/refresh-token', refreshToken)
router.delete('/logout', authenticateUser, logout);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification-email', resendVerificationEmail);
router.post('/reset-password', resetPassword);
router.post('/forgot-password', forgotPassword);
router.put('/change-password',authenticateUser ,changePassword);
router.post('/check-auth-cookies', authenticateUser, checkAuthCookies);
router.get('/check-error-cookies', checkErrorCookies);




router.get('/google',googleAuth);

router.get('/google/callback',googleCallback);
router.get('/facebook',facebookAuth )

router.get('/facebook/callback',facebookCallback);
// router.get('/apple',
//     passport.authenticate('apple', { scope: ['profile'] }));

// router.get('/apple/callback',
//     passport.authenticate('apple', { failureRedirect: '/login' }),
//     function (req, res) {
//         // Successful authentication, redirect home.
//         res.redirect('/');
//     });

module.exports = router