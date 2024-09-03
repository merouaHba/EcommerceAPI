const apiFeatures = require('./apiFeatures');
const { createJWT, isTokenValid, attachCookiesToResponse } = require('./jwt');
const createTokenUser = require('./createTokenUser');
const sendVerificationEmail = require('./sendVerficationEmail');
const sendResetPasswordEmail = require('./sendResetPasswordEmail');
const checkPermissions = require('./checkPermissions');
const isPastTenDays = require('./isPAstTenDays');
const groupItemsBySeller = require('./groupItemsBySeller');
const capitalize = require('./capitalize');
const logger = require('./logger')
const sheduledFunction = require('./cronsheduledFunction')

module.exports = {
  apiFeatures,
  createJWT,
  isTokenValid,
  attachCookiesToResponse,
  createTokenUser,
  sendVerificationEmail,
  sendResetPasswordEmail,
  checkPermissions,
  isPastTenDays,
  groupItemsBySeller,
  capitalize,
  logger,
  sheduledFunction,
};