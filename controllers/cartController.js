const Cart = require('../models/cartModel');
const Product = require('../models/productModel');
const { StatusCodes } = require('http-status-codes');
const CustomError = require('../errors');
const validateMongoDbId = require('../utils/validateMongodbId');
const { checkPermissions } = require('../utils');

// Get Cart
const getCart = async (req, res) => {
    const { _id: userId } = req.user;
    validateMongoDbId(userId);

    const cart = await Cart.findOne({ user: userId }).select('-__v -_id -createdAt -updatedAt')
        .populate('items.product', 'name price images.url')
        .populate('items.vendor', 'storeName');

    if (!cart) {
        throw new CustomError.NotFoundError('Cart not found');
    }

    res.status(StatusCodes.OK).json({ cart });
};

// Update Cart
const updateCart = async (req, res) => {
    const { _id: userId } = req.user;
    const { productId, quantity } = req.body;
    if (!quantity) {
        throw new CustomError.BadRequestError('Please provide quantity');
    }
    validateMongoDbId(userId);
    validateMongoDbId(productId);

    // Find or create cart
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
        cart = await Cart.create({ user: userId, items: [], totalPrice: 0, totalQuantity: 0 });
    }

    // Find product and validate
    const product = await Product.findOne({ _id: productId});
    if (!product) {
        throw new CustomError.NotFoundError('Product not found');
    }

    if (product.quantity === 0) {
        throw new CustomError.BadRequestError('Product out of stock');
    }

    if (product.quantity < quantity) {
        throw new CustomError.BadRequestError('Not enough quantity available');
    }
    // Determine the price to use (salePrice or basePrice)
    const price = product.salePrice || product.basePrice;

    // Check if product already exists in cart
    const itemIndex = cart.items.findIndex(
        (item) => item.product.toString() === productId && item.vendor.toString() === product.seller.toString()
    );

    if (itemIndex > -1) {
        // Update existing item
        const oldQuantity = cart.items[itemIndex].quantity;
        cart.items[itemIndex].quantity = quantity;
        cart.totalQuantity = cart.totalQuantity - oldQuantity + quantity;
        cart.totalPrice = cart.totalPrice - (oldQuantity * price) + (quantity * price);
    } else {
        // Add new item
        cart.items.push({
            product: productId,
            vendor: product.seller,
            quantity: quantity,
            price: price,
        });
        cart.totalQuantity += quantity;
        cart.totalPrice += quantity * price;
    }

    await cart.save();

    // Populate the response
    const populatedCart = await Cart.findById(cart._id).select('-__v -_id -createdAt -updatedAt')
        .populate('items.product', 'name price images.url')
        .populate('items.vendor', 'storeName');

    res.status(StatusCodes.OK).json({
        msg: itemIndex > -1 ? 'Product quantity updated successfully' : 'Product added successfully',
        cart: populatedCart,
    });
};

// Delete Item from Cart
const deleteItemFromCart = async (req, res) => {
    const { _id: userId } = req.user;
    const { productId } = req.params;

    validateMongoDbId(userId);
    validateMongoDbId(productId);

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
        throw new CustomError.NotFoundError('Cart not found');
    }
    // Find product and validate
    const product = await Product.findOne({ _id: productId });
    if (!product) {
        throw new CustomError.NotFoundError('Product not found');
    }
    const itemIndex = cart.items.findIndex(
        (item) => item.product.toString() === productId && item.vendor.toString() === product.seller.toString()
    );

    if (itemIndex === -1) {
        throw new CustomError.NotFoundError('Product not found in cart');
    }

    // Update totals
    const item = cart.items[itemIndex];
    cart.totalQuantity -= item.quantity;
    cart.totalPrice -= item.price * item.quantity;

    // Remove item
    cart.items.splice(itemIndex, 1);

    await cart.save();

    res.status(StatusCodes.OK).json({
        msg: 'Product removed successfully',
        cart,
    });
};

// Delete All Items from Cart
const deleteAllItemsFromCart = async (req, res) => {
    const { _id: userId } = req.user;
    validateMongoDbId(userId);

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
        throw new CustomError.NotFoundError('Cart not found');
    }

    if (cart.items.length === 0) {
        throw new CustomError.NotFoundError('No products found in cart');
    }

    // Reset cart
    cart.items = [];
    cart.totalPrice = 0;
    cart.totalQuantity = 0;

    await cart.save();

    res.status(StatusCodes.OK).json({
        msg: 'Cart cleared successfully',
        cart,
    });
};

module.exports = {
    getCart,
    updateCart,
    deleteItemFromCart,
    deleteAllItemsFromCart,
};