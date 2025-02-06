// favouriteController.js
const Favourite = require('../models/favouriteModel');
const Product = require('../models/productModel');
const { StatusCodes } = require('http-status-codes');
const CustomError = require('../errors');
const validateMongoDbId = require('../utils/validateMongodbId');

const getFavourites = async (req, res) => {
    const userId = req.user._id; // Get user ID from authenticated request

    try {
        validateMongoDbId(userId);

        const favourite = await Favourite.findOne({ user: userId })
            .populate({
                path: 'products',
                select: 'name price description mainImage.url images.url' // Select only needed fields
            })
            .lean(); // Use lean() for better performance

        if (!favourite) {
            // Create empty favorites list if none exists
            const newFavourite = await Favourite.create({ user: userId, products: [] });
            return res.status(StatusCodes.OK).json({ favourite: newFavourite });
        }

        res.status(StatusCodes.OK).json({ favourite });
    } catch (error) {
        throw new CustomError.BadRequestError(`Error fetching favourites: ${error.message}`);
    }
};

const addFavourite = async (req, res) => {
    const userId = req.user._id;
    const { productId } = req.body;

    if (!productId) {
        throw new CustomError.BadRequestError('Product ID is required');
    }


        validateMongoDbId(userId);
        validateMongoDbId(productId);

        // Use findOneAndUpdate for atomic operation
        let favourite = await Favourite.findOne({ user: userId });

        if (!favourite) {
            favourite = await Favourite.create({ user: userId, products: [] });
        }

        if (favourite.hasProduct(productId)) {
            throw new CustomError.BadRequestError('Product is already in the favorites list');
        }

        // Verify product exists
        const product = await Product.findById(productId);
        if (!product) {
            throw new CustomError.NotFoundError('Product not found');
        }
        try {
        // Add product to favorites
        favourite.products.push(productId);
        await favourite.save();

        // Populate products before sending response
        await favourite.populate({
            path: 'products',
            select: 'name price description images'
        });

        res.status(StatusCodes.OK).json({
            msg: "Product added to favourites successfully",
            favourite
        });
    } catch (error) {
        throw new CustomError.BadRequestError(`Error removing from favourites: ${error.message}`);
    }
};

const deleteFavourite = async (req, res) => {
    const userId = req.user._id;
    const { id: productId } = req.params;

        validateMongoDbId(userId);
        validateMongoDbId(productId);

        const favourite = await Favourite.findOne({ user: userId });

        if (!favourite) {
            throw new CustomError.NotFoundError('No favourites found for this user');
        }

        if (!favourite.hasProduct(productId)) {
            throw new CustomError.NotFoundError('Product not found in favourites');
        }
try{
        // Remove product using pull operator for better performance
        await Favourite.updateOne(
            { user: userId },
            { $pull: { products: productId } }
        );

        // Fetch updated favorites
        const updatedFavourite = await Favourite.findOne({ user: userId })
            .populate({
                path: 'products',
                select: 'name price description images'
            });

        res.status(StatusCodes.OK).json({
            msg: "Product removed from favourites successfully",
            favourite: updatedFavourite
        });
    } catch (error) {
        throw new CustomError.BadRequestError(`Error removing from favourites: ${error.message}`);
    }
};

module.exports = {
    getFavourites,
    addFavourite,
    deleteFavourite
};
