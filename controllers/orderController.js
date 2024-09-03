const { Order, SubOrder } = require('../models/orderModel');
const Cart = require('../models/cartModel');
const Product = require('../models/productModel');
const Transaction = require('../models/transactionModel');
const User = require('../models/userModel');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { StatusCodes } = require('http-status-codes');
const mongoose = require('mongoose');
const { checkout } = require('../services/paymentService')

const CustomError = require('../errors');
const validateMongoDbId = require('../utils/validateMongodbId');
const { checkPermissions, isPastTenDays, groupItemsBySeller, capitalize } = require('../utils');

const getAllOrders = async (req, res) => {

  // const orders = await Order.find().populate('user', 'firstname lastname').populate('cartItems.product').populate('subOrders')

  // res.status(StatusCodes.OK).json({ orders, nbOrders: orders.length })
  const result = await apiFeatures(req, Order, [['user', 'firstname lastname'], ['subOrders']]);

  res.status(StatusCodes.OK).json({ ...result });
}
// const getUserOrders = async (req, res) => {
//   const user = req.user
//   user._id = user.role === 'admin' ? req.params.id : user._id

//   validateMongoDbId(user._id)

//   const orders = await Order.find({ user: user._id }).populate('user', 'firstname lastname')
//   if (!orders || orders.length === 0) {
//     throw new CustomError.NotFoundError("No order found")
//   }
//   res.status(StatusCodes.OK).json({ orders, nbOrders: orders.length })
// }
// const getSellerOrders = async (req, res) => {
//   const user = req.user
//   sellerId = user.role === 'admin' ? req.params.id : user._id

//   validateMongoDbId(sellerId)

//   sellerId = new mongoose.Types.ObjectId(sellerId)
//   const orders = await Order.aggregate([
//     { $unwind: { path: '$cartItems' } },
//     {
//       $lookup: {
//         from: 'products',
//         localField: 'cartItems.product',
//         foreignField: '_id',
//         as: 'cartItems.product'
//       },
//     },
//     { $unwind: { path: '$cartItems.product' } },
//     // {
//     //   $project: { 
//     //     'cartItems.product':1
//     //   }
//     // },
//     {
//       $match: { 'cartItems.product.seller': sellerId }
//     }
//   ])

//   if (!orders || orders.length === 0) {
//     throw new CustomError.NotFoundError("No order found")
//   }
//   res.status(StatusCodes.OK).json({ orders, nbOrders: orders.length })

// }


const getMyOrders = async (req, res) => {
  const {_id,role} = req.user
  let orders
  if (role == "user") {
    orders = await Order.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(_id) } },
      {
        $lookup: {
          from: 'products',
          localField: 'cartItems.product',
          foreignField: '_id',
          as: 'cartItems.product'
        }
      },
      {
        $lookup: {
          from: 'suborders',
          localField: 'subOrders',
          foreignField: '_id',
          as: 'subOrders'
        }
      },
      {
        $project: {
          subOrders:1,
          subOrders: {
            $filter: {
              input: '$subOrders',
              as:'subOrder',
              cond: { $in: ['$$subOrder.status', ['Processing', 'Shipped', 'Delivered']] }
              
            }
          },
          subOrdersLength: { $size: '$subOrders' },
          user: 1,
          shippingAddress: 1,
          totalPrice: 1,
          taxPrice: 1,
          shippingPrice: 1,
          phone: 1,
          status: 1,
          cartItems: 1,
          
        }
      },
      {
        $match: {
         subOrders:{ $ne:[]}
        //   // $expr: {
        //   //   $gt:[{$size:'$subOrders'},0]
          //   // }
      
        }
      },
    ])
  //  populate('subOrders').populate('subOrders.seller').populate('cartItems.product')
    if (!orders) {
      throw new CustomError.NotFoundError("No orders found")
    }
  } else {
    orders = await SubOrder.find({ seller: _id, status: { $in: [ 'Processing', 'Shipped', 'Delivered'] }}).populate('user','firstname lastname')
    if (!orders) {
      throw new CustomError.NotFoundError("No order found")
    }
}

  //  orders = await Order.aggregate([
  //   { $unwind: { path: '$cartItems' } },
  //   {
  //     $lookup: {
  //       from: 'products',
  //       localField: 'cartItems.product',
  //       foreignField: '_id',
  //       as: 'cartItems.product'
  //     },
  //   },
  //   { $unwind: { path: '$cartItems.product' } },
  //   // {
  //   //   $project: { 
  //   //     'cartItems.product':1
  //   //   }
  //   // },
  //   {
  //     $match: { 'cartItems.product.seller': sellerId }
  //   }
  // ])
  
  res.status(StatusCodes.OK).json({ orders, nbOrders: orders.length })

}

const getUserOrders = async (req, res) => {
  const { id } = req.params
const user = await User.findById(id)
  if (!user) {
  throw new CustomError.NotFoundError(`No user found with this ${id}`)
  }
  const {_id,role} = user
  let orders
  if (role == "user") {
    orders = await Order.find({ user: _id }).populate('subOrders').populate('subOrders.seller').populate('cartItems.product')
    if (!orders) {
      throw new CustomError.NotFoundError("No orders found")
    }
  } else {
    orders = await SubOrder.find({ seller: _id })
    if (!orders) {
      throw new CustomError.NotFoundError("No order found")
    }
  }



  res.status(StatusCodes.OK).json({ orders, nbOrders: orders.length })

}

const getOrder = async (req, res) => {
  const { id } = req.params;
  const { _id, role } = req.user;

  validateMongoDbId(id)

  const order = await Order.findById(id);

  if (!order) {
    throw new CustomError.NotFoundError(`No order found with id : ${id}`);
  }

  checkPermissions(order.user, _id, role)


  res.status(StatusCodes.OK).json({ order });
}

const getSubOrder = async (req, res) => {
  const { id } = req.params;
  const { _id, role } = req.user;
  validateMongoDbId(id)

  let order
  if (role === 'user') {
    const orders = await Order.findBy({ user: _id }).populate('subOrders');
    if (!orders) {
      throw new CustomError.NotFoundError(`No order found`);
    }
    let orderExists = false;

    await Promise.all(order.subOrders.Map(async (subOrder) => {
      if (subOrder._id === id) {
        orderExists = true
        order = subOrder;
      }
    }))

    if (!orderExists) {
      throw new CustomError.NotFoundError(`No order found with id : ${id}`);
    } 
  } else {
    order = await SubOrder.findById(id).populate('user', 'firstname lastname');
     if (!order) {
       throw new CustomError.NotFoundError(`No order found with id : ${id}`);
     } 
    checkPermissions(order.seller, req.user._id, req.user.role)

}



  res.status(StatusCodes.OK).json({ order });
}

const createOrder = async (req, res) => {
  const { _id } = req.user
  // 1) Extract data from body
  const { shippingAddress, phone } = req.body;
  const { address, city, country, postalCode } = shippingAddress;

  // 2) Check if user entered all fields
  if (
    !address ||
    !city ||
    !postalCode ||
    !country ||
    !phone
  ) {
    throw new CustomError.BadRequestError('please provide all required fields to create order');
  }

  // 3) Get user cart
  const cart = await Cart.findOne({ user: _id }).populate('items.product');
  // 4) Check if cart doesn't exist
  if (!cart || cart.items.length === 0) {
    throw new CustomError.NotFoundError('User Cart is empty')
  }
  // 5) Create Order and save to database
  const order = await Order.create({
    user: _id,
    shippingAddress,
    phone,
    cartItems: cart.items,
    totalPrice: cart.totalPrice,
  })

  // 6) Create  SubOrder for each seller and save to database
  const itemsBySeller = groupItemsBySeller(cart.items)
  console.log('#####################"')
  // console.log(itemsBySeller)
  // console.log(Array.from(itemsBySeller.entries()))
  await Promise.all(Array.from(itemsBySeller.entries()).map(async ([seller, sellerItems]) => {
    // console.log(sellerItems, seller)
    const totalAmount = sellerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    // console.log(totalAmount)
    const subOrder = await SubOrder.create({
      user: _id,
      seller: seller,
      order: order._id,
      items: sellerItems,
      totalAmount
    })
    order.subOrders.push(subOrder)

  }))
  await order.save()



  // 7) make payment
  const metadata = {
    // products:cart.items,
    userId: _id.toString(),
    orderId: order._id.toString(),
    cartId: cart._id.toString()
  }
  console.log(order._id.toString(), order.cartItems)
  const products = cart.items.map(item => ({
    name: item.product.name,
    image: item.product.mainImage.public_id,
    price: item.price,
    quantity: item.quantity
  }))
  const session = await checkout(products, metadata)

  res.status(StatusCodes.CREATED).json({ msg: "order created successfully", session_id: session.id, session_url: session.url })

}

const updateSubOrderStatus = async (req, res) => {
  const { id } = req.params
  const {status} = req.body
  // 1) Validate id
  validateMongoDbId(id)
  const { _id, role } = req.user
  // 2) Find suborder documents 
  const subOrder = await SubOrder.findById(id)
  
  // 3) Check if suborder doesn't exist
  if (!subOrder) {
    throw new CustomError.NotFoundError(`No order found with id : ${id}`);
  }

  // 4) check Permissions
  checkPermissions(subOrder.seller, _id, role)

  // 5) check if status and suborder status are in this list [Proceesing,Shipped,Delivered] 
  const statusList = ['processing', 'shipped', 'delivered']
  if (!statusList.includes(status.toLowerCase()) || !statusList.includes(subOrder.status.toLowerCase())) {
    throw new CustomError.BadRequestError('Status and prev order status should be Proceesing or Shipped or Delivered')
  }
  
  // 5) update status
  subOrder.status = capitalize(status)
  await subOrder.save()
  res.status(StatusCodes.OK).json({
    msg: "status updated successfully",
    subOrder
  })


}

const cancelOrder = async (req, res) => {
  const id = req.params.id
  // 1) Find order document 
  const order = await Order.findById(id).populate('transactionId').populate('subOrders');
  console.log(order)
  // 2) Check if order doesn't exist
  if (!order) {
    throw new CustomError.NotFoundError(`No order found with id : ${id}`);
  }
  // 3) check Permissions
  checkPermissions(order.user, req.user._id, req.user.role)
  // console.log(typeof order.status,order.status,!order.status === "Processing" , isPastTenDays(order.paidAt),!order.status === "Processing" || isPastTenDays(order.paidAt))

  // // 4) Check  subOrder status
  // order.subOrders.map(async ({ _id }) => { 
  //   const subOrder = await SubOrder.findById(_id)

  //   if (!subOrder.status === "Processing") {
  //     throw new CustomError.NotFoundError(`Order can't be canceled`);
  //   }
  // })

  // 4) Check  order date if past 10 days and suborders status
  const isAllProcessed = order.subOrders.every(subOrder => subOrder.status.toLowerCase() === 'processing');
  if (isPastTenDays(order.paidAt) || !isAllProcessed) {
    throw new CustomError.NotFoundError(`Order can't be canceled`);
  }
  // 5) cancel each subOrder
  let refundAmount = 0
  await Promise.all(order.subOrders.map(async ({ _id }) => {

    const subOrder = await SubOrder.findById(_id)
    console.log(subOrder.status)
    if (subOrder.status.toLowerCase() === "processing") {


      // 1) refund money
      const refund = await stripe.refunds.create({
        payment_intent: order.transactionId.paymentIntentId,
        amount: subOrder.totalAmount,
      })
      console.log(refund)
      if (refund.status === 'succeeded') {
        // update refund Amount value
        refundAmount += refund.amount
        console.log(refundAmount, refund.amount)
        // 2) update subOrder status
        subOrder.status = "Cancelled"
        subOrder.save()
        // // 4) Increase seller balance
        //  const balance = subOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
        //         const seller = await User.findById(subOrder.seller)

        //         seller.balance -= balance
        //         await seller.save()
        // 4) Increase product quantity and reduce product sold
        for (const item of subOrder.items) {
          const id = item.product;
          const { quantity: productQuantity } = item;
          const product = await Product.findById(id);
          console.log('', product, productQuantity)
          const sold = product.sold - productQuantity;
          const quantity = product.quantity + productQuantity;
          await Product.findByIdAndUpdate(id, { sold, quantity }, {
            new: true,
            runValidators: true,
          });
        }
      } else {
        throw new BadRequestError('Cancel Order Failed');
      }
    }
  }))
  console.log(order.totalPrice, refundAmount)
  // 5) update transaction
  if (!refundAmount == 0) {
    console.log('t')
    const transaction = await Transaction.findByIdAndUpdate(order.transactionId._id, {
      isRefunded: true,
      amountRefunded: refundAmount,
      refundedAt: Date.now()
    }, { new: true })
    console.log(transaction)
  }
  //  6) check if all subOrders are canceled
  if (order.totalPrice == refundAmount) {
    order.isCanceled = true;
    order.canceledAt = Date.now();
  }

  // // 5) refund money
  // if (order.isPaid) {
  //   const refund = await stripe.refunds.create({
  //     payment_intent: order.transactionId.paymentIntentId
  //   })
  //   console.log(refund)
  //   if (refund.status === 'succeeded') {
  //     // 1) update transaction
  //     const transaction = Transaction.findByIdAndUpdate(order.transactionId._id, {
  //       isRefunded: true,
  //       amountRefunded: refund.amount,
  //       refundedAt: Date.now()
  //     },{new:true})
  //     console.log(transaction)
  //     // 2) update order status
  //     order.status = "Cancelled"
  //     order.isCanceled = true;
  //     order.canceledAt = Date.now();
  //     order.save()
  //     // 3) Increase product quantity and reduce product sold
  //     for (const item of order.cartItems) {
  //       const id = item.product;
  //       const { quantity: productQuantity } = item;
  //       const product = await Product.findById(id);
  //       console.log('', product, productQuantity)
  //       const sold = product.sold - productQuantity;
  //       const quantity = product.quantity + productQuantity;
  //       await Product.findByIdAndUpdate(id, { sold, quantity }, {
  //         new: true,
  //         runValidators: true,
  //       });
  //     }
  //   } else {
  //     throw new BadRequestError('Cancel Order Failed');
  //   }
  // } else {

  //   // 1) update order status
  //   order.status === "Cancelled"
  //   order.isCanceled = true;
  //   order.canceledAt = Date.now();
  //   order.save()
  //   // 2) Increase product quantity and reduce product sold
  //   for (const item of order.cartItems) {
  //     const id = item.product;
  //     const { quantity: productQuantity } = item;
  //     const product = await Product.findById(id);
  //     console.log('', product, productQuantity)
  //     const sold = product.sold - productQuantity;
  //     const quantity = product.quantity + productQuantity;
  //     await Product.findByIdAndUpdate(id, { sold, quantity }, {
  //       new: true,
  //       runValidators: true,
  //     });
  //   }
  // }  


  res.status(StatusCodes.OK).json({ msg: 'order canceled successfully' });

}
const cancelSubOrder = async (req, res) => {
  const id = req.params.id
  // 1) Find order document 
  const subOrder = await SubOrder.findById(id)
  const order = await Order.findById(subOrder.order).populate('subOrders').populate('transactionId')
  console.log(subOrder)
  // 2) Check if order or subOrder doesn't exist
  if (!subOrder || !order) {
    throw new CustomError.NotFoundError(`No order found with id : ${id}`);
  }
  // 3) check Permissions
  checkPermissions(subOrder.user, req.user._id, req.user.role)
  // console.log(typeof order.status,order.status,!order.status === "Processing" , isPastTenDays(order.paidAt),!order.status === "Processing" || isPastTenDays(order.paidAt))

  // // 4) Check  subOrder status
  // order.subOrders.map(async ({ _id }) => { 
  //   const subOrder = await SubOrder.findById(_id)

  //   if (!subOrder.status === "Processing") {
  //     throw new CustomError.NotFoundError(`Order can't be canceled`);
  //   }
  // })

  // 4) Check  order date if past 10 days
  if (isPastTenDays(order.paidAt)) {
    throw new CustomError.BadRequestError(`Order can't be canceled after 10 days`);
  }
  // 5) cancel  subOrder
    if (subOrder.status.toLowerCase() === "processing") {


      // 1) refund money
      const refund = await stripe.refunds.create({
        payment_intent: order.transactionId.paymentIntentId,
        amount: subOrder.totalAmount,
      })
      console.log(refund)
      if (refund.status === 'succeeded') {
        // ) update subOrder status
        subOrder.status = "Cancelled"
        subOrder.save()
        // // ) Increase seller balance
        // const balance = subOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
        // const seller = await User.findById(subOrder.seller)

        // seller.balance -= balance
        // await seller.save()
        // ) Increase product quantity and reduce product sold
        for (const item of subOrder.items) {
          const id = item.product;
          const { quantity: productQuantity } = item;
          const product = await Product.findById(id);
          console.log('', product, productQuantity)
          const sold = product.sold - productQuantity;
          const quantity = product.quantity + productQuantity;
          await Product.findByIdAndUpdate(id, { sold, quantity }, {
            new: true,
            runValidators: true,
          });
        }
        // ) update transaction

          const transaction = await Transaction.findByIdAndUpdate(order.transactionId._id, {
            isRefunded: true,
            amountRefunded: refund.amount,
            refundedAt: Date.now()
          }, { new: true })
          console.log(transaction)
      } else {
        throw new BadRequestError('Cancel Order Failed');
      }
    } else {
      throw new CustomError.BadRequestError(`Order can't be canceled`);

    }

 
  //  7) check if all subOrders are canceled
  const newOrder = await Order.findById(subOrder.order).populate('subOrders').populate('transactionId')
  const isAllCanceled = newOrder.subOrders.every(subOrder => subOrder.status.toLowerCase() === 'cancelled');
  console.log(isAllCanceled)
  if (isAllCanceled) {
    newOrder.isCanceled = true;
    newOrder.canceledAt = Date.now();
    await newOrder.save();
  }



  res.status(StatusCodes.OK).json({ msg: 'order canceled successfully' });

}
module.exports = {
  getAllOrders,
  getMyOrders,
  getUserOrders,
  getOrder,
  getSubOrder,
  createOrder,
  updateSubOrderStatus,
  cancelOrder,
  cancelSubOrder
};