const { CustomAPIError } = require('../errors')
const { StatusCodes } = require('http-status-codes')
const errorHandlerMiddleware = (err, req, res, next) => {
  console.log(err)

  if (err instanceof CustomAPIError) {
    return res.status(err.statusCode).json({ msg: err.message })
  }

  // Duplicate key error
  if (err.code === 11000) {
    const message = `Duplicate key ${Object.keys(err.keyValue)} Entered`;
    return res.status(StatusCodes.BAD_REQUEST).json({ msg: message })
  } 

  // Validation  error
  if (err.name === "ValidationError") {
    const message = `${Object.values(err.errors).map((item) => item.message).join(', ')}`;
    return res.status(StatusCodes.BAD_REQUEST).json({ msg: message })
  }

  // Cast  error
  if (err.name === "CastError") {
    const message = `Invalid ${err.path} : ${err.value}`;
    return res.status(StatusCodes.BAD_REQUEST).json({ msg: message })
  }

  // wrong jwt error
  if (err.name === "JsonWebTokenError") {
    const message = `Your url is invalid please try again letter`;
    return res.status(StatusCodes.BAD_REQUEST).json({ msg: message })

  }

  // jwt expired
  if (err.name === "TokenExpiredError") {
    const message = `Your Url is expired please try again letter!`;
    return res.status(StatusCodes.BAD_REQUEST).json({ msg: message })
  }


  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ msg:err.message })
}

module.exports = errorHandlerMiddleware
