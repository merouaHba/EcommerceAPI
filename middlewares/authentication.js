const CustomError = require('../errors');
const { isTokenValid } = require('../utils');
const User = require('../models/userModel')

const authenticateUser = async (req, res, next) => {
    let token;
    // check header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer')) {
        token = authHeader.split(' ')[1];
    }
    // check cookies
    else if (req.signedCookies.token) {
    token = req.signedCookies.token;
}
    if (!token) {
        throw new CustomError.UnauthenticatedError('Authentication Invalid');
    }

    try {
        const user = isTokenValid({ token });
        req.user = user
        const userExists = User.findById(user._id)
        if (!userExists) {
            throw new CustomError.UnauthenticatedError('Authentication Invalid');
        }
        // req.user = user
        next();
    } catch (error) {
        throw new CustomError.UnauthenticatedError('Authentication Invalid');
    }
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
