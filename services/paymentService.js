const { BadRequestError } = require('../errors')

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const checkout = async (products, metadata) => {
    const line_items = products.map((product) => ({
        price_data: {
            currency: 'usd',
            unit_amount: Math.round(product.price * 100),
            product_data: {
                name: product.name,
                images:[product.image]
            },
        },
        quantity: product.quantity,
    }))
    console.log(line_items)
    console.log(JSON.stringify(line_items))
    const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}cancel`,
        line_items: line_items,
        payment_intent_data: {
            metadata,
        },
        metadata,

    })
    console.log(session)
    return session
   
}



const checkAccountCapabilities = async (accountId) => {
   try {
       const account = await stripe.accounts.retrieve(accountId);
       // check if the transfer capability is enabled
       console.log(account)
       if (account.capabilities.transfers == 'active') {
           return true
       } else {
           return false
       }
   } catch (error) {
    throw new BadRequestError(`Stripe ERROR: ${error}`)
   }
}
module.exports = {
    checkout,
    checkAccountCapabilities
}