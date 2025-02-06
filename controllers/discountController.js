const { Discount, DiscountUsage } = require('../models/discountModel');
const { StatusCodes } = require('http-status-codes');
const {
    checkPermissions
} = require('../utils');
const { generateUniqueCode } = require('../utils/generateCoupon');
const { discountAPIFeatures } = require('../utils/apiFeatures');
const CustomError = require('../errors');
const mongoose = require('mongoose');
// Get all discounts with filtering, sorting, and pagination
const getAllDiscounts = async (req, res) => {

    const { role, _id } = req.user;

    if (role == 'seller') {
        req.query.sellers = _id;

    }
    try {
        const result = await discountAPIFeatures(req, Discount);
        res.status(StatusCodes.OK).json(result);
    } catch (error) {
        throw new CustomError.InternalServerError(error.message);
    }
};

// Get single discount
const getDiscount = async (req, res) => {
    const { id: discountId } = req.params;
    const { _id,role } = req.user;

    const discount = await Discount.findById(discountId);
    if (!discount) {
        throw new CustomError.NotFoundError(`No discount found with id: ${discountId}`);
    }
    if (role === 'seller') { 
        if (!discount.sellers.includes(_id)) {
            throw new CustomError.UnauthorizedError('Not authorized to view this discount');
        }
    }
    res.status(StatusCodes.OK).json({
        success: true,
        discount
    });
};

// Create new discount
const createDiscount = async (req, res) => {
    const { prefix = '', type, conditions, sellers } = req.body;
    const { role, _id: userId } = req.user;

    // Validate discount type based on user role
    if (role === 'seller' && type === 'freeShipping') {
        throw new CustomError.BadRequestError('Sellers cannot create freeShipping discounts');
    }

    // Validate discount type-specific fields
    if (type === 'buyXgetY' && (!conditions || !conditions.minimumItems)) {
        throw new CustomError.BadRequestError('Minimum items is required for buyXgetY discounts');
    }

    if (type === 'freeShipping' && req.body.value !== undefined) {
        req.body.value = 0; // Ensure value is always 0 for free shipping discounts
    }

    // Ensure sellers field is set correctly based on user role
    let sellersField = [];
    if (role === 'admin') {
        if (sellers && sellers.length > 0) {
            // Validate that all seller IDs exist in the database
            const existingSellers = await mongoose.model('User').find({
                _id: { $in: sellers },
                role: 'seller'
            });

            if (existingSellers.length !== sellers.length) {
                throw new CustomError.NotFoundError('One or more seller IDs are invalid or do not exist');
            }

        }
        sellersField = sellers || []; // Admins can assign discounts to specific sellers or leave it empty for global discounts
    } else if (role === 'seller') {
        sellersField = [userId]; // Sellers can only create discounts for themselves
    }

    // Generate unique discount code
    const code = await generateUniqueCode(prefix);

    // Create the discount
    const discount = await Discount.create({
        ...req.body,
        code,
        sellers: sellersField
    });

    res.status(StatusCodes.CREATED).json({
        success: true,
        discount
    });
};

// Update discount
const updateDiscount = async (req, res) => {
    const { id: discountId } = req.params;
    const updateData = { ...req.body };

    // Prevent updating certain fields
    delete updateData.code;
    delete updateData.usageCount;

    const discount = await Discount.findById(discountId);
    if (!discount) {
        throw new CustomError.NotFoundError(`No discount found with id: ${discountId}`);
    }

    // Check permissions
    if (req.user.role === 'seller' && !discount.sellers.includes(req.user._id)) {
        throw new CustomError.UnauthorizedError('Not authorized to update this discount');
    }

    // Prevent sellers from changing discount type to admin-only types
    if (req.user.role === 'seller' && updateData.type === 'freeShipping') {
        throw new CustomError.BadRequestError('Sellers cannot update discount type to freeShipping');
    }

    const updatedDiscount = await Discount.findByIdAndUpdate(
        discountId,
        updateData,
        {
            new: true,
            runValidators: true
        }
    );

    res.status(StatusCodes.OK).json({
        success: true,
        discount: updatedDiscount
    });
};

// Delete discount
const deleteDiscount = async (req, res) => {
    const { id: discountId } = req.params;

    const discount = await Discount.findById(discountId);
    if (!discount) {
        throw new CustomError.NotFoundError(`No discount found with id: ${discountId}`);
    }

    // Check permissions
    if (req.user.role === 'admin') {
        await Discount.findByIdAndDelete(discountId);
    } else if (req.user.role === 'seller') {
        if (!discount.sellers.includes(req.user._id)) {
            throw new CustomError.UnauthorizedError('Not authorized to delete this discount');
        } else {
            if (discount.sellers.length === 1) {
                await Discount.findByIdAndDelete(discountId);
            } else {
                
                await Discount.findByIdAndUpdate(discountId, {
                    $pull: { sellers: req.user._id }
                }, { new: true, runValidators: true });
            }
        }
    }

    res.status(StatusCodes.OK).json({
        success: true,
        message: 'Discount deleted successfully'
    });
};

// Validate discount
const validateDiscount = async (req, res) => {
    const { code, orderAmount, itemCount, sellerId } = req.body; // sellerId is the seller of the order
    const { role, _id: userId } = req.user;

    // Find the discount by code
    const discount = await Discount.findOne({ code: code.toUpperCase() });
    if (!discount) {
        throw new CustomError.NotFoundError('Invalid discount code');
    }

    // Check if the user is authorized to use the discount
    if (discount.sellers.length > 0) {
        // Discount is seller-specific
        if (role === 'user' && !discount.sellers.includes(sellerId)) {
            throw new CustomError.UnauthorizedError('This discount is not valid for the selected seller');
        }
        if (role === 'seller' && !discount.sellers.includes(userId)) {
            throw new CustomError.UnauthorizedError('You are not authorized to use this discount');
        }
    }

    // Validate the discount against order details
    await discount.validateForUser(userId, orderAmount, itemCount);

    // Calculate the discount amount
    const discountAmount = discount.calculateDiscount(orderAmount, itemCount);

    res.status(StatusCodes.OK).json({
        success: true,
        discount: {
            code: discount.code,
            type: discount.type,
            value: discount.value,
            discountAmount
        }
    });
};

// Apply discount to order
const applyDiscount = async (req, res) => {
    const { code, orderId, orderAmount, itemCount, sellerId } = req.body;
    const { role, _id: userId } = req.user;

    // Find the discount by code
    const discount = await Discount.findOne({ code: code.toUpperCase() });
    if (!discount) {
        throw new CustomError.NotFoundError('Invalid discount code');
    }
    // Check if the order exists
    const order = await mongoose.model('Order').findById(orderId);
    if (!order) {
        throw new CustomError.NotFoundError(`Order with ID ${orderId} not found`);
    }
    // Check if the user is authorized to use the discount
    if (discount.sellers.length > 0) {
        // Discount is seller-specific
        if (role === 'user' && !discount.sellers.includes(sellerId)) {
            throw new CustomError.UnauthorizedError('This discount is not valid for the selected seller');
        }
        if (role === 'seller' && !discount.sellers.includes(userId)) {
            throw new CustomError.UnauthorizedError('You are not authorized to use this discount');
        }
    }

    // Validate the discount against order details
    await discount.validateForUser(userId, orderAmount, itemCount);

    // Calculate the discount amount
    const discountAmount = discount.calculateDiscount(orderAmount, itemCount);

    // Record discount usage
    await DiscountUsage.create({
        discount: discount._id,
        user: userId,
        order: orderId,
        amountSaved: discountAmount
    });

    // Update usage count
    discount.usageCount += 1;
    await discount.save();

    res.status(StatusCodes.OK).json({
        success: true,
        discountAmount
    });
};

// Get discount usage statistics
const getDiscountStats = async (req, res) => {
    const { id: discountId } = req.params;

    const stats = await DiscountUsage.aggregate([
        {
            $match: {
                discount: new mongoose.Types.ObjectId(discountId)
            }
        },
        {
            $group: {
                _id: null,
                totalUsage: { $sum: 1 },
                totalSaved: { $sum: '$amountSaved' },
                avgSaved: { $avg: '$amountSaved' }
            }
        }
    ]);

    res.status(StatusCodes.OK).json({
        success: true,
        stats: stats[0] || {
            totalUsage: 0,
            totalSaved: 0,
            avgSaved: 0
        }
    });
};






module.exports = {
    createDiscount,//💯
    updateDiscount,//💯
    deleteDiscount,//💯
    getDiscount,//💯
    getAllDiscounts,//💯
    validateDiscount,
    applyDiscount,
    getDiscountStats,//💯
}