const Cart = require('../models/cartModel');
const Product = require('../models/productModel');
const { StatusCodes } = require('http-status-codes');
const {
    checkPermissions
} = require('../utils');

const CustomError = require('../errors');
const validateMongoDbId = require('../utils/validateMongodbId');

const getCart = async (req, res) => {
    const { _id: id, role } = req.user
    validateMongoDbId(id)
    const cart = await Cart.findOne({ user: id })

    res.status(StatusCodes.OK).json({ cart })
}


const updateCart = async (req, res) => {
    const { _id, role } = req.user
    const { id, quantity } = req.body.product
    validateMongoDbId(_id)
    const cart = await Cart.findOne({ user: _id })
    console.log(cart)

    validateMongoDbId(id)
    const product = await Product.findOne({ _id: id })
    if (!product) {
        throw new CustomError.NotFoundError('Product not found')
    }

    let isProductExists = cart.items.some(item => {
        return item.product == id
    })

    // check if product not out of stock

    if (product.quantity = 0) {
        throw new CustomError.BadRequestError('Product out of stock')
    }
 
    // check product quantity
 
        if (product.quantity < quantity) {
            throw new CustomError.BadRequestError('Not enough quantity')
        }

    
    let item = {}
    if (isProductExists) {

       
        cart.items = cart.items.map(cartItem => {
            if (cartItem.product == id) {
                cart.totalQuantity = parseInt(cart.totalQuantity) - parseInt(cartItem.quantity) + parseInt(quantity)
                cart.totalPrice = parseInt(cart.totalPrice) - (parseInt(cartItem.price) * parseInt(cartItem.quantity)) + (parseInt(cartItem.price)* parseInt(quantity))
               
                cartItem.quantity = quantity
            }
            return cartItem
        })
        // cart.totalQuantity = parseInt(cart.totalQuantity) + parseInt(item.quantity)
        // cart.totalPrice = parseInt(cart.totalPrice) + (parseInt(item.price) * parseInt(quantity))
        await cart.save()
        res.status(StatusCodes.OK).json({ msg: "product quantity updated succefully", cart })

    } else {

        item = {
            product: id,
            quantity: quantity,
            price: product.price,
        }
        cart.items.push(item)
        cart.totalQuantity = parseInt(cart.totalQuantity) + parseInt(item.quantity)
        cart.totalPrice = parseInt(cart.totalPrice) + (parseInt(item.price) * parseInt(item.quantity))
        await cart.save()
        res.status(StatusCodes.OK).json({ msg: "product added succefully", cart })
    }

}

const deleteItemFromCart = async (req, res) => {
    const { _id, role } = req.user
    const { id } = req.params
    validateMongoDbId(id)
    const cart = await Cart.findOne({ user: _id })


    let isProductExists = cart.items.some(item => {
        return item.product == id
    })

    if (!isProductExists) {
        throw new CustomError.NotFoundError("No product found")
    }

    cart.items = cart.items.filter(item => {
        if (item.product == id) {
            if (cart.totalQuantity > 0 && (parseInt(cart.totalQuantity) - parseInt(item.quantity)) >= 0) {
                cart.totalQuantity = parseInt(cart.totalQuantity) - parseInt(item.quantity)
            }
            if (cart.totalPrice > 0 && (parseInt(cart.totalPrice) - (parseInt(item.price) * parseInt(item.quantity)))>= 0) {
                cart.totalPrice = parseInt(cart.totalPrice) - (parseInt(item.price) * parseInt(item.quantity))
            }
            return
        }
        return item
    })
    cart.save()
    res.status(StatusCodes.OK).json({ msg: "product deleted succefully", cart })
}
const deleteAllItemsFromCart = async (req, res) => {
    const { _id, role } = req.user
    validateMongoDbId(_id)
    const cart = await Cart.findOne({ user: _id })

    if (cart.items.length === 0) {
        throw new CustomError.NotFoundError("No product found")
    }

    cart.items = []
    cart.totalPrice = 0
    cart.totalQuantity = 0

    await cart.save()
    res.status(StatusCodes.OK).json({ msg: "product deleted succefully", cart })
}




module.exports = {
    getCart,
    updateCart,
    deleteItemFromCart,
    deleteAllItemsFromCart,
}