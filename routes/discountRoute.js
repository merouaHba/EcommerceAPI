const express = require('express');
const router = express.Router();
const {
    authenticateUser,
    authorizePermissions,
} = require('../middlewares/authentication');
const validate = require('../middlewares/requestValidation');
const {
    getAllDiscountsValidation,
    getDiscountValidation,
    createDiscountValidation,
    updateDiscountValidation,
    deleteDiscountValidation,
    validateDiscountValidation,
    applyDiscountValidation,
    getDiscountStatsValidation,
} = require('../validations/discountValidation');
const {
    createDiscount,
    updateDiscount,
    deleteDiscount,
    getDiscount,
    getAllDiscounts,
    validateDiscount,
    applyDiscount,
    getDiscountStats,
} = require('../controllers/discountController');



router.use(authenticateUser);

// Public routes
router.post('/validate',
    validate(validateDiscountValidation),
    validateDiscount
);

router.post('/apply',
    validate(applyDiscountValidation),
    applyDiscount
);

// Seller and admin routes
router.use(authorizePermissions('seller', 'admin'));

router.route('/')
    .get(
        validate(getAllDiscountsValidation),
        getAllDiscounts
    )
    .post(
        validate(createDiscountValidation),
        createDiscount
    );

router.route('/:id')
    .get(
        validate(getDiscountValidation),
        getDiscount
    )
    .put(
        validate(updateDiscountValidation),
        updateDiscount
    )
    .delete(
        validate(deleteDiscountValidation),
        deleteDiscount
    );

router.get('/:id/stats',
    authorizePermissions('admin'),
    validate(getDiscountStatsValidation),
    getDiscountStats
);

module.exports = router;

