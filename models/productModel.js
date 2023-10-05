const mongoose = require('mongoose')


const ProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'A product must have a name'],
        trim: true
    },
    slug: String,
    mainImage: {
        type: {
            public_id: {
                type: String,
                required: [true, 'A product must have a main image id']

            },
            url: {
                type: String,
                required: [true, 'A product must have a main image url']
            }
        },
        required: [true, 'A product must have a main image']


    },
    images: {
        type: [{
            public_id: {
                type: String,
                required: [true, 'A product must have a main image id']

            },
            url: {
                type: String,
                required: [true, 'A product must have a main image url']
            }
        }],
        required: [true, 'A product must have sub images']
    },

    description: {
        type: String,
        required: [true, 'A product must have a description']
    },
    category: {
        type: mongoose.Schema.ObjectId,
        ref: 'Category'
    },
    seller: {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    },
    price: {
        type: Number,
        required: true,
        default: 0
    },
    priceAfterDiscount: {
        type: Number,
        required: true,
        default: 0
    },
    priceDiscount: {
        type: Number,
        validate: {
            validator: function (value) {
                // this only points to current doc on NEW documnet creation
                return value < this.price;
            },
            message: 'Discount price ({VALUE}) should be below regular price'
        }
    },
    quantity: {
        type: Number,
        default: 0
    },
    sold: {
        type: Number,
        default: 0
    },
    isOutOfStock: {
        type: Boolean,
        default: false
    },
    ratingsAverage: {
        type: Number,
        default: 0,
        min: [1, 'Rating must be above 1.0'],
        max: [5, 'Rating must be below 5.0'],
    },
    ratingsQuantity: {
        type: Number,
        default: 0,
    }
})









module.exports = mongoose.model('Product', ProductSchema)


