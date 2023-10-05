const Cart = require('../models/cartModel');
const Product = require('../models/productModel');
const { StatusCodes } = require('http-status-codes');
const {
    checkPermissions
} = require('../utils');

const CustomError = require('../errors');
const validateMongoDbId = require('../utils/validateMongodbId');

const getCart = async (req, res) => {
    const { id, role } = req.body
    validateMongoDbId(id)
    const cart = await Cart.findOne({ orderBy: id })
    if (!cart) {
        throw new CustomError.NotFoundError("No cart found")
    }
    checkPermissions(cart.orderBy,id,role)
    res.status(StatusCodes.OK).json({ cart})
}
const updateCart = async (req, res) => {
    const { userId,role } = req.body
    const { id, quantity } = req.body.product
    validateMongoDbId(userId)
    const cart = await Cart.findOne({ orderBy: userId }).populate("items.product")
    if (!cart) {
        throw new CustomError.NotFoundError("No cart found")
    }
    checkPermissions(cart.orderBy, userId, role)
    validateMongoDbId(id)
    const product = await Product.findOne({ _id: id })
    let isProductExists = false;
    cart.items.map(item => {
        if (item.product._id == id) {
            isProductExists = true;
        }
    })
    let item ={}
    if (isProductExists) {

         item = {
            product: id,
            totalProductQuantity: quantity,
            totalProductPrice: product.price * quantity,
        }
        cart.items = cart.items.map(cartItem => {
            if (cartItem.product._id == id) {
                cart.totalQuantity = parseInt(cart.totalQuantity) - parseInt(cartItem.totalProductQuantity)
                cart.totalPrice = parseInt(cart.totalPrice) - parseInt(cartItem.totalProductPrice)
                return item
            }
            return cartItem
        })
        cart.totalQuantity = parseInt(cart.totalQuantity) + parseInt(item.totalProductQuantity)
        cart.totalPrice = parseInt(cart.totalPrice) + parseInt(item.totalProductPrice)
        cart.save()
        res.status(StatusCodes.OK).json({ msg: "product quantity added succefully", cart })

    } else {
        
        item = {
            product: id,
            totalProductQuantity: quantity,
            totalProductPrice: product.price * quantity,
        }
        cart.items.push(item)
        cart.totalQuantity = parseInt(cart.totalQuantity) + parseInt(item.totalProductQuantity)
        cart.totalPrice = parseInt(cart.totalPrice) + parseInt(item.totalProductPrice)
        cart.save()
        res.status(StatusCodes.OK).json({ msg: "product added succefully", cart })
    }
  
}
const deleteItemFromCart = async (req, res) => {
    const { userId,role } = req.body
    const { id } = req.params
    validateMongoDbId(userId)
    const cart = await Cart.findOne({ orderBy: userId }).populate("items.product")
    if (!cart) {
        throw new CustomError.NotFoundError("No cart found")
    }
    checkPermissions(cart.orderBy, userId, role)

    let isProductExists = false;
    cart.items.map(item => {
        if (item.product._id == id) {
            isProductExists = true;
        }
    })

    if (!isProductExists) {
        throw new CustomError.NotFoundError("No product found")
    }

    cart.items = cart.items.filter(item => {
        // console.log(item.product._id.toString() , id)
        if (item.product._id.toString() === id) {
            if (cart.totalQuantity > 0 ){
                cart.totalQuantity = parseInt(cart.totalQuantity) - parseInt(item.totalProductQuantity)
            }
            if (cart.totalPrice > 0 ){
                cart.totalPrice = parseInt(cart.totalPrice) - parseInt(item.totalProductPrice)
            }
            return
        }
        return item
    })
    // cart.items = cart.items.slice(0,0).push(...products)
    cart.save()
    res.status(StatusCodes.OK).json({ msg: "product deleted succefully", cart })
}
const deleteAllItemsFromCart = async (req, res) => {
    const { userId, role } = req.body
    validateMongoDbId(userId)
    const cart = await Cart.findOne({ orderBy: userId }).populate("items.product")
    if (!cart) {
        throw new CustomError.NotFoundError("No cart found")
    }
    checkPermissions(cart.orderBy, userId, role)

    if (cart.items.length === 0) {
        throw new CustomError.NotFoundError("No product found")
    }

    cart.items = []
    cart.totalPrice = 0
    cart.totalQuantity = 0
    
    cart.save()
    res.status(StatusCodes.OK).json({ msg: "product deleted succefully", cart })
}




module.exports = {
    getCart,
    updateCart,
    deleteItemFromCart,
    deleteAllItemsFromCart,
}