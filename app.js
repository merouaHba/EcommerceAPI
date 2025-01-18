require('dotenv').config()
require('express-async-errors');

// extra security packages
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const xss = require('xss-clean');
const limiter = require('./middlewares/rateLimiter');
const mongoSanitize = require('express-mongo-sanitize');

// extra performance packages
const compression = require('compression');

// logger
const { successHandle, errorHandle } = require('./middlewares/morgan');

// Swagger
const swaggerUI = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load('./swagger.yaml');

const express = require('express')
const app = express();



// Set trust proxy to true
app.enable('trust proxy');
// // Morgan logging Handler
app.use(successHandle);
app.use(errorHandle);


// routers
const authRouter = require('./routes/authRoute');
const userRouter = require('./routes/userRoute');
const productRouter = require('./routes/productRoute');
const categoryRouter = require('./routes/categoryRoute');
const cartRouter = require('./routes/cartRoute');
const favouriteRouter = require('./routes/favouriteRoute');
const reviewRouter = require('./routes/reviewRoute');
const discountRouter = require('./routes/discountRoute');
const orderRouter = require('./routes/orderRoute');
const paymentRouter = require('./routes/paymentRoute');
const newsLettersubscriptionRouter = require('./routes/subscribeRoute');

// error handler
const notFoundMiddleware = require('./middlewares/not-found');
const errorHandlerMiddleware = require('./middlewares/error-handler');
const { webhook } = require('./controllers/paymentController');


// Set Body parser, reading data from body into req.body
app.use((req, res, next) => {
    if (req.originalUrl === '/webhook') {
        next(); // Do nothing with the body because I need it in a raw state.
    } else {
        express.json({ limit: '10mb' })(req, res, next);  // ONLY do express.json() if the received request is NOT a WebHook from Stripe.
    }
});
app.use((req, res, next) => {

    if (req.originalUrl === '/webhook') {
        next(); // Do nothing with the body because I need it in a raw state.
    } else {
        express.urlencoded({ extended: true, limit: '10mb' })(req, res, next);  // ONLY do express.json() if the received request is NOT a WebHook from Stripe.
    }

});




// passport config
require('./config/passport');

// Set security HTTP headers
app.use(helmet());
    
// Implement CORS
app.use(cors({
    origin: process.env.FRONTEND_URL, 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true, // Allow cookies
    allowedHeaders:  [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'withcredentials'
    ],
    exposedHeaders: [
        'set-cookie',
        "Authorization"
    ]
    
}));
// Data sanitization against XSS
app.use(xss());

// MongoDB data sanitization
app.use(mongoSanitize())

app.use(cookieParser(process.env.REFRESH_TOKEN_SECRET));


// disable attackers to know the server stack (express - php ...ect)
app.disable('x-powered-by');

// response data compression
app.use(compression())


// Limit Repeated Failed Requests to Auth Endpoints
if (process.env.NODE_ENV === 'production') {
    app.use('/api/v1', limiter);
}


app.get('/', (req, res) => {
    res.send('<h1>Jobs API</h1><a href="/api-docs">Documentation</a>');
});
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerDocument));



// routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users',  userRouter);
app.use('/api/v1/products',  productRouter);
app.use('/api/v1/categories',  categoryRouter);
app.use('/api/v1/cart',  cartRouter);
app.use('/api/v1/favourite',  favouriteRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/discounts', discountRouter);
app.use('/api/v1/orders', orderRouter);
app.use('/api/v1/payment', paymentRouter);
app.use('/api/v1/news_letter', newsLettersubscriptionRouter);
// listen to stripe events
app.post('/webhook', express.raw({ type: "*/*" } ),webhook);


app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

// Scheduled transfer Amount to run every day at midnight
require('./services/sheduledTransferAmount')



module.exports = {app}
