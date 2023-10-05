const mongoose = require('mongoose')


const CartSchema = new mongoose.Schema({
    orderBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    items: [
        {
            product: {
                type: mongoose.Types.ObjectId,
                ref: 'Product',
                // required: true
            },
            totalProductQuantity: {
                type: Number,
                // required: true
            },
            totalProductPrice: {
                type: Number,
                // required: true
            }
        }
    ],
    totalPrice: {
        type: Number,
        // required: true
    },
    totalQuantity: {
        type: Number,
        required: true
    }
})
        

module.exports = mongoose.model('Cart', CartSchema)