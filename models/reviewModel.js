const mongoose = require('mongoose');
const Product = require('./productModel');

const ReviewSchema = new mongoose.Schema({
    review: {
        type: String,
        required: [true, 'Review cannot be empty!'],
        trim: true,
        maxLength: [1000, 'Review cannot exceed 1000 characters']
    },
    rating: {
        type: Number,
        min: 1,
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
    },
    helpful: [{
        type: mongoose.Types.ObjectId,
        ref: 'User'
    }],
    reported: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date
    }
}, {
    timestamps: true,
    toJSON: {
        virtuals: true, getters: true, versionKey: false, transform: function (doc, ret) {
            delete ret.id;
            return ret;
        }
    },
    toObject: { virtuals: true }
});

// Prevent duplicate reviews
ReviewSchema.index({ product: 1, user: 1 }, { unique: true });
ReviewSchema.index({ review: 'text' });

ReviewSchema.pre('save', async function (next) {
    if (this.isModified('review') || this.isModified('rating')) {
        this.updatedAt = Date.now();
    }
    next();
});

ReviewSchema.methods.getRatingAvg = async function (productId) {
    const stats = await mongoose.model('Review').aggregate([
        {
            $match: { product: productId }
        },
        {
            $group: {
                _id: '$product',
                ratingsAverage: { $avg: '$rating' },
                ratingsQuantity: { $sum: 1 },
                oneStar: {
                    $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] }
                },
                twoStars: {
                    $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] }
                },
                threeStars: {
                    $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] }
                },
                fourStars: {
                    $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] }
                },
                fiveStars: {
                    $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] }
                }
            }
        }
    ]);

    const ratingData = stats.length > 0 ? {
        ratingsAverage: Math.round(stats[0].ratingsAverage * 10) / 10,
        ratingsQuantity: stats[0].ratingsQuantity,
        ratingDistribution: {
            1: stats[0].oneStar,
            2: stats[0].twoStars,
            3: stats[0].threeStars,
            4: stats[0].fourStars,
            5: stats[0].fiveStars
        }
    } : {
        ratingsAverage: 0,
        ratingsQuantity: 0,
        ratingDistribution: {
            1: 0, 2: 0, 3: 0, 4: 0, 5: 0
        }
    };

    await Product.findByIdAndUpdate(productId, ratingData);
};

ReviewSchema.post('save', async function () {
    await this.getRatingAvg(this.product);
});

ReviewSchema.post('remove', async function () {
    await this.getRatingAvg(this.product);
});

module.exports = mongoose.model('Review', ReviewSchema);
