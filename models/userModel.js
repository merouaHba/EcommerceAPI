const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const validator = require('validator');


const UserSchema = new mongoose.Schema({
    firstname: {
        type: String,
        required: [true, 'Please provide first name'],
        maxlength: 50,
        minlength: 3,
    },
    lastname: {
        type: String,
        required: [true, 'Please provide last name'],
        maxlength: 50,
        minlength: 3,
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
        trim: true,
        lowercase: true,
        validate: {
            validator: validator.isEmail,
            message: 'Please provide valid email',
        },
    },
    mobile: {
        type: String,
        required: [true, 'Please provide mobile number'],
        unique: true,
        validate: {
            validator: validator.isMobilePhone,
            message: 'Please provide valid mobile number',
        },
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        trim: true,
        minlength: 8,
    },
    profilePicture: { 
        public_id: {
            type: String,
        },
        url: {
            type: String,
        }
     },
    role: {
        type: String,
        enum: ['user', 'admin', 'seller'],
        default: 'user',
    },
    isBlocked: {
        type: Boolean,
        default: false,
    },
    cart: {
        type: Array,
        default: [],
    },
    shop: {
        type: String,
        default: "",
    },
    address: {
        type: String,
    },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    verificationToken: String,
    isVerified: {
        type: Boolean,
        default: false,
    },
    verified: Date,
    verificationToken: {
        type: String,
    },
   vericationTokenExpirationDate: {
        type: Date,
    },
    discountCode: {
        type: String
    }

})

UserSchema.pre('save', async function () {
    if (!this.isModified('password')) return;

    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
})


UserSchema.methods.comparePassword = async function (canditatePassword) {
    const isMatch = await bcrypt.compare(canditatePassword, this.password)
    return isMatch
}

module.exports = mongoose.model('User', UserSchema)