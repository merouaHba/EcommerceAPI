const mongoose = require('mongoose')


const CartSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    items: [
        {
            product: {
                type: mongoose.Types.ObjectId,
                ref: 'Product',
                // required: true
            },
            quantity: {
                type: Number,
                // required: true
            },
            price: {
                type: Number,
                // required: true
            }
        }
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
},{
        timestamps: true,
    })
        

module.exports = mongoose.model('Cart', CartSchema)