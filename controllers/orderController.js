var slugify = require('slugify')
const Product = require('../models/productModel');
const Order = require('../models/orderModel');
const { StatusCodes } = require('http-status-codes');


const { uploadFile, destroyFile } = require('../utils/cloudinary')
const CustomError = require('../errors');
const { checkPermissions } = require('../utils');
const validateMongoDbId = require('../utils/validateMongodbId');

const getAllOrders = async (req, res) => {
  // const id = req.user._id
  const id = req.body._id

  const orders = await Order.aggregate([
    { $unwind:{path: '$cartItems'} },
    {
      $lookup: {
        from: 'products',
        localField: 'cartItems.product',
        foreignField: '_id',
        as: 'cartItems.product'
      },
    },
    // {
    //   $match: {
    //     'cartItems.product.seller':'642e15869c0c48ea7ee741b6'
    //   }
    // }
  ]);
  if (!orders) {
    throw new CustomError.NotFoundError("No order found")
  }
  console.log(orders[0].cartItems?.product[0]?.seller == '642e15869c0c48ea7ee741b6')
// const sellerOrders = orders.filter((order) => { order.cartItems.product.seller !='642e15869c0c48ea7ee741b6'})
  res.status(StatusCodes.OK).json({ orders })
}
const getMyOrders = async (req, res) => {

}
const getOrder = async (req, res) => {

}

const createOrder = async (req, res) => {
  // const { _id } = req.user
  const order = await Order.create({ ...req.body, })
  res.status(StatusCodes.CREATED).json({ msg: "discount created successfully", order })

}

const deleteOrder = async (req, res) => {

}
const cancelOrder = async (req, res) => {

}

module.exports = {
  getAllOrders,
  createOrder,
};