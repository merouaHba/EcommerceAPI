const mongoose = require('mongoose');

const CartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    items: [
        {
            product: {
                type: mongoose.Types.ObjectId,
                ref: 'Product',
                required: true,
            },
            vendor: {
                type: mongoose.Types.ObjectId,
                ref: 'User',
                required: true,
            },
            quantity: {
                type: Number,
                required: true,
                min: 1,
            },
            price: {
                type: Number,
                required: true,
                min: 0,
            },
        },
    ],
    totalPrice: {
        type: Number,
        required: true,
        default: 0.0,
    },
    totalQuantity: {
        type: Number,
        required: true,
        default: 0,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Cart', CartSchema);