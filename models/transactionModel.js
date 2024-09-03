const mongoose = require('mongoose')


const TransactionSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: [true, 'Transaction must belong to a sender']
    },
    receiver: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: [true, 'Transaction must belong to a sender']
    },
    paymentIntentId: {
        type: String,
        required: [true, 'Transaction must have a payment Intent Id']
    },
    amount: {
        type: Number,
        required: [true, 'Transaction must have a amount']
    },
    currency: {
        type: String,
        default: 'usd',
        required: [true, 'Transaction must have a currency ']
    },
    isRefunded: Boolean,
    amountRefunded: Number,
    refundedAt: Date,


});

module.exports = mongoose.model('Transaction', TransactionSchema)