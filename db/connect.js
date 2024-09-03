const mongoose = require('mongoose');
const {logger }= require('../utils');


const connectDatabase = async (url) => {
    mongoose.set("strictQuery", false);

    
    // mongoose.set('autoIndex', true);

    const con = await mongoose.connect(url, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        // autoIndex: true
    });

    logger.info(`MongoDB Connected: ${con.connection.host}.`);

    mongoose.connection.on('connecting', () => {
        logger.info('Connecting to Database');
    });

    mongoose.connection.on('connected', () => {
        logger.info('Mongoose Connected to Database');
    });

    mongoose.connection.on('error', (err) => {
        logger.error(err.message);
    });

    mongoose.connection.on('disconnected', () => {
        logger.info('Mongoose Connection is Disconnected.');
    });

    process.on('SIGINT', async () => {
        await mongoose.connection.close();
        process.exit(0);
    });
}

module.exports = connectDatabase;