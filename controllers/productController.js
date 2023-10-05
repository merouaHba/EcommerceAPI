var slugify = require('slugify')
const Product = require('../models/productModel');
const { StatusCodes } = require('http-status-codes');


const { uploadFile, destroyFile } = require('../utils/cloudinary')
const CustomError = require('../errors');
const { checkPermissions } = require('../utils');
const validateMongoDbId = require('../utils/validateMongodbId');


const createProduct = async (req, res) => {
    const files = req.files;
    const slug = slugify(req.body.name)
    let mainImage = {
        public_id: '',
        url: '',
    }
    let images = []
    // console.log('file.fieldName')
    if (files.length < 2) {
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


 await Promise.all(   files.map(async (file) => {

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
            throw new CustomError.BadRequestError(err._message)
        }


    }))

    const product = await Product.create({ ...req.body, slug,mainImage, images });
    // console.log(req.files)
    res.status(StatusCodes.CREATED).json({ product });

};
const getAllProducts = async (req, res) => {
    const products = await Product.find({});

    res.status(StatusCodes.OK).json({ products, count: products.length });
};
const getSingleProduct = async (req, res) => {
    const { id: slug } = req.params;

    const product = await Product.findOne({ slug: slug });

    if (!product) {
        throw new CustomError.NotFoundError(`No product found with id : ${slug}`);
    }

    res.status(StatusCodes.OK).json({ product });
};
const updateProduct = async (req, res) => {
    const { id: productId } = req.params;


    const { idSeller } = req.body;
    checkPermissions(id, idSeller, 'seller')


    validateMongoDbId(productId)
    const product = await Product.findOneAndUpdate({ _id: productId }, req.body, {
        new: true,
        runValidators: true,
    });

    if (!product) {
        throw new CustomError.NotFoundError(`No product with id : ${productId}`);
    }

    res.status(StatusCodes.OK).json({ msg: "Success! product updated", product });
};
const deleteProduct = async (req, res) => {
    const { id: productId } = req.params;


    const { idSeller } = req.body;
    checkPermissions(id, idSeller, 'seller')

    validateMongoDbId(productId)
    const product = await Product.findOneAndDelete({ _id: productId });

    if (!product) {
        throw new CustomError.NotFoundError(`No product with id : ${productId}`);
    }

    await destroyFile(product.mainImage.public_id)

    product.images.map(async (image) => await destroyFile(image.url))


    res.status(StatusCodes.OK).json({ msg: 'Success! Product removed.' });
};
const updateProductMainImage = async (req, res) => {
    const { id } = req.params;

    const { idSeller } = req.body;
    checkPermissions(id, idSeller, 'seller')

    validateMongoDbId(id)
    const product = await Product.findOne({ _id: id });
    console.log(!req.file)
    if (!req.file) {
        throw new CustomError.NotFoundError("No file found, please upload file")
    }
    const result = await uploadFile(req.file.path, `products`);

    if (product.mainImage.url) {
        await destroyFile(product.mainImage.url)
    }
    console.log("top")
    product.mainImage = {
        public_id: result.public_id,
        url: result.secure_url
    }
    product.save();

    res.status(StatusCodes.OK).json({ msg: "Main image updated" })
};
const updateProductImages = async (req, res) => {
    const { id } = req.params;


    const { idSeller } = req.body;
    checkPermissions(id, idSeller, 'seller')
    
    validateMongoDbId(id)
    const product = await Product.findOne({ _id: id });
    console.log(!req.files)
    if (req.files.length === 0) {
        throw new CustomError.NotFoundError("No file found, please upload file")
    }
    const files = req.files;
    files.map(async (file) => {
        const result = await uploadFile(file.path, `products/${id}`)
        product.images = [];
        product.images.push({
            public_id: res.public_id,
            url: res.secure_url
        })
    })

    if (product.images.length !== 0) {
        product.images.map(async (image) => {
            await destroyFile(image.url)

        })
    }
    console.log("top")



    product.save();

    res.status(StatusCodes.OK).json({ msg: "images updated" })
};
const getTopSheapeastProducts = async(req, res) => {

}

module.exports = {
    createProduct,
    getAllProducts,
    getSingleProduct,
    updateProduct,
    deleteProduct,
    updateProductMainImage,
    updateProductImages,
    getTopSheapeastProducts
};