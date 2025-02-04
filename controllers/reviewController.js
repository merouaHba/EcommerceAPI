const Review = require('../models/reviewModel');
const Product = require('../models/productModel');
const mongoose = require('mongoose');
const { StatusCodes } = require('http-status-codes');
const { checkPermissions } = require('../utils');
const CustomError = require('../errors');
const validateMongoDbId = require('../utils/validateMongodbId');

const createReview = async (req, res) => {
    const { comment, rating, productId } = req.body;
    const userId = req.user._id
    validateMongoDbId(productId);
    if (!comment && !rating) { 
        throw new CustomError.BadRequestError('Please provide comment or rating');
    }

    const product = await Product.findById(productId);
    if (!product) {
        throw new CustomError.NotFoundError('Product not found');
    }

    const existingReview = await Review.findOne({
        product: productId,
        user: userId
    });

    if (existingReview) {
        throw new CustomError.BadRequestError('You have already reviewed this product');
    }

    const review = await Review.create({
        review: comment,
        rating,
        user: userId,
        product: productId
    });

    res.status(StatusCodes.CREATED).json({
        msg: 'Review added successfully',
        review
    });
};

const getReviewsByProduct = async (req, res) => {
    const { productId } = req.params;
    const { sort = '-createdAt', page = 1, limit = 10 } = req.query;

    validateMongoDbId(productId);
    const product = await Product.findById(productId)
    if (!product) {
        throw new CustomError.NotFoundError('No Product found');
    }
    const skip = (page - 1) * limit;

    const reviews = await Review.find({ product: productId })
        .populate('user', 'firstname lastname profilePicture.url')
        .sort(sort)
        .skip(skip)
        .limit(limit);

    const total = await Review.countDocuments({ product: productId });
    

    res.status(StatusCodes.OK).json({
        reviews,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        total
    });
};

const getReviewStats = async (req, res) => {
    const { productId } = req.params;
    validateMongoDbId(productId);

    const stats = await Review.aggregate([
        {
            $match: { product: new mongoose.Types.ObjectId(productId.toString()) }
        },
        {
            $group: {
                _id: null,
                avgRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 },
                ratingDistribution: {
                    $push: '$rating'
                }
            }
        }
    ]);

    if (!stats.length) {
        throw new CustomError.NotFoundError('No review statistics found');
    }

    res.status(StatusCodes.OK).json({ stats: stats[0] });
};

const getUserReviews = async (req, res) => {
    const { userId } = req.params;
    const { role } = req.user;

    if (role === 'seller') {
        const reviews = await Review.aggregate([
            {
                $lookup: {
                    from: 'products', 
                    localField: 'product',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            {
                $unwind: '$productDetails'
            },
            {
                $match: {
                    'productDetails.seller': new mongoose.Types.ObjectId(req.user._id.toString()),
                }
            },
            {
                $project: {
                    _id: 1,
                    rating: 1,
                    comment: 1,
                    createdAt: 1,
                    product: {
                        name: '$productDetails.name',
                        price: '$productDetails.price',
                        mainImage: '$productDetails.mainImage.url'
                    }
                }
            }
        ]);

        return res.status(StatusCodes.OK).json({ reviews });
    }
    validateMongoDbId(userId);

    const reviews = await Review.find({ user: userId })
        .populate('product', 'name price mainImage.url');

    if (!reviews.length) {
        throw new CustomError.NotFoundError('No reviews found for this user');
    }

    res.status(StatusCodes.OK).json({ reviews });
};
const getMyReviews = async (req, res) => {
    const reviews = await Review.find({ user: req.user._id })
        .populate('product', 'name price mainImage.url');

    res.status(StatusCodes.OK).json({ reviews });
};
const updateReview = async (req, res) => {
    const { id } = req.params;
    const { comment, rating } = req.body;
    const { _id:userId, role } = req.user;

    validateMongoDbId(id);

    const review = await Review.findById(id);
    if (!review) {
        throw new CustomError.NotFoundError('Review not found');
    }

    checkPermissions(review.user, userId, role);

    if (!comment && !rating) {
        throw new CustomError.BadRequestError('Please provide update data');
    }

    if (comment) review.review = comment;
    if (rating) review.rating = rating;

    await review.save();

    res.status(StatusCodes.OK).json({
        msg: 'Review updated successfully',
        review
    });
};

const deleteReview = async (req, res) => {
    const { id } = req.params;
    const { _id:userId, role } = req.user;

    validateMongoDbId(id);

    const review = await Review.findById(id);
    if (!review) {
        throw new CustomError.NotFoundError('Review not found');
    }

    checkPermissions(review.user, userId, role);

    await Review.findByIdAndDelete(id);

    res.status(StatusCodes.OK).json({
        msg: 'Review deleted successfully'
    });
};

module.exports = {
    createReview,
    getReviewsByProduct,
    updateReview,
    deleteReview,
    getReviewStats,
    getUserReviews,
    getMyReviews
};