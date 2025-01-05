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
    resendVerificationEmail, } = require('../controllers/authController')
const { authenticateUser } = require('../middlewares/authentication');
const { StatusCodes } = require('http-status-codes');

router.post('/register', register)
router.post('/login', login)
router.get('/refresh-token', refreshToken)
router.delete('/logout', authenticateUser, logout);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification-email', resendVerificationEmail);
router.post('/reset-password', resetPassword);
router.post('/forgot-password', forgotPassword);
router.put('/change-password',authenticateUser ,changePassword);
router.get('/google',  (req, res) => {
    const state = req.query.role ? Buffer.from(JSON.stringify({ role: req.query.role })).toString('base64') : undefined;

    passport.authenticate('google', {
        scope: [
            'profile',
            'email',
            'https://www.googleapis.com/auth/userinfo.profile',
            'https://www.googleapis.com/auth/userinfo.email'
        ],
        accessType: 'offline',
        prompt: 'consent',
        session: false,
        state
    })(req, res);
});

router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login', session: false }),
   async function (req, res) {
        // Successful authentication, redirect home.
        const user = req.user

        // generate token
        const tokenUser = createTokenUser(user);
        const refreshToken = attachCookiesToResponse({ res, user: tokenUser });
        user.refreshToken = refreshToken;
        await user.save();
        const accessToken = createJWT({ payload: tokenUser, expireDate: '15m', jwtSecret: process.env.ACCESS_TOKEN_SECRET })

        res.status(StatusCodes.OK).json({ user: tokenUser, accessToken });
    });
router.get('/facebook', (req, res) => {
    const state = req.query.role ? Buffer.from(JSON.stringify({ role: req.query.role })).toString('base64') : undefined;

    passport.authenticate('facebook', {
        scope: [
            'public_profile',
            'email'
        ],
        session: false,
        state
    })(req, res);
});

router.get('/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/login', session: false }),
   async function (req, res) {
        // Successful authentication
        const user = req.user
        // generate token
        const tokenUser = createTokenUser(user);
        const refreshToken = attachCookiesToResponse({ res, user: tokenUser });
        user.refreshToken = refreshToken;
        await user.save();
        const accessToken = createJWT({ payload: tokenUser, expireDate: '15m', jwtSecret: process.env.ACCESS_TOKEN_SECRET })

        res.status(StatusCodes.OK).json({ user: tokenUser, accessToken });
    });
// router.get('/apple',
//     passport.authenticate('apple', { scope: ['profile'] }));

// router.get('/apple/callback',
//     passport.authenticate('apple', { failureRedirect: '/login' }),
//     function (req, res) {
//         // Successful authentication, redirect home.
//         res.redirect('/');
//     });

module.exports = router