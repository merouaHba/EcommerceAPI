
const Product = require('./productModel')

const mongoose = require('mongoose')



const ReviewSchema = new mongoose.Schema({
    review: {
        type: String,
        required: [true, 'Review cannot be empty!']
    },
    rating: {
        type: Number,
        min: 0,
        max: 5,
        required: [true, 'Review rating cannot be empty!']
    },
    product: {
        type: mongoose.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Review must belong to a product']
    },
    user: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: [true, 'Review must belong to a user']
    }
})


ReviewSchema.index({ review: 'text' })



ReviewSchema.methods.getRatingAvg = async (productId) => {

    const result = await this.aggregate([
        {
            $match: {
                product: productId
            }
        },
        {
            $group: {
                _id: '$product',
                ratingsAverage: { $avg: '$rating' },
                ratingsQuantity: { $sum: 1 }
            }
        }
    ])

    if (result.length > 0) {
        await Product.findByIdAndUpdate(productId, {
            ratingsAverage: result[0].ratingsAverage,
            ratingsQuantity: result[0].ratingsQuantity,
        })
    } else {
        await Product.findByIdAndUpdate(productId, {
            ratingsAverage: 0,
            ratingsQuantity: 0,
        })
    }
}



ReviewSchema.post('save', async () => {
    await getRatingAvg(this.product);
})

ReviewSchema.post('remove', async() => {
    await getRatingAvg(this.product);
})
module.exports = mongoose.model('Review', ReviewSchema)


