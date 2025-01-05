const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const validator = require('validator');
const Cart = require('./cartModel')
const Favourite = require('./favouriteModel')

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
        required: [function () {
            return  !this.googleId && !this.facebookId && !this.appleId;
        }, 'Please provide an email or mobile number'],
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
        // required: [function () {
        //     return !this.email && !this.googleId && !this.facebookId && !this.appleId;
        // }, 'Please provide an email or mobile number'],
        unique: true,
        validate: {
            validator: validator.isMobilePhone,
            message: 'Please provide valid mobile number',
        },
    },
    password: {
        type: String,
        required: [function () {
            return !this.googleId && !this.facebookId && !this.appleId;
        }, 'Please provide a password'],
        trim: true,
        minlength: [8, 'Password must be at least 8 characters long'],
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
    balance: {
        type: Number,
        default: 0,
    },
    stripeAccountId:String,
    cart: { type: mongoose.Schema.Types.ObjectId, ref: "Cart" },
    address: {
        type: String,
    },
    wishlist: { type: mongoose.Schema.Types.ObjectId, ref: "Favourite" },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    facebookId: {
        type: String,
        unique: true,
        sparse: true
    },
    appleId: {
        type: String,
        unique: true,
        sparse: true
    },
    oauth: {
        accessToken: String,
        refreshToken: String,
        tokenExpiry: Date
    },
    verificationToken: String,
    isVerified: {
        type: Boolean,
        default: false,
    },
    verified: Date,
    vericationTokenExpirationDate: Date,
    refreshToken: String,
    discountCode: String

}, { timestamps: true })

UserSchema.index({ firstname :'text',lastname:'text'})
UserSchema.index({ email :1,mobile:1})

UserSchema.pre('save', async function () {
        if (this.role === 'user') {        
            const CartExist = await Cart.findOne({ user: this._id })   
            console.log(CartExist, !CartExist)
            if (!CartExist) {               
                const cart = await Cart.create({ user: this._id })
                this.cart = cart._id
            }
            const FavouriteExist = await Favourite.findOne({ user: this._id }) 
            console.log(FavouriteExist, !FavouriteExist)
            if (!FavouriteExist) {
                const favourite = await Favourite.create({ user: this._id })
                this.wishlist = favourite._id
            }
        }

    
    if (this.password && this.isModified('password')) {
        const salt = await bcrypt.genSalt(10)
        this.password = await bcrypt.hash(this.password, salt)
    }
})


UserSchema.methods.comparePassword = async function (canditatePassword) {
    console.log(this)
    console.log(this.password)
    if (!this.password) {
        console.log(!this.password)
        return false
    }
    const isMatch = await bcrypt.compare(canditatePassword, this.password)
    
    return isMatch
}

module.exports = mongoose.model('User', UserSchema)