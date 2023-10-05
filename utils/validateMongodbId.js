const mongoose = require("mongoose");
const  CustomError  = require("../errors");
const validateMongoDbId = (id) => {
  const isValid = mongoose.Types.ObjectId.isValid(id);
  if (!isValid) throw new CustomError.BadRequestError("This id is not valid or not Found");
};
module.exports = validateMongoDbId;
