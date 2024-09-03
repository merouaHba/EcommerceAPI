const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY); // Ensure your Stripe secret key is stored securely
const User = require('../models/userModel'); // Import your Seller model
const { Order, SubOrder } = require('../models/orderModel');
const { sheduledFunction } = require('../utils');
const { checkAccountCapabilities } = require('./paymentService');


const transferAmount = async () => {

    const date = new Date();
    console.log("#####################Transfer Amount#################")
    console.log(date)
    // get the date tens day ago
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    // find paid orders older than ten days  and not cancelled
    const orders = await Order.find({
        isPaid: true,
        // paidAt: { $lte: tenDaysAgo },
        isCanceled: false
    }).populate('subOrders')
    console.log(orders)
    for (const order of orders) {
        // for each order, find the suborders that are not cancelled
        for (const subOrder of order.subOrders) {
            if (subOrder.status !== 'Cancelled') {
//  check if subOrder balance not transferd
                if (!subOrder.isBalanceTransfered) {

                    try {
                        console.log(subOrder.seller)
                        const seller = await User.findById(subOrder.seller)
                        console.log(seller)

                        if (seller.stripeAccountId) {
    
                            // check transfer capability 
                            const isTransferEnabled = await checkAccountCapabilities(seller.stripeAccountId)
                            // console.log(isTransferEnabled)
                            if (isTransferEnabled) {
    
                                // Create a transfer to the seller's Stripe account
                                const totalAmount = parseInt(subOrder.shippingPrice) + parseInt(subOrder.taxPrice)+parseInt(subOrder.totalAmount)
                                const transfer = await stripe.transfers.create({
                                    amount: totalAmount * 100,
                                    currency: 'usd', // Replace with your desired currency
                                    destination: seller.stripeAccountId, // Seller's Stripe connected account ID
                                });
    
                                // Log transfer information
                                console.log(`Transfer created for seller ${seller._id}: $${totalAmount}`);
    
                                // change suborder isBalanceTransfered to true after successful transfer
                                await SubOrder.findByIdAndUpdate(subOrder._id, {
                                    isBalanceTransfered:true
                                },{new:true})
                                // update seller  balance
                                // const seller = await User.findById(subOrder.seller._id);
                                seller.balance += totalAmount
                                await seller.save()
                            } else {
                                console.log(`Seller ${seller._id} does not enable transfer capablity.`);
                            }
    
                        } else {
                            console.log(`Seller ${seller._id} does not have a connected Stripe account.`);
                        }
                    
                    } catch (error) {
                        console.error('Error during scheduled transfer:', error);
                    }
                } else {
                    console.log(`Seller ${subOrder.seller} have get their balance for this subOrder  ${subOrder._id} .`);
                }

            }
        }




    }
}




sheduledFunction('0 0 * * *', transferAmount)