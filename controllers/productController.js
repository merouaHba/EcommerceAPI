var slugify = require('slugify')
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const User = require('../models/userModel');
const { StatusCodes } = require('http-status-codes');


const { uploadFile, destroyFile } = require('../utils/cloudinary')
const CustomError = require('../errors');
const { checkPermissions, apiFeatures } = require('../utils');
const validateMongoDbId = require('../utils/validateMongodbId');


const createProduct = async (req, res) => {
    const { name, price, description, category } = req.body;
    if (!name || !price || !description || !category) {
        throw new CustomError.BadRequestError('please provide all required fields to create product');
    }
    // if (req.user.role === 'admin' && !req.body.seller) {
    //     throw new CustomError.BadRequestError('please provide all required fields to create product');
    // }
    validateMongoDbId(category)

    const files = req.files;
    const slug = slugify(req.body.name)
    const seller = req.user._id
console.log('hi p')
    let mainImage = {
        public_id: '',
        url: '',
    }
    let images = []
    // console.log('file.fieldName')
    if (!files || files.length < 2) {
        throw new CustomError.BadRequestError('please upload images')
    }
    const fieldnames = []
    files.map(file => {
        fieldnames.push(file.fieldname)
    })
    console.log(fieldnames)
    console.log(!fieldnames.includes("mainImage"))

    if (!fieldnames.includes("mainImage")) {
        throw new CustomError.BadRequestError('please upload main image')
    }


    await Promise.all(files.map(async (file) => {

        try {
            const result = await uploadFile(file.path, `products`);

            if (file.fieldname === 'mainImage') {
                console.log('mainImage')
                mainImage.public_id = result.public_id
                mainImage.url = result.secure_url

                console.log(mainImage)
            }
            images.push({
                public_id: result.public_id,
                url: result.secure_url
            })
            console.log(mainImage)
            console.log("###################")
            console.log(images)


        } catch (err) {
            // 👇️ catch block ran:  An error occurred
            throw new CustomError.BadRequestError("failled to upload images")
        }


    }))

    const product = await Product.create({ ...req.body, seller, slug, mainImage, images });
    // console.log(req.files)
    res.status(StatusCodes.CREATED).json({ product });

};
const getAllProducts = async (req, res) => {
    
  
    const result = await apiFeatures(req, Product);

    res.status(StatusCodes.OK).json({ ...result });
};
const getSellerProducts = async (req, res) => {
    const seller = req.user?.role === 'seller' ? req.user._id : req.params.id;
    console.log('seller', seller)
    const sellerExists = await User.findById(seller)
    if (!sellerExists) {
        throw new CustomError.BadRequestError('Seller doesn\'t exist')
    }
    const products = await Product.find({ seller });

    res.status(StatusCodes.OK).json({ products, count: products.length });
};
const getSingleProduct = async (req, res) => {
    const { id } = req.params;
validateMongoDbId(id)
    const product = await Product.findById(id);

    if (!product) {
        throw new CustomError.NotFoundError(`No product found with id : ${id}`);
    }

    res.status(StatusCodes.OK).json({ product });
};
const updateProduct = async (req, res) => {
    const { id: productId } = req.params;
    const { name } = req.body;

    if (name) {
        const slug = slugify(name)
        req.body.slug = slug;
    }
    validateMongoDbId(productId)

    const productExists = await Product.findById(productId);

    if (!productExists) {
        throw new CustomError.NotFoundError(`No product with id : ${productId}`);
    }
    const idSeller = req.user._id;

    checkPermissions(productExists.seller, idSeller, 'seller')

    const product = await Product.findOneAndUpdate({ _id: productId }, req.body, {
        new: true,
        runValidators: true,
    });

    res.status(StatusCodes.OK).json({ msg: "Success! product updated", product });
};
const deleteProduct = async (req, res) => {
    const { id: productId } = req.params;


    validateMongoDbId(productId)

    const productExists = await Product.findById(productId);

    if (!productExists) {
        throw new CustomError.NotFoundError(`No product with id : ${productId}`);
    }
    const idSeller = req.user._id;

    checkPermissions(productExists.seller, idSeller, 'seller')
    const product = await Product.findOneAndDelete({ _id: productId });

    if (!product) {
        throw new CustomError.NotFoundError(`No product with id : ${productId}`);
    }

    await destroyFile(product.mainImage.public_id)

    product.images.map(async (image) => await destroyFile(image.url))


    res.status(StatusCodes.OK).json({ msg: 'Success! Product removed.' });
};
const updateProductMainImage = async (req, res) => {
    const { id: productId } = req.params;

    validateMongoDbId(productId)

    const productExists = await Product.findById(productId);

    if (!productExists) {
        throw new CustomError.NotFoundError(`No product with id : ${productId}`);
    }
    const idSeller = req.user._id;

    checkPermissions(productExists.seller, idSeller, 'seller')
    const product = await Product.findOne({ _id: productId });
    console.log(!req.file)
    if (!req.file) {
        throw new CustomError.NotFoundError("No file found, please upload file")
    }
    const result = await uploadFile(req.file.path, `products`);
    await destroyFile(product.mainImage.public_id)

    if (product.mainImage.url) {
        await destroyFile(product.mainImage.url)
    }
    product.mainImage = {
        public_id: result.public_id,
        url: result.secure_url
    }
    product.save();

    res.status(StatusCodes.OK).json({ msg: "Main image updated" })
};
const updateProductImages = async (req, res) => {
    const { id: productId } = req.params;

    validateMongoDbId(productId)

    const productExists = await Product.findById(productId);

    if (!productExists) {
        throw new CustomError.NotFoundError(`No product with id : ${productId}`);
    }
    const idSeller = req.user._id;

    checkPermissions(productExists.seller, idSeller, 'seller')

    const product = await Product.findOne({ _id: productId });

    if (!req.files || req.files.length < 2) {
        throw new CustomError.BadRequestError("No file found, please upload file")
    }
   
    await Promise.all(product.images.map(async (image) => {

        try {
            await destroyFile(image.public_id)


        } catch (err) {
            // 👇️ catch block ran:  An error occurred
            throw new CustomError.BadRequestError(err._message)
        }


    }))

    let images = []

    await Promise.all(req.files.map(async (file) => {

        try {
            const result = await uploadFile(file.path, `products`);

            images.push({
                public_id: result.public_id,
                url: result.secure_url
            })
            console.log(images)


        } catch (err) {
            // 👇️ catch block ran:  An error occurred
            throw new CustomError.BadRequestError(err._message)
        }


    }))


    product.images = []
    product.images = images

    product.save();

    res.status(StatusCodes.OK).json({ msg: "images updated" ,product})
};
const getTopSheapeastProducts = async (req, res) => {

}

module.exports = {
    createProduct,
    getAllProducts,
    getSellerProducts,
    getSingleProduct,
    updateProduct,
    deleteProduct,
    updateProductMainImage,
    updateProductImages,
    getTopSheapeastProducts
};