

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
    subOrders: [{
            type: mongoose.Schema.ObjectId,
            ref: 'SubOrder'
    }],
    user: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required:true
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
    isCanceled: {
        type: Boolean,
        required: true,
        default: false
    },
    paidAt: {
        type: Date
    },
    canceledAt: {
        type: Date
    },
    shippingAddress: {
        address: { type: String, required: true },
        city: { type: String, required: true },
        postalCode: { type: Number, required: true },
        country: { type: String, required: true }
    },
    transactionId: {
        type: mongoose.Types.ObjectId,
        ref: 'Transaction',
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
    }
},
{
    timestamps: true,    
})



Order = mongoose.model('Order', OrderSchema)

const SubOrderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true
    },
    seller: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true
    },
    order: {
        type: mongoose.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.ObjectId,
            ref: 'Product'
        },
        quantity: Number,
        price: Number,
    }],
    isDelivered: {
        type: Boolean,
        required: true,
        default: false
    },
    deliveredAt: {
        type: Date
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
    totalAmount: {
        type: Number,
        required: true,
        default: 0.0
    },
    isBalanceTransfered: {
        type: Boolean,
        required: true,
        default: false
    },
    status: {
        type: String,
        default: 'Not Processed',
        enum: ['Not Processed', 'Processing', 'Shipped', 'Delivered', 'Cancelled']
    }
})

SubOrder = mongoose.model('SubOrder', SubOrderSchema)
module.exports = {
    SubOrder,
    Order
}









