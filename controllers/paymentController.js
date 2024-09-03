const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { StatusCodes } = require('http-status-codes');
const { BadRequestError, CustomAPIError } = require('../errors');
const { Order, SubOrder } = require('../models/orderModel');
const Transaction = require('../models/transactionModel');
const Product = require('../models/productModel');
const Cart = require('../models/cartModel');
const User = require('../models/userModel');
const validateMongoDbId = require('../utils/validateMongodbId');
const { checkAccountCapabilities } = require('../services/paymentService');

const endpointSecret = process.env.WEBHOOK_SECRET_ID;

const webhook = async (req, res) => {
    console.log('object')
    const sig = req.headers['stripe-signature'];
    if (sig == null) { throw new BadRequestError('No stripe signature found!'); }

    let event;
    console.log(event)
    try {
        event = await stripe.webhooks.constructEvent(req.body, sig?.toString(), endpointSecret);
        // Handle the event
        if (event.type === 'checkout.session.completed') {
            const paymentIntent = event.data.object;
            console.log('PaymentIntent was successful!');
            console.log(paymentIntent);
            const orderId = paymentIntent.metadata?.orderId;
            const userId = paymentIntent.metadata?.userId;
            console.log(orderId);
            console.log(userId);
            // Retrieve the Checkout Session from the API with line_items expanded

            validateMongoDbId(orderId);
            validateMongoDbId(userId);
            // 1. Save transaction details to Transaction model
            const transaction = new Transaction({
                sender: userId,
                receiver: process.env.ADMIN_ID,
                paymentIntentId: paymentIntent.payment_intent,
                amount: paymentIntent.amount_total,
                currency: paymentIntent.currency,
            });

            await transaction.save();
            //    console.log('orderId', orderId)

            // 2. Update the order's payment status and details
            const order = await Order.findByIdAndUpdate(orderId, {
                transactionId: transaction._id,
                isPaid: true,
                paidAt: Date.now(),
            }, {
                new: true,
                runValidators: true,
            });
            //    console.log(order.cartItems)
            // 3. Update the subOrder's payment status and details

            await Promise.all(order.subOrders.map(async ({ _id }) => {
                // 1) Update  subOrder status
                const subOrder = await SubOrder.findByIdAndUpdate(_id, {
                    status: 'Processing',
                }, { new: true })
                // console.log('debug############################')

                // const balance = subOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
                // const seller = await User.findById(subOrder.seller)

                // seller.balance += balance
                // await seller.save()


            }))
            // 4. Update product sold and quantity fields
            for (const item of order.cartItems) {
                const id = item.product;
                const { quantity: productQuantity } = item;
                const product = await Product.findById(id);
                console.log('', product, productQuantity)
                const sold = product.sold + productQuantity;
                const quantity = product.quantity - productQuantity;
                await Product.findByIdAndUpdate(id, { sold, quantity }, {
                    new: true,
                    runValidators: true,
                });
            }

            // 5) Delete cart
            await Cart.findByIdAndUpdate(paymentIntent.metadata.cartId, { items: [], totalPrice: 0.0, totalQuantity: 0 }, {
                new: true,
                runValidators: true,
            });
        }

        // Return a res to acknowledge receipt of the event
        res.status(200).end();
    }
    catch (err) {
        throw new BadRequestError(`Webhook Error: ${err.message}`);
    }


}

const createStripeAccount = async (req, res) => {
    const { email } = req.body;
    
    try {
       const account = await stripe.accounts.create({
            type: 'express',
            // country: 'US',
            email: email,
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true}
            },
       });
        const user = await  User.findByIdAndUpdate(req.user._id, {
            stripeAccountId: account.id,
        },{new:true})
        res.status(StatusCodes.CREATED).json({
            msg: 'Success! Stripe account created',
            acount_id: account.id
        });
    } catch (error) {
        console.log(error)
        throw new BadRequestError(`error on creating stripe account`)
    }
}
const generateAccountLink = async (req, res) => {
    const user = await User.findById(req.user._id)

    try {
        const accountLink = await stripe.accountLinks.create({
            account: user.stripeAccountId,
            refresh_url: `${process.env.FRONTEND_URL}/`,
            return_url: `${process.env.FRONTEND_URL}/setup`,
            type: 'account_onboarding',
        });
        res.status(StatusCodes.CREATED).json({
            link: accountLink.url
        });
    } catch (error) {
        console.log(error)
        throw new BadRequestError(`error on geting  stripe account link`)
    }
}
const withDrawBalance = async (req, res) => { 
   
        
            // Get seller ID from authenticated user (ensure authentication middleware is implemented)
            const seller = await User.findById(req.user._id);

            if (!seller.stripeAccountId) {
                throw new BadRequestError( 'No Stripe account found for this seller.');
            }
let balance
           try {
               // Retrieve the balance available for payout
               balance = await stripe.balance.retrieve({
                   stripeAccount: seller.stripeAccountId,
               });
           } catch (error) {
               console.error(error);
               throw new BadRequestError('Failed to create payout');
           }

            const availableBalance = balance.available[0].amount; // in cents

            if (availableBalance <= 0) {
                throw new BadRequestError('No funds available for payout.' );
            }
    try {
            // Create a payout to the seller's connected account
            const payout = await stripe.payouts.create({
                amount: availableBalance,
                currency: 'usd', // adjust currency as needed
            }, {
                stripeAccount: seller.stripeAccountId,
            });

            res.status(200).json({ message: 'Payout created successfully', payout });

        } catch (error) {
            console.error(error);
            throw new BadRequestError('Failed to create payout');
        }
 

}

const checkAccountIsActive = async (req, res) => {
    const seller = await User.findById(req.user._id);

    const isActive = await checkAccountCapabilities(seller.stripeAccountId)
    res.status(StatusCodes.OK).json({
        isActive
    })
}

// const getExternalAccount = async (req, res) => {
//     const seller = await User.findById(req.user._id);
//     let externalAccountsList
//    try {
//         externalAccountsList = await stripe.accounts.listExternalAccounts(seller.stripeAccountId)
//    } catch (error) {
//        console.log(error)
//     throw new BadRequestError('failed to get external account')
//    }
//     res.status(StatusCodes.OK).json({
//         externalAccountsList
//     })
// }

module.exports = { webhook, createStripeAccount, generateAccountLink, withDrawBalance, checkAccountIsActive}