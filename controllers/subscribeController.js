const { BadRequestError } = require("../errors");
const  addSubscriber  = require("../utils/mailChimp");
const { StatusCodes } = require('http-status-codes');

const subscribeToNewsLetter = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        throw new BadRequestError('Please Provide a valid email address')
    }
    try {

        await addSubscriber(email)
        res.status(StatusCodes.CREATED).json({ message: 'Subscriber added successfully' })
    } catch (err) {
        if (err.response) {
            throw new BadRequestError(err.response?.body?.title)
        }
        throw new BadRequestError("Failed to subscribe. Please try again later.")

    }
        
   

}

module.exports = subscribeToNewsLetter