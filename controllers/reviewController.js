const Review = require('../models/reviewModel');
const Product = require('../models/productModel');
const { StatusCodes } = require('http-status-codes');
const {
    checkPermissions
} = require('../utils');

const CustomError = require('../errors');
const validateMongoDbId = require('../utils/validateMongodbId');

const createReview = async (req, res) => {
    const { comment, rating, id, userId } = req.body;
    validateMongoDbId(id)
    const product = await Product.findOne({ _id: id })
    if (!product) {
        throw new CustomError.NotFoundError("No product found")
    }
    validateMongoDbId(userId)
    const review = await Review.create({ review:comment,rating,user:userId,product:id})
    res.status(StatusCodes.CREATED).json({msg:'review added successfully', review})
}
const getReviewsByProduct = async (req, res) => {
    const { productId: id } = req.params;
    validateMongoDbId(id)
    const reviews = await Review.find({product: id }).populate('user').select('firstname lastname profilePicture');
    if (reviews.length === 0) {
    throw new CustomError.NotFoundError('no reviews found');
}
    res.status(StatusCodes.OK).json({reviews})
}
const getReview = async (req, res) => {
    const { id } = req.params;
    validateMongoDbId(id)
    const review = await Review.findOne({_id:id}).populate('user').select('firstname lastname profilePicture').exec();
    if (!review) {
        throw new CustomError.NotFoundError('no review found');
    }
    res.status(StatusCodes.OK).json({ review })
}
const updateReview = async (req, res) => {
    const { id } = req.params;

    const { comment, rating, userId, role } = req.body;
    const reviewExists = await Review.findOne({ _id: id });
    checkPermissions(reviewExists.user,userId,role);
    if (!comment || !rating ) {
        throw new CustomError.NotFoundError('no data found');
}
    validateMongoDbId(id)
    const review = await Review.findOneAndUpdate({ _id: id }, req.body, {
        new: true,
        runValidators: true,
    });

    
    if (!review) {
        throw new CustomError.NotFoundError('no review found');
    }
    // checkPermissions(review.user, userId, role)
    res.status(StatusCodes.OK).json({msg:"review updated successfully", review })
}
const deleteReview = async (req, res) => {
    const { id } = req.params;
    const { userId, role } = req.body;

    const reviewExists = await Review.findOne({ _id: id });
    checkPermissions(reviewExists.user, userId, role);
    validateMongoDbId(id)
    const review = await Review.findOneAndDelete({ _id: id });


    if (!review) {
        throw new CustomError.NotFoundError('no review found');
    }
    res.status(StatusCodes.OK).json({msg:"review deleted successfully"})
}





module.exports = {
    createReview,
    getReviewsByProduct,
    getReview,
    updateReview,
    deleteReview
}