

const mongoose = require('mongoose')



const OrderSchema = new mongoose.Schema({
    cartItems:[ {
        product:{ 
            type: mongoose.Schema.ObjectId,
            ref:'Product'
        },
        quantity: Number,
        price: Number,
    }],
    user: {
        type: mongoose.Types.ObjectId,
        ref: 'users'
    },
    totalPrice: {
        type: Number,
        required: true,
        default: 0.0
    },
    isPaid: {
        type: Boolean,
        required: true,
        default: false
    },
    paidAt: {
        type: Date
    },
    isDelivered: {
        type: Boolean,
        required: true,
        default: false
    },
    deliveredAt: {
        type: Date
    },
    shippingAddress: {
        address: { type: String, required: true },
        city: { type: String, required: true },
        postalCode: { type: Number, required: true },
        country: { type: String, required: true }
    },
    paymentMethod: {
        type: String,
        // required: true
    },
    paymentStripeId: {
        type: String
    },
    taxPrice: {
        type: Number,
        required: true,
        default: 0.0
    },
    shippingPrice: {
        type: Number,
        required: true,
        default: 0.0
    },
    phone: {
        type: String,
        required: [true, 'Phone Is Required']
    },
    status: {
        type: String,
        default: 'Not Processed',
        enum: ['Not Processed', 'Processing', 'Shipped', 'Delivered', 'Cancelled']
    }
},
{
        timestamps: true
    
})


module.exports = mongoose.model('Order', OrderSchema)









