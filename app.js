require('dotenv').config()
require('express-async-errors');

// extra security packages
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const xss = require('xss-clean');
const rateLimiter = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

// Swagger
const swaggerUI = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load('./swagger.yaml');

const express = require('express')
const app = express();

// connect DB
const connectDatabase = require('./db/connect');
// const authenticateUser = require('./middlewares/authentication');

// routers
const authRouter = require('./routers/authRouter');
const userRouter = require('./routers/userRouter');
const productRouter = require('./routers/productRouter');
const categoryRouter = require('./routers/categoryRouter');
const cartRouter = require('./routers/cartRouter');
const favouriteRouter = require('./routers/favouriteRouter');
const reviewRouter = require('./routers/reviewRouter');
const discountRouter = require('./routers/discountRouter');
const orderRouter = require('./routers/orderRouter');

// error handler
const notFoundMiddleware = require('./middlewares/not-found');
const errorHandlerMiddleware = require('./middlewares/error-handler');


app.use(express.json());
app.use(helmet());
app.use(cors());
app.use(xss());
app.use(cookieParser(process.env.JWT_SECRET));
app.use(mongoSanitize())


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


app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);


const port = process.env.PORT || 3000;

const start = async () => {
    try {
        await  connectDatabase(process.env.MONGODB_URI);
        app.listen(port, () => {
            console.log(`server is listening on port ${port} ...`);
        })

 

    } catch (error) {
        console.log(error)
    }
}
start();

