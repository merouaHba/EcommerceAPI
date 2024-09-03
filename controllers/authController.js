const User = require('../models/userModel')
const Cart = require('../models/cartModel');
const Favourite = require('../models/favouriteModel');
const { StatusCodes } = require('http-status-codes')
const { BadRequestError, UnauthenticatedError, NotFoundError } = require('../errors')
const { attachCookiesToResponse, createTokenUser, createJWT, sendVerificationEmail, sendResetPasswordEmail } = require('../utils');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)







const register = async (req, res) => {
    const { firstname, lastname, email, mobile, password } = req.body;

    const findUserByEmail = await User.findOne({ email: email });
    const findUserByMobile = await User.findOne({ mobile: mobile });
    // console.log(!findUserByEmail , !findUserByMobile)

    if (!findUserByEmail && !findUserByMobile) {
        // first registered user is an admin
        const isFirstAccount = (await User.countDocuments({})) === 0;
        const role = isFirstAccount ? 'admin' : (req.body.role ? req.body.role : 'user');

        const tokenUser = createTokenUser({ ...req.body, role });

        const verificationToken = createJWT({ payload: tokenUser });
        const vericationTokenExpirationDate = Date.now() + 10 * 60 * 1000 // 10 min expiration
        const user = await User.create({ firstname, lastname, email, mobile, password, role, verificationToken, vericationTokenExpirationDate })

        



        // console.log(user.verificationToken)

        // origin domaine
        const protocol = req.protocol;
        const host = req.get('host');
        const origin = `${protocol}://${host}`;
        console.log(origin)
        await sendVerificationEmail({
            name: `${user.firstname} ${user.lastname}`,
            email: user.email,
            verificationToken: user.verificationToken,
            origin,
        });
        // console.log("yes")
        // sendMail().then(res => console.log("Email sent...",res))

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

    const user = await User.findOne({email });
    if (!user) {
        throw new NotFoundError('user not found');
    }
    if (user.isVerified) {
        throw new BadRequestError('this account is already verified');
    }

     
        const tokenUser = createTokenUser({ email });

        const verificationToken = createJWT({ payload: tokenUser });
        const vericationTokenExpirationDate = Date.now() + 10 * 60 * 1000 // 10 expiration

    user.verificationToken = verificationToken;
    user.vericationTokenExpirationDate = vericationTokenExpirationDate;

    await user.save();


        // console.log(user.verificationToken)

        // origin domaine
        const protocol = req.protocol;
        const host = req.get('host');
        const origin = `${protocol}://${host}`;
        await sendVerificationEmail({
            name: `${user.firstname} ${user.lastname}`,
            email: user.email,
            verificationToken: user.verificationToken,
            origin,
        });
        // console.log("yes")
        // sendMail().then(res => console.log("Email sent...",res))

        // send verification token back only while testing in postman!!!
        res.status(StatusCodes.CREATED).json({
            msg: 'Success! Please check your email to verify account',
        });

  

}

const verifyEmail = async (req, res) => {
    const { token } = req.params;

    const user = isTokenValid({ token });
    const userExists = User.findById(user.email)
    if (!userExists) {
        throw new BadRequestError('Invalid token');
    }
 
    if (userExists.isVerified) {
        throw new BadRequestError('this account is already verified');
    }

    if (userExists.vericationTokenExpirationDate < Date.now()) {
        throw new BadRequestError('token expired');
    }
    
    if (userExists.verificationToken !== token) {
        throw new BadRequestError('Verification Failed');
    }

    userExists.isVerified = true;
    userExists.verified = Date.now();
    userExists.verificationToken = undefined;
    userExists.vericationTokenExpirationDate = undefined;

    await userExists.save();

    res.status(StatusCodes.OK).json({ msg: 'Email Verified' });
};

const login = async (req, res) => {
    const { email, password } = req.body
    console.log(email, password)
    if (!email || !password) {
        throw new BadRequestError('Please provide userName and password')
    }
    const user = await User.findOne({ email });

    // check if user exists
    if (!user) {
        throw new NotFoundError('User doesn\'t exist. Please create account and try again')
    }

    // compare password

    const isPasswordCorrect = user.email === email && user.comparePassword(password)
    console.log(isPasswordCorrect)
    if (!isPasswordCorrect) {
        throw new UnauthenticatedError('Invalid Credentials')
    }
    if (!user.isVerified) {
        throw new BadRequestError('Account not verified. Please verify your account and try again.')

    }



    // generate token
    const tokenUser = createTokenUser(user);
    attachCookiesToResponse({ res, user: tokenUser });

    res.status(StatusCodes.OK).json({ user: tokenUser, id: user._id });
}

const logout = async (req, res) => {
    res.clearCookie('token');
    res.status(StatusCodes.OK).json({ msg: 'user logged out!' });
}

const forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        throw new BadRequestError('Please provide valid email');
    }

    const user = await User.findOne({ email });
    // console.log(user)

    if (!user) {
        throw new UnauthenticatedError("Email Doesn't Exist");

    }
    const tokenUser = createTokenUser({ ...req.body });

    const verificationToken = createJWT({ payload: tokenUser });

    // origin domaine
    const protocol = req.protocol;
    const host = req.get('host');
    const origin = `${protocol}://${host}`;
    // send email

    // console.log("yes")
    // console.log(`${user.firstname} ${user.lastname}`)

    await sendResetPasswordEmail({
        name: `${user.firstname} ${user.lastname}`,
        email: user.email,
        token: verificationToken,
        origin,
    });

    const tenMinutes = 1000 * 60 * 10;
    const vericationTokenExpirationDate = new Date(Date.now() + tenMinutes);
    console.log("yes")
    user.verificationToken = verificationToken;
    user.vericationTokenExpirationDate = vericationTokenExpirationDate;
    console.log("yes")
    await user.save();


    res
        .status(StatusCodes.OK)
        .json({ msg: 'Please check your email for reset password link' });
};
const resetPassword = async (req, res) => {
    const { token, email, password, passwordConfirmation } = req.body;
    if (!email) {
        throw new BadRequestError('Please provide valid email');
    }
    if (!(password === passwordConfirmation)) {
        throw new BadRequestError('confirm password');
    }

    const user = await User.findOne({ email });

    if (!user) {
        throw new UnauthenticatedError('Verification Failed');
    }

    if (user.verificationToken !== token) {
        throw new UnauthenticatedError('Verification Failed');
    }


    const currentDate = new Date();
    console.log(
        user.vericationTokenExpirationDate > currentDate)
    if (
        !(user.vericationTokenExpirationDate > currentDate)
    ) {
        throw new BadRequestError('token Expired');
    }
    user.password = password;
    user.verificationToken = null;
    user.vericationTokenExpirationDate = null;
    await user.save();
    res.send('reset password');

};

const changePassword = async (req, res) => {
    const { email, currentPassword, password, passwordConfirmation } = req.body;
    if (!password || !currentPassword) {
        throw new CustomError.BadRequestError('Please provide both values');
    }
    if (!(password === passwordConfirmation)) {
        throw new BadRequestError('confirm password')
    }
    const user = await User.findOne({ email });

    // compare password

    const isPasswordCorrect = await user.comparePassword(currentPassword)
    if (!isPasswordCorrect) {
        throw new UnauthenticatedError('Invalid Credentials')
    }

    // const isPasswordChangeDelayed = await user.changePasswordAfter(user.updatedAt)

    // if (isPasswordChangeDelayed) {
    //     throw new BadRequestError("you are already changed password , you can't change password before 30 days")
    // }

    user.password = password;
    await user.save();
    res.status(StatusCodes.OK).json({ msg: 'Success! Password Updated.' });



}

module.exports = {
    register,
    login,
    logout,
    verifyEmail,
    resendVerificationEmail,
    forgotPassword,
    resetPassword,
    changePassword,
}