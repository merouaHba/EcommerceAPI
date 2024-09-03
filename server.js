const {app} = require('./app');
const {logger }= require('./utils');

// connect DB
const connectDatabase = require('./db/connect');
connectDatabase(process.env.MONGODB_URI);

const port = process.env.PORT || 3000;


const server = app.listen(port, () => {
    logger.info(`
      ################################################
      🚀 Server listening on port: ${port} 🚀
      ################################################
  `);
});

const exitHandler = () => {
    if (server) {
        server.close(() => {
            logger.info('Server closed');
            process.exit(1);
        });
    } else {
        process.exit(1);
    }
};

const unexpectedErrorHandler = (error) => {
    logger.error(error);
    exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
    logger.info('SIGTERM received');
    if (server) {
        server.close();
    }
});
