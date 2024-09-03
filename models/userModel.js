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
    balance: {
        type: Number,
        default: 0,
    },
    stripeAccountId:String,
    cart: { type: mongoose.Schema.Types.ObjectId, ref: "Cart" },
    // shop: {
    //     type: String,
    //     default: "",
    // },
    address: {
        type: String,
    },
    wishlist: { type: mongoose.Schema.Types.ObjectId, ref: "Favourite" },
    verificationToken: String,
    isVerified: {
        type: Boolean,
        default: false,
    },
    verified: Date,
   vericationTokenExpirationDate:Date,
    discountCode: String

})

UserSchema.index({ firstname :'text',lastname:'text'})

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

    if (!this.isModified('password')) return;

    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
})


UserSchema.methods.comparePassword = async function (canditatePassword) {
    const isMatch = await bcrypt.compare(canditatePassword, this.password)
    return isMatch
}

module.exports = mongoose.model('User', UserSchema)