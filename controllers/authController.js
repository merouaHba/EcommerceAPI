const User = require('../models/userModel')
const { StatusCodes } = require('http-status-codes')
const { BadRequestError, UnauthenticatedError, NotFoundError, UnauthorizedError, ForbiddenError, CustomAPIError } = require('../errors')
const { attachCookiesToResponse, createTokenUser, createJWT, sendVerificationEmail, sendResetPasswordEmail, isTokenValid } = require('../utils');
const passport = require('passport');






const register = async (req, res) => {
    const { firstname, lastname, email, password, mobile, storeDetails, storeName, terms } = req.body;
    if (!terms) {
        throw new BadRequestError('You must accept terms and conditions to register')
    }
if(!firstname || !lastname || !email || !password) { 
    throw new BadRequestError('Please provide all values')
    }
    
    const findUserByEmail = await User.findOne({ email });
    if (req.body.role === 'seller') {

        const findUserByMobile = await User.findOne({ mobile });
        if (findUserByMobile) {
            {
                throw new BadRequestError('User Already Exists')
            }
        }
     }
    if (!findUserByEmail ) {
        // first registered user is an admin
        const isFirstAccount = (await User.countDocuments({})) === 0;
        const role = isFirstAccount ? 'admin' : (req.body.role ? req.body.role : 'user');
        const tokenUser = createTokenUser({ ...req.body, role });
        
        const verificationToken = createJWT({ payload: tokenUser, expireDate: '25h', jwtSecret: process.env.JWT_SECRET });
        const vericationTokenExpirationDate = Date.now() + 24 * 60 * 60 * 1000 // 10 min expiration
        let user

            if (req.body.role === 'seller') {
                if (!mobile || !storeDetails || !storeName) {
                    throw new BadRequestError('Please provide all values')
                }
                user = await User.create({ firstname, lastname, email, password, mobile, storeDetails, storeName, role, verificationToken, vericationTokenExpirationDate,termsAccepted:terms,termsAcceptedAt:Date.now(),termsVersion:'1.0' })
            } else {

                user = await User.create({ firstname, lastname, email, password, role, verificationToken, vericationTokenExpirationDate, termsAccepted: terms, termsAcceptedAt: Date.now(), termsVersion: '1.0' })
            }
        


        await sendVerificationEmail({
            name: `${user.firstname} ${user.lastname}`,
            email: user.email,
            verificationToken: user.verificationToken,
            origin: process.env.FRONTEND_URL,
        });
   

        // send verification token back only while testing in postman!!!
        res.status(StatusCodes.CREATED).json({
            msg: 'Success! Please check your email to verify account',
        });

    } else {
        throw new BadRequestError('User Already Exists')
    }

}
const resendVerificationEmail = async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        throw new NotFoundError('user not found');
    }
    if (user.isVerified) {
        throw new BadRequestError('this account is already verified');
    }


    const tokenUser = createTokenUser({ email });

    const verificationToken = createJWT({ payload: tokenUser, expireDate: '25h', jwtSecret: process.env.JWT_SECRET });
    const vericationTokenExpirationDate = Date.now() + 24 * 60 * 60 * 1000 

    user.verificationToken = verificationToken;
    user.vericationTokenExpirationDate = vericationTokenExpirationDate;

    await user.save();



    await sendVerificationEmail({
        name: `${user.firstname} ${user.lastname}`,
        email: user.email,
        verificationToken: user.verificationToken,
        origin: process.env.FRONTEND_URL,
    });

    res.status(StatusCodes.CREATED).json({
        msg: 'Success! Please check your email to verify account',
         expireDate: '24 hours'
    });



}

const verifyEmail = async (req, res) => {
    const { token } = req.params;
    let user;
try{
    user = isTokenValid({ token, jwtSecret: process.env.JWT_SECRET });
} catch (err) {
    throw new BadRequestError('Invalid token');
}
    const userExists = await User.findOne({email:user.email})
    if (!userExists) {
        throw new BadRequestError('Invalid token');
    }

    if (userExists.isVerified) {
        throw new BadRequestError('this account is already verified');
    }

    if (userExists.vericationTokenExpirationDate < new Date(Date.now())) {
        throw new BadRequestError('Invalid token');
    }

    if (userExists.verificationToken !== token) {
        throw new BadRequestError('Invalid token');
    }

    userExists.isVerified = true;
    userExists.verified = Date.now();
    userExists.verificationToken = undefined;
    userExists.vericationTokenExpirationDate = undefined;

    await userExists.save();

    res.status(StatusCodes.OK).json({ msg: 'Email Verified' });
};

const login = async (req, res) => {
    const { email, password,role,rememberMe} = req.body
    if (!email || !password) {
        throw new BadRequestError('Please provide userName and password')
    }
    const user = await User.findOne({ email });

    // check if user exists
    if (!user) {
        throw new NotFoundError('User doesn\'t exist. Please create account and try again')
    }

    // compare password

    const isPasswordCorrect = await user.comparePassword(password)
    if (!isPasswordCorrect) {
        throw new BadRequestError('Invalid Credentials')
    }
    if (user.role !== role ) {
        throw new ForbiddenError(`This account is registred as a ${user.role}. Please Log in through the correct portal`)

    }
    if (user.isBlocked) {
        throw new BadRequestError('Account is Blocked.')

    }
    if (!user.isVerified) {
        throw new BadRequestError('Account not verified')

    }



    // generate token
    const tokenUser = createTokenUser(user);
    const refreshToken = attachCookiesToResponse({ res, rememberMe, user: tokenUser });
    user.refreshToken.push(refreshToken);
    await user.save();
    const accessToken = createJWT({ payload: tokenUser, expireDate: '75m', jwtSecret: process.env.ACCESS_TOKEN_SECRET })
    res.status(StatusCodes.OK).json({ user: tokenUser, accessToken });
}
const refreshToken = async (req, res) => {
    const refreshTokenFromCookie = req.signedCookies.token;

    if (!refreshTokenFromCookie) {

        throw new UnauthorizedError('Refresh token required')
    }
    let user;
   
    try {
        user = isTokenValid({ token: refreshTokenFromCookie, jwtSecret: process.env.REFRESH_TOKEN_SECRET });
        const userExists = await User.findById(user._id)
        if (!userExists || userExists.refreshToken.includes(refreshTokenFromCookie)) {
            userExists.refreshToken.filter((token) => token !== refreshTokenFromCookie)
            await userExists.save();
            res.clearCookie('token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
            });
            throw new UnauthenticatedError('Invalid Refresh token');
        }
    } catch (error) {
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
        });
        throw new UnauthenticatedError('Invalid Refresh token');
    }
  
        // generate token
        const tokenUser = createTokenUser(user);
        const accessToken = createJWT({ payload: tokenUser, expireDate: '75m', jwtSecret: process.env.ACCESS_TOKEN_SECRET })

        res.status(StatusCodes.OK).json({ user: tokenUser, accessToken });


   






}

const logout = async (req, res) => {
    const refreshToken = req.signedCookies?.token

   await User.findByIdAndUpdate(req.user._id, {
        $pull: {
            refreshToken
    }});
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
    });
    res.status(StatusCodes.OK).json({ msg: 'user logged out!' });
}

const forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        throw new BadRequestError('Please provide valid email');
    }

    const user = await User.findOne({ email });

    if (!user) {
        throw new NotFoundError("Email Doesn't Exist");

    }
    if (!user.isVerified) {
        throw new BadRequestError('Account is Not Verified')

    }
    if (user.isBlocked) {
        throw new BadRequestError('Account is Blocked.')

    }
    const tokenUser = createTokenUser({ ...req.body });

    const verificationToken = createJWT({ payload: tokenUser, expireDate: '90m', jwtSecret: process.env.JWT_SECRET });





    await sendResetPasswordEmail({
        name: `${user.firstname} ${user.lastname}`,
        email: user.email,
        token: verificationToken,
        origin: process.env.FRONTEND_URL,
    });

    const vericationTokenExpirationDate = new Date(Date.now() + 1000 * 60 * 30);
    user.verificationToken = verificationToken;
    user.vericationTokenExpirationDate = vericationTokenExpirationDate;
    await user.save();


    res
        .status(StatusCodes.OK)
        .json({ msg: 'Please check your email for reset password link' });
};
const resetPassword = async (req, res) => {
    const { token, password } = req.body;
    if (!password) {
        throw new BadRequestError('Please provide valid password');
    }
    let user;
    try {
        user = isTokenValid({ token, jwtSecret: process.env.JWT_SECRET });
    } catch (err) {
        console.log(err)
        throw new BadRequestError('Invalid token');
    }
    const userExists = await User.findOne({ email: user.email })

    if (!userExists) {
        throw new NotFoundError('User not found');
    }

    if (userExists.verificationToken !== token) {
        throw new UnauthenticatedError('Invalid token');
    }

    if (userExists.vericationTokenExpirationDate < new Date(Date.now())) {
        throw new BadRequestError('Invalid token');
    }
    userExists.password = password;
    userExists.verificationToken = undefined;
    userExists.vericationTokenExpirationDate = undefined;
    await userExists.save();
    res.status(StatusCodes.OK).json({ msg: 'Success! Password reset.', expireDate: '30 minutes' });

};

const changePassword = async (req, res) => {
    const {  currentPassword, password } = req.body;
    const { email } = req.user;
    if (!password || !currentPassword) {
        throw new BadRequestError('Please provide both values');
    }
    const user = await User.findOne({ email });

    if (user.isBlocked) {
        throw new BadRequestError('Account is Blocked.')

    }
    if (!user.isVerified) {
        throw new BadRequestError('Account is Not Verified.')

    }
    const isPasswordCorrect = await user.comparePassword(currentPassword)
    if (!isPasswordCorrect) {
        throw new BadRequestError(' Password is incorrect')
    }

    user.password = password;
    // generate token
    const tokenUser = createTokenUser(user);
    const refreshToken = attachCookiesToResponse({ res,rememberMe:false, user: tokenUser });
     user.refreshToken.push(refreshToken);
    await user.save();
    const accessToken = createJWT({ payload: tokenUser, expireDate: '75m', jwtSecret: process.env.ACCESS_TOKEN_SECRET })
    res.status(StatusCodes.OK).json({ user: tokenUser, accessToken });

}
const checkAuthCookies=async(req,res) => {
    const user = await User.findOne({ _id: req.user._id }).select('firstname lastname profilePicture email mobile role address');

    if (!user) {
        throw new NotFoundError(`No user with id : ${id}`);
    }
    const tokenUser = createTokenUser(user);
    const refreshToken = attachCookiesToResponse({ res, rememberMe: false, user: tokenUser });
    user.refreshToken = user.refreshToken?.push(refreshToken) || [refreshToken];
    await user.save();
    const accessToken = createJWT({ payload: tokenUser, expireDate: '75m', jwtSecret: process.env.ACCESS_TOKEN_SECRET })
    res.status(StatusCodes.OK).json({ user: tokenUser, accessToken });

}
const checkErrorCookies = async (req, res) => {
    const error = req.signedCookies?.error
    res.status(StatusCodes.OK).json({ error });

    
}
const googleAuth = async (req, res) => {
    const queryObject = {}
    if (req.query.role) {
        queryObject.role = req.query.role
    }
    if (req.query.redirect) {
        queryObject.redirect = req.query.redirect
    }

    const state = queryObject ? Buffer.from(JSON.stringify(queryObject)).toString('base64') : undefined;

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
}
const googleCallback=async(req, res, next) => {

        passport.authenticate('google', { session: false }, async (err, user, info) => {
            const cookieOptions = {
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                signed: true,
                sameSite: "none",
                expires: new Date(new Date(Date.now() + (1000 * 60 * 60 * 2))),

            };

            if (err || !user) {
                const errorMessage = err instanceof CustomAPIError ? err.message :
                    info?.message || "Authentication failed";

                res.cookie('error', errorMessage, cookieOptions);

                const targetRole = info?.role ?? 'user';
                return res.redirect(`${process.env.FRONTEND_URL}${targetRole === 'seller' ? '/seller/' : '/'}${info?.redirect??"login"}?cookieSet=true`);
            }

            try {
                const tokenUser = createTokenUser(user);
                const refreshToken = attachCookiesToResponse({
                    res,
                    rememberMe: false,
                    user: tokenUser
                });

                user.refreshToken = user.refreshToken || [];
                user.refreshToken.push(refreshToken);
                await user.save();

                const accessToken = createJWT({
                    payload: tokenUser,
                    expireDate: '75m',
                    jwtSecret: process.env.ACCESS_TOKEN_SECRET
                });

                res.cookie('accessToken', accessToken, cookieOptions);

                res.cookie('user', JSON.stringify(tokenUser), cookieOptions);
                console.log(res.getHeaders())
                setTimeout(() => {

                    return res.status(307).redirect(`${process.env.FRONTEND_URL}${user.role === 'seller' ? '/seller/dashboard?cookieSet=true' : '/?cookieSet=true'}`);
                }, 1000)

            } catch (error) {
                console.error('Auth completion error:', error);

                res.cookie('error', "Authentication process failed", cookieOptions);

                return res.redirect(`${process.env.FRONTEND_URL}${user?.role === 'seller' ? '/seller/' : '/'}${info?.redirect??"login"}?cookieSet=true`);
            }
        })(req, res, next);
    }
const facebookAuth =(req, res) => {
    const queryObject = {}
    if (req.query.role) {
        queryObject.role = req.query.role
    }
    if (req.query.redirect) {
        queryObject.redirect = req.query.redirect
    }

    const state = queryObject ? Buffer.from(JSON.stringify(queryObject)).toString('base64') : undefined;

    passport.authenticate('facebook', {
        scope: [
            'public_profile',
            'email'
        ],
        session: false,
        state
    })(req, res);
};
const facebookCallback =(req, res, next) => {

        passport.authenticate('facebook', { session: false }, async (err, user, info) => {
            const cookieOptions = {
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                signed: true,
                sameSite: "none",
                expires: new Date(new Date(Date.now() + (1000 * 60 * 60 * 2))),

            };

            if (err || !user) {
                const errorMessage = err instanceof CustomAPIError ? err.message :
                    info?.message || "Authentication failed";

                res.cookie('error', errorMessage, cookieOptions);

                const targetRole = info?.role ?? 'user';
                return res.redirect(`${process.env.FRONTEND_URL}${targetRole === 'seller' ? '/seller/' : '/'}${info?.redirect??"login"}?cookieSet=true`);
            }

            try {
                const tokenUser = createTokenUser(user);
                const refreshToken = attachCookiesToResponse({
                    res,
                    rememberMe: false,
                    user: tokenUser
                });

                user.refreshToken = user.refreshToken || [];
                user.refreshToken.push(refreshToken);
                await user.save();

                const accessToken = createJWT({
                    payload: tokenUser,
                    expireDate: '75m',
                    jwtSecret: process.env.ACCESS_TOKEN_SECRET
                });

                res.cookie('accessToken', accessToken, cookieOptions);

                res.cookie('user', JSON.stringify(tokenUser), cookieOptions);
                console.log(res.getHeaders())

                setTimeout(() => {

                    return res.redirect(`${process.env.FRONTEND_URL}${user.role === 'seller' ? '/seller/dashboard?cookieSet=true' : '/?cookieSet=true'}`);
                }, 1000)
            } catch (error) {
                console.error('Auth completion error:', error);

                res.cookie('error', "Authentication process failed", cookieOptions);

                return res.redirect(`${process.env.FRONTEND_URL}${user?.role === 'seller' ? '/seller/' : '/'}${info?.redirect??"login"}?cookieSet=true`);
            }
        })(req, res, next);
    }

module.exports = {
    register,
    login,
    refreshToken,
    logout,
    verifyEmail,
    resendVerificationEmail,
    forgotPassword,
    resetPassword,
    changePassword,
    checkAuthCookies,
    checkErrorCookies,
    googleAuth,
    facebookAuth,
    googleCallback,
    facebookCallback
}