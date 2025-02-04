const express = require('express');
const router = express.Router();
const {
    createReview,
    updateReview,
    deleteReview,
    getReviewsByProduct,
    getReviewStats,
    getUserReviews,
    getMyReviews
} = require('../controllers/reviewController');
const {
    authenticateUser,
    authorizePermissions
} = require('../middlewares/authentication');

router.get('/stats/:productId', getReviewStats);
router.get('/my-reviews', authenticateUser, authorizePermissions('user'), getMyReviews);
router.get('/user/:userId?', authenticateUser, authorizePermissions('seller','admin'), getUserReviews);
router.get('/:productId', getReviewsByProduct);
router.post('/', authenticateUser, authorizePermissions('user'), createReview);
router.put('/:id', authenticateUser, authorizePermissions('user'), updateReview);
router.delete('/:id', authenticateUser, authorizePermissions('user'), deleteReview);

module.exports = router;
