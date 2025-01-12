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
        state,

    })(req, res);
});

// router.get('/google/callback',
//     async function (req, res,next) {
//         passport.authenticate('google',async (err,user)=> { 
//         // const { err, user } = req
//         console.log(user)
//         console.log(err)
//         if (err) { 
//             res.cookie('error', err instanceof CustomAPIError ? err.message :
//                  "authentication failed", {
//                 path: '/',
//                 secure: process.env.NODE_ENV === 'production',
//                 signed: true,
//                 sameSite: "none",
//             });
//             res.redirect(`${process.env.FRONTEND_URL}${user.role === 'seller' ? '/seller/' : '/'}login`);
//         }
       
// try{        

//         // generate token
//         const tokenUser = createTokenUser(user);
//     const refreshToken = attachCookiesToResponse({ res, rememberMe: false, user: tokenUser });
//          user.refreshToken.push(refreshToken);
//         await user.save();
//         const accessToken = createJWT({ payload: tokenUser, expireDate: '15m', jwtSecret: process.env.ACCESS_TOKEN_SECRET })
//     res.cookie('accessToken', accessToken, {
//         secure: process.env.NODE_ENV === 'production',
//         signed: true,
//         sameSite: "none",
//     });
//     res.cookie('user', user, {
//         secure: process.env.NODE_ENV === 'production',
//         signed: true,
//         sameSite: "none",
//     });


//     res.redirect(`${process.env.FRONTEND_URL}${user.role === 'seller' ? '/seller/dashboard' : ''}`);
// } catch (error) {
//     res.cookie('error', "authentication failed", {
//         path: '/',
//         secure: process.env.NODE_ENV === 'production',
//         signed: true,
//         sameSite: "none",
//     });
//     res.redirect(`${process.env.FRONTEND_URL}${user.role === 'seller' ? '/seller/' : '/'}login`);
// }
//         })(req, res,next)
//     });

router.get('/google/callback', (req, res, next) => {
    passport.authenticate('google', { session: false }, async (err, user, info) => {
        const cookieOptions = {
            path: '/',
            secure: process.env.NODE_ENV === 'production',
            signed: true,
            sameSite: "none",
        };

        // Handle authentication errors or failures
        if (err || !user) {
            const errorMessage = err instanceof CustomAPIError ? err.message :
                info?.message || "Authentication failed";

            res.cookie('error', errorMessage, cookieOptions);

            // Default to user role if no user object exists
            const targetRole = user?.role || 'user';
            return res.redirect(`${process.env.FRONTEND_URL}${targetRole === 'seller' ? '/seller/' : '/'}login`);
        }

        try {
            // Generate tokens and update user
            const tokenUser = createTokenUser(user);
            const refreshToken = attachCookiesToResponse({
                res,
                rememberMe: false,
                user: tokenUser
            });

            // Update user's refresh tokens
            user.refreshToken = user.refreshToken || [];
            user.refreshToken.push(refreshToken);
            await user.save();

            // Generate access token
            const accessToken = createJWT({
                payload: tokenUser,
                expireDate: '15m',
                jwtSecret: process.env.ACCESS_TOKEN_SECRET
            });

            // Set authentication cookies
            res.cookie('accessToken', accessToken, cookieOptions);

            // Sanitize user data before setting in cookie
            // const sanitizedUser = {
            //     _id: user._id,
            //     role: user.role,
            //     firstname: user.firstname,
            //     lastname: user.lastname,
            //     email: user.email,
            //     profilePicture: user.profilePicture
            // };
            res.cookie('user', JSON.stringify(tokenUser), cookieOptions);
            console.log(res.getHeaders())

            // Redirect to appropriate dashboard
            return res.send("hi")
            return res.redirect(`${process.env.FRONTEND_URL}${user.role === 'seller' ? '/seller/dashboard' : '/'}`);

        } catch (error) {
            console.error('Auth completion error:', error);

            res.cookie('error', "Authentication process failed", cookieOptions);

            return res.redirect(`${process.env.FRONTEND_URL}${user?.role === 'seller' ? '/seller/' : '/'}login`);
        }
    })(req, res, next);
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
    passport.authenticate('facebook', { failureRedirect: '/login', failWithError: true, session: false }),
   async function (req, res) {
      try{
        const user = req.user
        // generate token
        const tokenUser = createTokenUser(user);
          const refreshToken = attachCookiesToResponse({ res, rememberMe: false, user: tokenUser });
         user.refreshToken.push(refreshToken);
        await user.save();
        const accessToken = createJWT({ payload: tokenUser, expireDate: '15m', jwtSecret: process.env.ACCESS_TOKEN_SECRET })

          res.cookie('accessToken', accessToken, {
              path: '/',
              secure: process.env.NODE_ENV === 'production',
              signed: true,
              sameSite: "none",
          });
          res.cookie('user', user, {
              path: '/',
              secure: process.env.NODE_ENV === 'production',
              signed: true,
              sameSite: "none",
          });
          console.log(res.getHeaders());

          res.redirect(`${process.env.FRONTEND_URL}${user.role === 'seller' ? '/seller/dashboard' : ''}`);
    } catch (error) {
          res.cookie('error', "authentication failed", {
              path: '/',
              secure: process.env.NODE_ENV === 'production',
              signed: true,
              sameSite: "none",
          });
          res.redirect(`${process.env.FRONTEND_URL}${user.role === 'seller' ? '/seller/' : '/'}login`);
      
      }
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