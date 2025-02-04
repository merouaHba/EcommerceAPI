const mongoose = require('mongoose');

// Product Variation Schema with enhanced inventory management
const ProductVariationSchema = new mongoose.Schema({
    attributes: {
        type: Map,
        of: String,
        required: true
    },
    sku: {
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true
    },
    quantity: {
        type: Number,
        default: 0
    },
    lowStockThreshold: {
        type: Number,
        default: 5
    },
    isOutOfStock: {
        type: Boolean,
        default: false
    },
    reservedQuantity: {
        type: Number,
        default: 0
    },
    images: [{
        public_id: String,
        url: String
    }]
});
ProductVariationSchema.index(
    { sku: 1 },
    { unique: true, sparse: true, background: true }
);
ProductVariationSchema.pre('validate', function (next) {
    // Skip validation if no variations or no SKU
    if (!this.sku) return next();

    // Check SKU uniqueness within current product's variations
    const duplicateSku = this.parent().variations.some((variation, index) =>
        variation.sku === this.sku && variation !== this
    );

    if (duplicateSku) {
        return next(new Error('Duplicate SKU not allowed'));
    }

    next();
});
// Enhanced Product Schema with comprehensive inventory management
const ProductSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'A product must have a name'],
        trim: true
    },
    slug: String,
    mainImage: {
        public_id: {
            type: String,
            required: [true, 'A product must have a main image id']
        },
        url: {
            type: String,
            required: [true, 'A product must have a main image url']
        }
    },
    images: [{
        public_id: String,
        url: String
    }],
    description: {
        type: String,
        required: [true, 'A product must have a description']
    },
    shortDescription: {
        type: String
    },
    category: {
        type: mongoose.Schema.ObjectId,
        ref: 'Category',
        required: [true, 'A product must have a category']
    },
    subcategory: {
        type: mongoose.Schema.ObjectId,
        ref: 'Category'
    },
    seller: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    brand: {
        type: String
    },
    // Inventory Management Fields
    inventoryManagement: {
        type: String,
        enum: ['simple', 'variation'],
        default: 'simple'
    },
    quantity: {
        type: Number,
        default: 0,
        validate: {
            validator: function (value) {
                return value >= 0;
            },
            message: 'Quantity cannot be negative'
        }
    },
    lowStockThreshold: {
        type: Number,
        default: 5
    },
    isOutOfStock: {
        type: Boolean,
        default: false
    },
    isLowStock: {
        type: Boolean,
        default: false
    },
    allowBackorders: {
        type: Boolean,
        default: false
    },
    backorderLimit: {
        type: Number,
        default: 0
    },
    backorderCount: {
        type: Number,
        default: 0
    },
    reservedQuantity: {
        type: Number,
        default: 0
    },
    sold: {
        type: Number,
        default: 0
    },
    stockStatus: {
        type: String,
        enum: ['in_stock', 'out_of_stock', 'low_stock', 'backorder'],
        default: 'out_of_stock'
    },
    restockDate: {
        type: Date
    },
    // Product Variation Management
    attributes: [{
        name: String,
        values: [String]
    }],
    variations: [ProductVariationSchema],
    hasVariations: {
        type: Boolean,
        default: false
    },
    // Pricing Fields
    basePrice: {
        type: Number,
        required: true
    },
    salePrice: {
        type: Number,
        validate: {
            validator: function (value) {
                return !value || value < this.basePrice;
            },
            message: 'Sale price must be less than base price'
        }
    },
    saleStartDate: Date,
    saleEndDate: Date,
    taxRate: {
        type: Number,
        default: 0
    },
    // Shipping Information
    shippingOptions: [{
        method: {
            type: String,
            enum: ['standard', 'express', 'overnight']
        },
        price: {
            type: Number,
            required: true
        },
        deliveryTime: {
            min: Number, // days
            max: Number
        },
        applicableRegions: [String], // countries or regions
        conditions: {
            minOrderValue: Number,
            maxOrderWeight: Number
        }
    }],
    shippingWeight: {
        type: Number,
        default: 0
    },
    dimensions: {
        length: Number,
        width: Number,
        height: Number,
        unit: {
            type: String,
            enum: ['cm', 'in'],
            default: 'cm'
        }
    },
    // Product Type
    isDigital: {
        type: Boolean,
        default: false
    },
    digitalDownloadInfo: {
        downloadLink: String,
        expiryDays: Number
    },
    // Product Status
    status: {
        type: String,
        enum: ['draft', 'active', 'inactive', 'deleted'],
        default: 'draft'
    },
    metadata: {
        type: Map,
        of: String
    },
    // Ratings
    ratingsAverage: {
        type: Number,
        default: 0,
        min: [0, 'Rating must be above 0'],
        max: [5, 'Rating must be below 5.0'],
    },
    ratingsQuantity: {
        type: Number,
        default: 0,
    },
    ratingDistribution: {
        oneStar: {
            type: Number,
            default: 0
        },
        twoStars: {
            type: Number,
            default: 0
        },
        threeStars: {
            type: Number,
            default: 0
        },
        fourStars: {
            type: Number,
            default: 0
        },
        fiveStars: {
            type: Number,
            default: 0
        }
    },
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        getters: true,
        versionKey: false,

        transform: function (doc, ret) {
            delete ret.id;
            if (ret.images) {
                ret.images = ret.images.map(img => {
                    const { id,_id, ...rest } = img;
                    return rest;
                });
            }
            return ret;
        }
    },
    toObject: { virtuals: true }
});

// Indexes
ProductSchema.index({ name: 'text', description: 'text', shortDescription: 'text', brand: 'text','category.name':'text','subcategory.name':'text'});
ProductSchema.index({ stockStatus: 1 });
ProductSchema.index({ seller: 1, stockStatus: 1 });

// Pre-save middleware to update stock status
ProductSchema.pre('save', (next) =>{
    // Update stock status based on quantity and threshold
    if (this.inventoryManagement === 'simple') {
        this.isOutOfStock = this.quantity <= 0;
        this.isLowStock = this.quantity > 0 && this.quantity <= this.lowStockThreshold;

        if (this.isOutOfStock && this.allowBackorders) {
            this.stockStatus = 'backorder';
        } else if (this.isOutOfStock) {
            this.stockStatus = 'out_of_stock';
        } else if (this.isLowStock) {
            this.stockStatus = 'low_stock';
        } else {
            this.stockStatus = 'in_stock';
        }
    }
    next();
});

// Methods for inventory management
ProductSchema.methods = {
    // Check if product can be purchased
    canPurchase(requestedQuantity) {
        if (this.isDigital) return true;

        const availableQuantity = this.quantity - this.reservedQuantity;
        if (availableQuantity >= requestedQuantity) return true;
        if (this.allowBackorders) {
            const remainingBackorders = this.backorderLimit - this.backorderCount;
            return remainingBackorders >= requestedQuantity;
        }
        return false;
    },

    // Reserve inventory for an order
    async reserveInventory(quantity) {
        if (this.isDigital) return true;

        if (!this.canPurchase(quantity)) {
            throw new Error('Insufficient inventory');
        }

        this.reservedQuantity += quantity;
        if (this.quantity < quantity) {
            this.backorderCount += quantity - this.quantity;
        }
        return await this.save();
    },

    // Release reserved inventory
    async releaseInventory(quantity) {
        if (this.isDigital) return true;

        this.reservedQuantity = Math.max(0, this.reservedQuantity - quantity);
        if (this.backorderCount > 0) {
            this.backorderCount = Math.max(0, this.backorderCount - quantity);
        }
        return await this.save();
    },

    // Complete a sale
    async completeSale(quantity) {
        if (!this.isDigital) {
            this.quantity = Math.max(0, this.quantity - quantity);
            this.reservedQuantity = Math.max(0, this.reservedQuantity - quantity);
        }
        this.sold += quantity;
        return await this.save();
    }
};

// Virtual populate reviews
ProductSchema.virtual('reviews', {
    ref: 'Review',
    foreignField: 'product',
    localField: '_id'
});

module.exports = mongoose.model('Product', ProductSchema);