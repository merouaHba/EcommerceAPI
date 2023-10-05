const Favourite = require('../models/favouriteModel');
const Product = require('../models/productModel');
const { StatusCodes } = require('http-status-codes');
const {
    checkPermissions
} = require('../utils');

const CustomError = require('../errors');
const validateMongoDbId = require('../utils/validateMongodbId');

const getFavourites = async (req, res) => {
    const { id } = req.body
    validateMongoDbId(id)
    const favourite = await Favourite.findOne({ user: id })
    if (!favourite) {
        throw new CustomError.NotFoundError("No favourite found")
    }
    res.status(StatusCodes.OK).json({ favourite })
}

const addFavourite = async (req, res) => {
    const { id ,productId} = req.body
    validateMongoDbId(id)
    const favourite = await Favourite.findOne({ user: id }).populate("products")
   
    if (!favourite) {
        throw new CustomError.NotFoundError("No favourite found")
    }

    // check if product exist in favourite list
    let isProductExistInFavourite = false;
    favourite.products.map(product => {
        if (product._id == productId) {
            isProductExistInFavourite = true;
        }
    })
    if (isProductExistInFavourite) {
        throw new CustomError.BadRequestError('Product is already in the favorites list')
    }
    validateMongoDbId(productId)
    const product = await Product.findOne({ _id: productId })
    if (!product) {
        throw new CustomError.NotFoundError("No product found")
    }
    favourite.products.push(product)
    favourite.save()


    
    res.status(StatusCodes.OK).json({msg:"favourite added successfully", favourite })
}
const deleteFavourite = async (req, res) => {

    const { id: productId } = req.params
    const { id } = req.body
    validateMongoDbId(id)
    const favourite = await Favourite.findOne({ user: id }).populate("products")

    if (!favourite) {
        throw new CustomError.NotFoundError("No favourite found")
    }
    validateMongoDbId(productId)
    const product = await Product.findOne({ _id: productId })
    if (!product) {
        throw new CustomError.NotFoundError("No product found")
    }
    let isProductExists = false;
    favourite.products.map(item => {
        if (item._id == id) {
            isProductExists = true;
        }
    })

    if (!isProductExists) {
        throw new CustomError.NotFoundError("No product found")
    }

   favourite.products = favourite.products.filter(product => product._id.toString() !== productId)
    console.log(favourite.products.length)
    favourite.save()



    res.status(StatusCodes.OK).json({ msg: "favourite deleted successfully", favourite })
}





module.exports = {
    getFavourites,
    addFavourite,
    deleteFavourite
}