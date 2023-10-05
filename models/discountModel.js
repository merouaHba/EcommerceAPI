

const mongoose = require('mongoose')



const DiscountSchema = new mongoose.Schema({

    code: {
        type: String,
        required: true,
        unique: true,
        required:[true,'discount code required']
    },
    discount: {
        type: Number,
        required: true,
        required: [true, 'discount  required']
    },
    expire: {
        type: Date,
        required: true,
        required: [true, 'discount expire date required']
    }
})


module.exports = mongoose.model('Discount', DiscountSchema)









