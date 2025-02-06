const {Discount} = require('../models/discountModel');
const generateUniqueCode = async (prefix = '') => {
    const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
    const code = `${prefix}${randomString}`;

    const existingDiscount = await Discount.findOne({ code });
    if (existingDiscount) {
        return generateUniqueCode(prefix);
    }

    return code;
};

module.exports = { generateUniqueCode };