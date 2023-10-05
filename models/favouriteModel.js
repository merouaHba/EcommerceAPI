

const mongoose = require('mongoose')



const FavouriteSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    products: [
        {
                type: mongoose.Types.ObjectId,
                ref: 'Product',
           
        }
    ],
})


module.exports = mongoose.model('Favourite', FavouriteSchema)


