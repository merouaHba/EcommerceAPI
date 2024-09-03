const morgan = require('morgan');

const {logger} = require('../utils');

morgan.token('message', (req, res) => res.locals.errorMessage || '');

const getIpFormat = () =>
  process.env.NODE_ENV === 'production' ? ':remote-addr - ' : '';
const successResponseFormat = `${getIpFormat()}:method :url :status - :response-time ms`;
const errorResponseFormat = `${getIpFormat()}:method :url :status - :response-time ms - message: :message`;

const successHandle = morgan(successResponseFormat, {
  skip: (req, res) => res.statusCode >= 400,
  stream: { write: (message) => logger.info(message.trim()) }
});

 const errorHandle = morgan(errorResponseFormat, {
  skip: (req, res) => res.statusCode < 400,
  stream: { write: (message) => logger.error(message.trim()) }
});
module.exports = {
  successHandle,
  errorHandle
}