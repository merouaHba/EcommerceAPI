const CustomError = require('../errors');
const { isTokenValid } = require('../utils');
const User = require('../models/userModel')

const authenticateUser = async (req, res, next) => {
    let accessToken;
    const refreshToken = req.signedCookies?.token ;
    console.log("req.signedCookies?.token ??", req)
    // check header
    const authHeader = req.headers.authorization ?? `Bearer ${req.signedCookies?.accessToken}`;
    if (authHeader && authHeader.startsWith('Bearer')) {
        accessToken = authHeader.split(' ')[1];

    }

    if (!accessToken) {
        throw new CustomError.UnauthenticatedError('Authentication Invalid');
    }
    let user;
    try {
         user = isTokenValid({ token:accessToken, jwtSecret: process.env.ACCESS_TOKEN_SECRET });
        req.user = user
    } catch (error) {
        throw new CustomError.UnauthenticatedError('Token not valid or Session Expired. Please log in again!');
    }
        const userExists = await User.findById(user._id)

    if (!userExists || !userExists.refreshToken.includes(refreshToken)) { 
            throw new CustomError.UnauthenticatedError('Authentication Invalid or Session Expired. Please log in again!');
        }
        
        next();
    
};

const authorizePermissions = (...roles) => {
    return (req, res, next) => {
        // console.log(roles)
        if (!roles.includes(req.user.role)) {
            throw new CustomError.UnauthorizedError(
                'Unauthorized to access this route'
            );
        }
        next();
    };
};

module.exports = {
    authenticateUser,
    authorizePermissions,
};
