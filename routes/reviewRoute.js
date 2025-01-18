const express = require('express')
const { createReview, getReview, updateReview, deleteReview, getReviewsByProduct } = require('../controllers/reviewController')
const router = express.Router()
const { authenticateUser, authorizePermissions } = require('../middlewares/authentication')


router.get('/:productId', authenticateUser, getReviewsByProduct)
router.post('/', authenticateUser, authorizePermissions('user'), createReview)
router.get('/:id', authenticateUser, getReview)
router.put('/:id', authenticateUser, authorizePermissions('user'), updateReview)
router.delete('/:id', authenticateUser, authorizePermissions('user'), deleteReview)


module.exports = router