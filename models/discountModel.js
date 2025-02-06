const mongoose = require('mongoose');


const DISCOUNT_TYPE_PERMISSIONS = {
    ADMIN_ONLY: ['buyXgetY', 'freeShipping'],
    SELLER_ALLOWED: ['percentage', 'fixed']
};


const DiscountSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, 'Discount code is required'],
        unique: true,
        uppercase: true,
        trim: true
    },
    name: {
        type: String,
        required: [true, 'Discount name is required']
    },
    description: String,
    type: {
        type: String,
        enum: ['percentage', 'fixed', 'buyXgetY', 'freeShipping'],
        required: true
    },
    value: {
        type: Number,
        required: [ function () {
            return this.type !== 'freeShipping'
        }, 'Discount value is required'],
        validate: {
            validator: function (val) {
                if (this.type === 'freeShipping') {
                    return true;
                }
                if (this.type === 'percentage') {
                    return val > 0 && val <= 100;
                }
                return val > 0;
            },
            message: 'Invalid discount value'
        }
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true,
        validate: {
            validator: function (val) {
                return val > this.startDate;
            },
            message: 'End date must be after start date'
        }
    },
    minPurchaseAmount: {
        type: Number,
        default: 0,
        min: 0
    },
    maxDiscountAmount: {
        type: Number,
        min: 0
    },
    usageLimit: {
        type: Number,
        min: 1
    },
    usageCount: {
        type: Number,
        default: 0
    },
    perUserLimit: {
        type: Number,
        default: 1,
        min: 1
    },
    sellers: [{
        type: mongoose.Schema.ObjectId,
        ref: 'User'
    }],
    applicableProducts: [{
        type: mongoose.Schema.ObjectId,
        ref: 'Product'
    }],
    excludedProducts: [{
        type: mongoose.Schema.ObjectId,
        ref: 'Product'
    }],
    applicableCategories: [{
        type: mongoose.Schema.ObjectId,
        ref: 'Category'
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    conditions: {
        minimumItems: Number,
        maximumItems: Number,
        allowedPaymentMethods: [String],
        userGroups: [String],
        firstPurchaseOnly: {
            type: Boolean,
            default: false
        },
        combinableWithOtherDiscounts: {
            type: Boolean,
            default: false
        }
    }
}, {
    timestamps: true
});

// Indexes for better query performance
DiscountSchema.index({ code: 1 }, { unique: true });
DiscountSchema.index({ endDate: 1 });
DiscountSchema.index({ isActive: 1 });
DiscountSchema.index({ 'conditions.userGroups': 1 });
DiscountSchema.index({ sellers: 1 });

// Methods
DiscountSchema.methods = {
    isValid() {
        const now = new Date();
        return (
            this.isActive &&
            now >= this.startDate &&
            now <= this.endDate &&
            (!this.usageLimit || this.usageCount < this.usageLimit)
        );
    },

    async validateForUser (userId, orderAmount, itemCount = 1) {
        // Check if the discount is valid
        if (!this.isValid()) {
            throw new Error('Discount is not valid');
        }

        // Check minimum purchase amount
        if (orderAmount < this.minPurchaseAmount) {
            throw new Error(`Minimum purchase amount of ${this.minPurchaseAmount} required`);
        }

        // Check user usage limit
        const userUsage = await DiscountUsage.countDocuments({
            discount: this._id,
            user: userId
        });

        if (userUsage >= this.perUserLimit) {
            throw new Error('User has exceeded usage limit for this discount');
        }

        // Check first purchase condition
        if (this.conditions.firstPurchaseOnly) {
            const previousOrders = await mongoose.model('Order').countDocuments({
                user: userId,
                status: 'completed'
            });
            if (previousOrders > 0) {
                throw new Error('Discount is only valid for first purchase');
            }
        }

        return true;
    },
    calculateDiscount(orderAmount, quantity = 1) {
        if (!this.isValid()) return 0;

        let discountAmount = 0;

        switch (this.type) {
            case 'percentage':
                discountAmount = (orderAmount * this.value) / 100;
                break;
            case 'fixed':
                discountAmount = this.value;
                break;
            case 'buyXgetY':
                const freeItems = Math.floor(quantity / (this.conditions.minimumItems + 1));
                discountAmount = freeItems * (orderAmount / quantity);
                break;
            case 'freeShipping':
                // Assuming shipping cost is passed separately or calculated elsewhere
                return 0;
        }

        if (this.maxDiscountAmount) {
            discountAmount = Math.min(discountAmount, this.maxDiscountAmount);
        }

        return Math.min(discountAmount, orderAmount);
    }
};

// Pre-save middleware
DiscountSchema.pre('save', function (next) {
    if (this.isModified('code')) {
        this.code = this.code.toUpperCase();
    }
    next();
});

// Virtual for time remaining
DiscountSchema.virtual('timeRemaining').get(function () {
    return this.endDate > new Date() ?
        Math.ceil((this.endDate - new Date()) / (1000 * 60 * 60 * 24)) :
        0;
});

// Usage tracking schema
const DiscountUsageSchema = new mongoose.Schema({
    discount: {
        type: mongoose.Schema.ObjectId,
        ref: 'Discount',
        required: true
    },
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true
    },
    order: {
        type: mongoose.Schema.ObjectId,
        ref: 'Order',
        required: true
    },
    amountSaved: {
        type: Number,
        required: true,
        min: 0
    },
    usedAt: {
        type: Date,
        default: Date.now
    }
});
const DiscountUsage = mongoose.model('DiscountUsage', DiscountUsageSchema);
const Discount = mongoose.model('Discount', DiscountSchema);
module.exports = {
    Discount,
    DiscountUsage
};