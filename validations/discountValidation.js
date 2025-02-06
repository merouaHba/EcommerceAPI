const { body, param, query } = require('express-validator');

// Validation chains
const createDiscountValidation = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Discount name is required')
        .isLength({ max: 100 })
        .withMessage('Name cannot exceed 100 characters'),

    body('type')
        .trim()
        .notEmpty()
        .withMessage('Discount type is required')
        .isIn(['percentage', 'fixed', 'buyXgetY', 'freeShipping'])
        .withMessage('Invalid discount type')
        .custom((value, { req }) => {
            if (req.user.role === 'seller' && value === 'freeShipping') {
                throw new Error('Sellers cannot create freeShipping discounts');
            }
            return true;
        }), ,

    body('value')
        .if(body('type').not().equals('freeShipping')) // Value is not required for freeShipping
        .notEmpty()
        .withMessage('Discount value is required')
        .isFloat({ min: 0 })
        .withMessage('Value must be a positive number')
        .custom((value, { req }) => {
            if (req.body.type === 'percentage' && value > 100) {
                throw new Error('Percentage discount cannot exceed 100%');
            }
            return true;
        }),

    body('startDate')
        .notEmpty()
        .withMessage('Start date is required')
        .isISO8601()
        .withMessage('Invalid start date format')
        .custom(value => {
            if (new Date(value) < new Date()) {
                throw new Error('Start date cannot be in the past');
            }
            return true;
        }),

    body('endDate')
        .notEmpty()
        .withMessage('End date is required')
        .isISO8601()
        .withMessage('Invalid end date format')
        .custom((value, { req }) => {
            if (new Date(value) <= new Date(req.body.startDate)) {
                throw new Error('End date must be after start date');
            }
            return true;
        }),

    body('minPurchaseAmount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Minimum purchase amount must be non-negative'),

    body('maxDiscountAmount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Maximum discount amount must be non-negative'),

    body('usageLimit')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Usage limit must be at least 1'),

    body('perUserLimit')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Per user limit must be at least 1'),

    body('conditions.minimumItems')
        .if(body('type').equals('buyXgetY')) // Only required for buyXgetY
        .notEmpty()
        .withMessage('Minimum items is required for buyXgetY discounts')
        .isInt({ min: 1 })
        .withMessage('Minimum items must be at least 1'),

    body('conditions.maximumItems')
        .optional()
        .isInt({ min: 1 })
        .custom((value, { req }) => {
            const minItems = req.body.conditions?.minimumItems;
            if (minItems && value < minItems) {
                throw new Error('Maximum items must be greater than minimum items');
            }
            return true;
        }),

    body('conditions.firstPurchaseOnly')
        .optional()
        .isBoolean()
        .withMessage('First purchase only must be a boolean'),

    body('conditions.combinableWithOtherDiscounts')
        .optional()
        .isBoolean()
        .withMessage('Combinable with other discounts must be a boolean'),

    body('sellers')
        .optional()
        .isArray()
        .withMessage('Sellers must be an array')
        .custom((value, { req }) => {
            if (req.user.role === 'seller') {
                if (value && value.length > 0 && !value.every(id => id.equals(req.user._id))) {
                    throw new Error('Sellers can only create discounts for themselves');
                }
            }
            return true;
        }),

    body('sellers')
        .optional()
        .isArray()
        .withMessage('Sellers must be an array')
        .custom((value, { req }) => {
            if (req.user.role === 'seller') {
                if (value && value.length > 0 && !value.every(id => id.equals(req.user._id))) {
                    throw new Error('Sellers can only create discounts for themselves');
                }
            }
            return true;
        }),

    body('applicableProducts')
        .optional()
        .isArray()
        .withMessage('Applicable products must be an array'),

    body('applicableProducts.*')
        .optional()
        .isMongoId()
        .withMessage('Invalid product ID format'),

    body('applicableCategories')
        .optional()
        .isArray()
        .withMessage('Applicable categories must be an array'),

    body('applicableCategories.*')
        .optional()
        .isMongoId()
        .withMessage('Invalid category ID format')
];


// Common validations that can be reused
const commonValidations = {
    type: body('type')
        .optional()
        .isIn(['percentage', 'fixed', 'buyXgetY', 'freeShipping'])
        .withMessage('Invalid discount type'),

    value: body('value')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Value must be a positive number')
        .custom((value, { req }) => {
            if (req.body.type === 'percentage' && value > 100) {
                throw new Error('Percentage discount cannot exceed 100%');
            }
            return true;
        }),

    dateValidation: (startDateField, endDateField) => [
        body(startDateField)
            .optional()
            .isISO8601()
            .withMessage('Invalid start date format')
            .custom(value => {
                if (new Date(value) < new Date()) {
                    throw new Error('Start date cannot be in the past');
                }
                return true;
            }),

        body(endDateField)
            .optional()
            .isISO8601()
            .withMessage('Invalid end date format')
            .custom((value, { req }) => {
                const startDate = req.body[startDateField] || req.body.startDate;
                if (new Date(value) <= new Date(startDate)) {
                    throw new Error('End date must be after start date');
                }
                return true;
            })
    ]
};

// Get all discounts validation
const getAllDiscountsValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),

    query('sort')
        .optional()
        .isIn(['createdAt', '-createdAt', 'name', '-name', 'startDate', '-startDate'])
        .withMessage('Invalid sort parameter'),

    query('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),

    query('type')
        .optional()
        .isIn(['percentage', 'fixed', 'buyXgetY', 'freeShipping'])
        .withMessage('Invalid discount type filter')
];

// Get single discount validation
const getDiscountValidation = [
    param('id').isMongoId().withMessage('Invalid discount ID format')
];

// Update discount validation
const updateDiscountValidation = [
    param('id')
        .isMongoId()
        .withMessage('Invalid discount ID format'),

    body('name')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Discount name cannot be empty')
        .isLength({ max: 100 })
        .withMessage('Name cannot exceed 100 characters'),

    commonValidations.type,
    commonValidations.value,
    ...commonValidations.dateValidation('startDate', 'endDate'),

    body('minPurchaseAmount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Minimum purchase amount must be non-negative'),

    body('maxDiscountAmount')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Maximum discount amount must be non-negative'),

    body('perUserLimit')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Per user limit must be at least 1'),

    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be a boolean'),

    body('conditions')
        .optional()
        .isObject()
        .withMessage('Conditions must be an object')
];

// Delete discount validation
const deleteDiscountValidation = [
    param('id')
        .isMongoId()
        .withMessage('Invalid discount ID format')
];

// Validate discount validation
const validateDiscountValidation = [
    body('code')
        .trim()
        .notEmpty()
        .withMessage('Discount code is required')
        .isLength({ min: 3, max: 20 })
        .withMessage('Code must be between 3 and 20 characters'),

    body('orderAmount')
        .isFloat({ min: 0 })
        .withMessage('Order amount must be a positive number'),

    body('itemCount')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Item count must be at least 1'),

    body('sellerId')
        .optional()
        .isMongoId()
        .withMessage('Invalid seller ID format')
];

// Apply discount validation
const applyDiscountValidation = [
    ...validateDiscountValidation,

    body('orderId')
        .isMongoId()
        .withMessage('Invalid order ID format')
];

// Get discount stats validation
const getDiscountStatsValidation = [
    param('id')
        .isMongoId()
        .withMessage('Invalid discount ID format'),

    query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid start date format'),

    query('endDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid end date format')
        .custom((value, { req }) => {
            if (req.query.startDate && new Date(value) <= new Date(req.query.startDate)) {
                throw new Error('End date must be after start date');
            }
            return true;
        })
];

module.exports = {
    getAllDiscountsValidation,
    getDiscountValidation,
    createDiscountValidation,
    updateDiscountValidation,
    deleteDiscountValidation,
    validateDiscountValidation,
    applyDiscountValidation,
    getDiscountStatsValidation,
};
