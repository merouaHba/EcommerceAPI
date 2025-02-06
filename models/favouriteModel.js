// favouriteModel.js
const mongoose = require('mongoose');

const FavouriteSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, 'User ID is required'],
        index: true // Add index for better query performance
    },
    products: [{
        type: mongoose.Types.ObjectId,
        ref: 'Product',
        required: true
    }],
}, {
    timestamps: true // Add timestamps for better tracking
});

// Add compound index for faster queries
FavouriteSchema.index({ user: 1, 'products': 1 });

// Add method to check if product exists in favorites
FavouriteSchema.methods.hasProduct = function (productId) {
    return this.products.some(product =>
        product.toString() === productId.toString()
    );
};

module.exports = mongoose.model('Favourite', FavouriteSchema);