const { validationResult } = require('express-validator');
const  CustomError  = require('../errors');

const validate = validations => {
    return async (req, res, next) => {
        // Run all validations
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }

        // Format errors
        const formattedErrors = errors.array().map(err => ({
            field: err.param,
            value: err.value,
            message: err.msg
        }));

        // Throw custom validation error
        next(new CustomError.BadRequestError( formattedErrors[0].message));
    };
};

module.exports = validate;