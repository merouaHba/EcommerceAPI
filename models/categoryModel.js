const mongoose = require('mongoose');

const SubCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

// Main Category Schema
const CategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        public_id: {
            type: String,
            required: [true, 'please provide image id']
        },
        url: {
            type: String,
            required: [true, 'please provide image url']
        }
    },
    subcategories: [SubCategorySchema]  
}, {
    timestamps: true
});

CategorySchema.index({
    name: 'text',
    description: 'text',
    'subcategories.name': 'text',
    'subcategories.description': 'text'
});

module.exports = mongoose.model('Category', CategorySchema);