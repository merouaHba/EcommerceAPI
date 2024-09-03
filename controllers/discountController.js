const Discount = require('../models/discountModel');
const { StatusCodes } = require('http-status-codes');
const {
    checkPermissions
} = require('../utils');

// const crypto = require('crypto');
const coupongenerator = require('../utils/generateCoupon')
const CustomError = require('../errors');

const getAllDiscounts = async (req, res) => {
    const discounts = await Discount.find({});
    if (discounts.length === 0) {
        throw new CustomError.NotFoundError('No Discount found')
    }
    res.status(StatusCodes.OK).json({discounts})
}
const generateDiscount = async (req, res) => {
const {code,discount,expire} = req.body
 let couponCode = coupongenerator(code)
    //  Create new discount document
    const discountCode = await Discount.create({
        code: couponCode,
        discount,
        expire
    });
    res.status(StatusCodes.CREATED).json({ msg: "discount created successfully" ,discountCode})

 
}

const updateDiscount = async (req, res) => {
const {code,discount,expire} = req.body
    //  Create new discount document
    const discountCode = await Discount.findOneAndUpdate({ code }, { discount, expire }, {
        new: true,
        runValidators: true,
    });
    if (!discountCode) {
        throw new CustomError.NotFoundError('Discount not found')
    }
    res.status(StatusCodes.OK).json({ msg: "discount updated successfully" ,discountCode})

 
}

const deleteDiscount = async (req, res) => {
    const { code } = req.body
    const discount = await Discount.findOneAndDelete({ code })
    if (!discount) {
        throw new CustomError.NotFoundError('Discount not found')
    }
    res.status(StatusCodes.OK).json({msg:"discount deleted successfully" })
}
const getDiscount = async (req, res) => {
    const { code } = req.body

    const discount = await Discount.findOne({ code })

    if (!discount) {
        throw new CustomError.NotFoundError('Discount not found')
    }
    res.status(StatusCodes.OK).json({ discount })
}
const verifyDiscount = async (req, res) => {
    const { code } = req.body
    const discount = await Discount.findOne({ code })

    if (!discount) {
        throw new CustomError.NotFoundError('code discount not valid')
    }
    const date = new Date()
    if (date > discount.expire) {
        throw new CustomError.NotFoundError('code discount not valid')
    }
    res.status(StatusCodes.OK).json({ msg:"code discount valid" ,discount: discount.discount })
}






module.exports = {
    getAllDiscounts,
    generateDiscount,
    deleteDiscount,
    getDiscount,
    verifyDiscount,
    updateDiscount
}