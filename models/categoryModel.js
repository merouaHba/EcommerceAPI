const mongoose = require('mongoose');

// Base schema for shared fields
const baseFields = {
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters'],
        maxlength: [50, 'Name cannot exceed 50 characters']
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        minlength: [10, 'Description must be at least 10 characters'],
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    slug: {
        type: String,
        unique: true
    },
    image: {
        public_id: {
            type: String,
            required: [true, 'Image public ID is required']
        },
        url: {
            type: String,
            required: [true, 'Image URL is required'],
            validate: {
                validator: function (v) {
                    return /^https?:\/\/.+/.test(v);
                },
                message: 'Invalid image URL format'
            }
        }
    },
    metadata: {
        type: Map,
        of: String,
        default: new Map()
    }
};

// Single Category Schema with self-referencing for subcategories
const CategorySchema = new mongoose.Schema({
    ...baseFields,
    parentCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
    },
    displayOrder: {
        type: Number,
        default: 0
    },
    featured: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
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

// Pre-save middleware to generate slug
CategorySchema.pre('save', function (next) {
    if (this.isModified('name')) {
        this.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }
    next();
});

// Virtual for subcategories
CategorySchema.virtual('subcategories', {
    ref: 'Category', // Self-reference
    localField: '_id',
    foreignField: 'parentCategory',
    justOne: false
});

// Virtual for product count
CategorySchema.virtual('productCount', {
    ref: 'Product',
    localField: '_id',
    foreignField: 'category',
    count: true
});

// Method to get formatted dates
CategorySchema.methods.getFormattedDates = function () {
    return {
        created: this.createdAt.toLocaleDateString(),
        updated: this.updatedAt.toLocaleDateString()
    };
};

// Method to update metadata
CategorySchema.methods.setMetadata = function (key, value) {
    this.metadata.set(key, value);
    return this.save();
};

// Method to get parent category
CategorySchema.methods.getParentCategory = async function () {
    return this.model('Category').findById(this.parentCategory);
};

// Method to get sibling categories
CategorySchema.methods.getSiblings = async function () {
    return this.model('Category').find({
        parentCategory: this.parentCategory,
        _id: { $ne: this._id }
    });
};

// Method to find similar categories
CategorySchema.methods.findSimilarCategories = async function () {
    return this.model('Category').find({
        _id: { $ne: this._id },
        $text: { $search: this.name }
    }).limit(5);
};

// Text indexes for search
CategorySchema.index({
    name: 'text',
    description: 'text'
}, {
    weights: {
        name: 10,
        description: 5
    }
});

// Compound indexes for efficient querying
CategorySchema.index({ status: 1, displayOrder: 1 });
CategorySchema.index({ parentCategory: 1, status: 1, displayOrder: 1 });
CategorySchema.index({ name: 1, parentCategory: 1 }, { unique: true });


// Create the model
const Category = mongoose.model('Category', CategorySchema);

module.exports = Category;