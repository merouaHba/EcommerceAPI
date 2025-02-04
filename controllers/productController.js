const slugify = require('slugify');
const mongoose = require('mongoose');
const { StatusCodes } = require('http-status-codes');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const { uploadFile, destroyFile } = require('../utils/cloudinary');
const CustomError = require('../errors');
const { checkPermissions } = require('../utils');
const validateMongoDbId = require('../utils/validateMongodbId');
const { productAPIFeatures, sellerProductsAPIFeatures } = require('../utils/apiFeatures');

const createProduct = async (req, res) => {
    
    const {
        name,
        basePrice,
        description,
        category,
subcategory,
        inventoryManagement,
        attributes,
        variations,
        hasVariations,
        shippingOptions
    } = req.body;

    // Validation checks
    if (!name || !basePrice || !description || !category) {
        throw new CustomError.BadRequestError('Provide all required fields');
    }

    validateMongoDbId(category);
if (subcategory) validateMongoDbId(subcategory); // Validate subcategory if provided

// Verify category and subcategory relationship
const categoryDoc = await Category.findById(category);
if (!categoryDoc) {
    throw new CustomError.NotFoundError('Category not found');
}

if (subcategory) {
    const subcategoryDoc = await Category.findById(subcategory);
    if (!subcategoryDoc || subcategoryDoc.parentCategory.toString() !== category) {
        throw new CustomError.BadRequestError('Invalid subcategory for the selected category');
    }
}
    // Seller validation
    const seller = req.user.role === 'admin' && req.body.seller
        ? req.body.seller
        : req.user._id;

    // Image processing (existing code)
        const files = req.files;
    const slug = slugify(req.body.name)
        let mainImage = {
            public_id: '',
            url: '',
        }
        let images = []
        if (!files || files.length < 2) {
            throw new CustomError.BadRequestError('please upload images')
        }
        const fieldnames = []
        files.map(file => {
            fieldnames.push(file.fieldname)
        })

        if (!fieldnames.includes("mainImage")) {
            throw new CustomError.BadRequestError('please upload main image')
        }


        await Promise.all(files.map(async (file) => {

            try {
                const result = await uploadFile(file.path, `products`);

                if (file.fieldname === 'mainImage') {
                    mainImage.public_id = result.public_id
                    mainImage.url = result.secure_url

                }
                images.push({
                    public_id: result.public_id,
                    url: result.secure_url
                })


            } catch (err) {
                // 👇️ catch block ran:  An error occurred
                throw new CustomError.BadRequestError("failled to upload images")
            }


        }))

    // Shipping Options Validation
    const processedShippingOptions = (shippingOptions || []).map(option => ({
        method: option.method || 'standard',
        price: option.price || 0,
        deliveryTime: {
            min: option.deliveryTime?.min || 3,
            max: option.deliveryTime?.max || 7
        },
        applicableRegions: option.applicableRegions || ['*'], // Default to all regions
        conditions: {
            minOrderValue: option.conditions?.minOrderValue || 0,
            maxOrderWeight: option.conditions?.maxOrderWeight || Infinity
        }
    }));

    // Variation handling
    const processedVariations = hasVariations && variations
        ? variations.map(variation => ({
            attributes: variation.attributes,
            sku: variation.sku || `${slug}-${Object.values(variation.attributes).join('-')}`,
            price: variation.price || basePrice,
            quantity: variation.quantity || 0,
            images: variation.images || []
        }))
        : [];

    // Product creation data
    const productData = {
        name,
        slug,
        basePrice,
        description,
        category,
        subcategory,
        seller,
        mainImage,
        images,
        shippingOptions: processedShippingOptions,
        inventoryManagement: hasVariations ? 'variation' : 'simple',
        hasVariations: !!hasVariations,
        attributes: attributes || [],
        variations: processedVariations,
        ...req.body
    };

    // Remove undefined fields
    Object.keys(productData).forEach(key =>
        productData[key] === undefined && delete productData[key]
    );

    const product = await Product.create(productData);
    product.mainImage.public_id = undefined
    product.images = product.images.map(image => {
        return {
            url: image.url
        }
    })
    res.status(StatusCodes.CREATED).json({ product });
};

const getAllProducts = async (req, res) => {
    const result = await productAPIFeatures(req, Product);

    res.status(StatusCodes.OK).json({ ...result });
};

const getSingleProduct = async (req, res) => {
    const { id } = req.params;
    validateMongoDbId(id);

    const product = await Product.findById(id)
        .populate({
            path: 'category',
            select: 'name'
        })
        .populate({
            path: 'subcategory',
            select: 'name',
        })
        .populate({
            path: 'seller',
            select: 'firstname lastname storeName profilePicture.url'
        })
        .lean();

    if (!product) {
        throw new CustomError.NotFoundError(`No product found with id: ${id}`);
    }
    res.status(StatusCodes.OK).json({ product, relatedProducts: await findRelatedProducts(product.category, id) });
};
// Helper function to find related products
async function findRelatedProducts(categoryId, currentProductId) {
    return await Product.find({
        category: categoryId,
        _id: { $ne: currentProductId },
        status: 'active'
    })
        .limit(4)
        .select('name mainImage.url basePrice')
        .lean();
}

// Get seller dashboard stats
// const getSellerDashboardStats = async (req, res) => {
//     const seller = req.user._id;

//     const [
//         activeProducts,
//         outOfStockProducts,
//         lowStockProducts,
//         draftProducts
//     ] = await Promise.all([
//         Product.countDocuments({ seller, status: 'active' }),
//         Product.countDocuments({ seller, stockStatus: 'out_of_stock' }),
//         Product.countDocuments({ seller, stockStatus: 'low_stock' }),
//         Product.countDocuments({ seller, status: 'draft' })
//     ]);

//     res.status(StatusCodes.OK).json({
//         stats: {
//             activeProducts,
//             outOfStockProducts,
//             lowStockProducts,
//             draftProducts
//         }
//     });
// };
const getSellerDashboardStats = async (req, res) => {
    const seller = req.user._id;

    try {
        const [
            totalProducts,
            activeProducts,
            outOfStockProducts,
            lowStockProducts,
            draftProducts,
            totalSold,
            totalRevenue,
            averageRating,
            topSellingProducts,
            // recentOrders,
            inventorySummary
        ] = await Promise.all([
            Product.countDocuments({ seller }),
            Product.countDocuments({ seller, status: 'active' }),
            Product.countDocuments({ seller, stockStatus: 'out_of_stock' }),
            Product.countDocuments({ seller, stockStatus: 'low_stock' }),
            Product.countDocuments({ seller, status: 'draft' }),
            Product.aggregate([
                { $match: { seller } },
                { $group: { _id: null, totalSold: { $sum: '$sold' } } }
            ]),
            Product.aggregate([
                { $match: { seller } },
                { $group: { _id: null, totalRevenue: { $sum: { $multiply: ['$sold', '$basePrice'] } } } }
            ]),
            Product.aggregate([
                { $match: { seller } },
                { $group: { _id: null, averageRating: { $avg: '$ratingsAverage' } } }
            ]),
            Product.find({ seller, sold: { $gt: 0 } })
                .sort({ sold: -1 })
                .limit(5)
                .select('name description mainImage.url sold basePrice'),
            // Order.find({ seller })
            //     .sort({ createdAt: -1 })
            //     .limit(5)
            //     .select('totalAmount status createdAt'),
            Product.aggregate([
                { $match: { seller } },
                { $group: { _id: null, totalQuantity: { $sum: '$quantity' }, totalReserved: { $sum: '$reservedQuantity' }, totalBackorders: { $sum: '$backorderCount' } } }
            ])
        ]);

        res.status(StatusCodes.OK).json({
            stats: {
                totalProducts: totalProducts,
                activeProducts,
                outOfStockProducts,
                lowStockProducts,
                draftProducts,
                totalSold: totalSold.length > 0 ? totalSold[0].totalSold : 0,
                totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].totalRevenue : 0,
                averageRating: averageRating.length > 0 ? averageRating[0].averageRating : 0,
                topSellingProducts,
                // recentOrders,
                inventorySummary: inventorySummary.length > 0 ? inventorySummary[0] : { totalQuantity: 0, totalReserved: 0, totalBackorders: 0 }
            }
        });
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Error fetching dashboard stats',
            error: error.message
        });
    }
};
//  Get Seller Products
const getSellerProducts = async (req, res) => {

    const sellerId =  req.params.id??req.user._id;

    validateMongoDbId(sellerId);

    // Add seller filter to the request query
    const modifiedReq = {
        ...req,
        query: {
            ...req.query,
            seller: sellerId
        }
    };

    // Get products using API features
    const result = await sellerProductsAPIFeatures(modifiedReq, Product);

    res.status(StatusCodes.OK).json({ ...result });
};

// Update product status
const updateProductStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    validateMongoDbId(id);

    const product = await Product.findOne({ _id: id });

    if (!product) {
        throw new CustomError.NotFoundError(`No product with id: ${id}`);
    }

    checkPermissions(product.seller, req.user._id, 'seller');

    product.status = status;
    await product.save();
    product.mainImage.public_id = undefined
    product.images = product.images.map(image => {
        return {
            url: image.url
        }
    })
    res.status(StatusCodes.OK).json({
        message: 'Product status updated successfully',
        product
    });
};

// Update product inventory
const updateProductInventory = async (req, res) => {
    const { id } = req.params;
    const {
        quantity,
        lowStockThreshold,
        allowBackorders,
        backorderLimit
    } = req.body;

    validateMongoDbId(id);

    const product = await Product.findOne({ _id: id });

    if (!product) {
        throw new CustomError.NotFoundError(`No product with id: ${id}`);
    }

    checkPermissions(product.seller, req.user._id, 'seller');

    // Update inventory fields if provided
    if (quantity !== undefined) product.quantity = quantity;
    if (lowStockThreshold !== undefined) product.lowStockThreshold = lowStockThreshold;
    if (allowBackorders !== undefined) product.allowBackorders = allowBackorders;
    if (backorderLimit !== undefined) product.backorderLimit = backorderLimit;

    await product.save();
    product.mainImage.public_id = undefined
    product.images = product.images.map(image => {
        return {
            url: image.url
        }
    })
    res.status(StatusCodes.OK).json({
        message: 'Inventory updated successfully',
        product
    });
};


const updateProduct = async (req, res) => {
    const { id: productId } = req.params;

    validateMongoDbId(productId);

    const product = await Product.findById(productId);

    if (!product) {
        throw new CustomError.NotFoundError(`No product with id: ${productId}`);
    }

    checkPermissions(product.seller, req.user._id, 'seller');

    if (req.body.name) {
        req.body.slug = slugify(req.body.name);
    }

    const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        req.body,
        { new: true, runValidators: true }
    );
    updatedProduct.mainImage.public_id = undefined
    updatedProduct.images = product.images.map(image => {
        return {
            url: image.url
        }
    })
    res.status(StatusCodes.OK).json({
        message: "Product updated successfully",
        product: updatedProduct
    });
};

const deleteProduct = async (req, res) => {
    const { id: productId } = req.params;

    validateMongoDbId(productId);

    const product = await Product.findById(productId);

    if (!product) {
        throw new CustomError.NotFoundError(`No product with id: ${productId}`);
    }

    checkPermissions(product.seller, req.user._id, 'seller');

    // Delete cloudinary images
    await destroyFile(product.mainImage.public_id);
    await Promise.all(product.images.map(img => destroyFile(img.public_id)));

    await Product.findByIdAndDelete(productId);

    res.status(StatusCodes.OK).json({ message: 'Product deleted successfully' });
};

const updateProductMainImage = async (req, res) => {
    const { id: productId } = req.params;

    validateMongoDbId(productId)

    const productExists = await Product.findById(productId);

    if (!productExists) {
        throw new CustomError.NotFoundError(`No product with id : ${productId}`);
    }
    const idSeller =  req.user._id;
    checkPermissions(productExists.seller, idSeller, 'seller')
    const product = await Product.findOne({ _id: productId });
    if (!req.file) {
        throw new CustomError.NotFoundError("No file found, please upload file")
    }
    try {
        
        const result = await uploadFile(req.file.path, `products`);
        if (product.mainImage.public_id) {
            await destroyFile(product.mainImage.public_id)
        }
        product.mainImage = {
            public_id: result.public_id,
            url: result.secure_url
        }
    } catch (err) {
        throw new CustomError.BadRequestError("failled to upload images")
    }
   
    product.save();
    product.mainImage.public_id = undefined
    product.images = product.images.map(image => {
        return {
            url: image.url
        }
    })
    res.status(StatusCodes.OK).json({ message: 'Product updated successfully', product });
};
const updateProductImages = async (req, res) => {
    const { id: productId } = req.params;

    validateMongoDbId(productId);

    const product = await Product.findById(productId);

    if (!product) {
        throw new CustomError.NotFoundError(`No product with id: ${productId}`);
    }

    checkPermissions(product.seller, req.user._id, 'seller');

    if (!req.files || req.files.length < 2) {
        throw new CustomError.BadRequestError('Upload at least two images');
    }

    // Delete existing images
    await Promise.all(product.images.map(img => img.public_id &&  destroyFile(img.public_id)));

    const images = await Promise.all(req.files.map(async (file) => {
        const result = await uploadFile(file.path, 'products');
        return {
            public_id: result.public_id,
            url: result.secure_url
        };
    }));

    product.images = images;
    product.mainImage = images[0];
    await product.save();
    product.mainImage.public_id = undefined
    product.images = product.images.map(image => {
        return {
            url: image.url
        }
    })
    res.status(StatusCodes.OK).json({
        message: 'Product images updated',
        product
    });
};

const getProductsByCategory = async (req, res) => {
    const { categoryId } = req.params;

    validateMongoDbId(categoryId);

    const result = await productAPIFeatures(
        { ...req, query: { ...req.query, category: categoryId } },
        Product
    );

    res.status(StatusCodes.OK).json({ ...result });
};

const searchProducts = async (req, res) => {
    const { query } = req.query;
    delete req.query.query;

    const result = await productAPIFeatures(
        { ...req, query: { ...req.query, search: query } },
        Product
    );

    res.status(StatusCodes.OK).json({ ...result });
};


const getTopSheapestProducts = async (req, res) => {
    const { limit = 10, category } = req.query;
    const query = {
        status: 'active',
        quantity: { $gt: 0 }
    };

    if (category) {
        validateMongoDbId(category);
        query.category = category;
    }

    let products = await Product.find(query)
        .sort({ basePrice: 1 })
        .limit(parseInt(limit))
        .select('name basePrice mainImage category')
        .populate({
            path: 'category',
            select: 'name'
        })
        .lean();
    products = products.map(product => { 
        product.mainImage.public_id = undefined
        return product
    })
    res.status(StatusCodes.OK).json({ products });
};

// Get Featured Products
const getFeaturedProducts = async (req, res) => {
    let products = await Product.find({
        status: 'active',
        ratingsAverage: { $gte: 4 },
        sold: { $gt: 0 }
    })
        .sort({ sold: -1, ratingsAverage: -1 })
        .limit(8)
        .select('name basePrice mainImage ratingsAverage sold')
        .lean();
    products = products.map(product => {
        product.mainImage.public_id = undefined
        return product
    })
    res.status(StatusCodes.OK).json({ products });
};

// Get Products by Price Range
const getProductsByPriceRange = async (req, res) => {
    const { minPrice, maxPrice } = req.query;

    const query = {
        status: 'active',
        basePrice: {}
    };

    if (minPrice) query.basePrice.$gte = parseFloat(minPrice);
    if (maxPrice) query.basePrice.$lte = parseFloat(maxPrice);

    const result = await productAPIFeatures({ ...req, query }, Product);

    res.status(StatusCodes.OK).json({ ...result });
};

// Get Recently Added Products
const getRecentProducts = async (req, res) => {
    const { days = 7, limit = 10 } = req.query;

    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - parseInt(days));

    let products = await Product.find({
        status: 'active',
        createdAt: { $gte: recentDate }
    })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .select('name basePrice mainImage createdAt')
        .lean();
    products = products.map(product => {
        product.mainImage.public_id = undefined
        return product
    })
    res.status(StatusCodes.OK).json({ products });
};

// Get Products Stock Alert
const getProductsStockAlert = async (req, res) => {
    const  seller  = req.user._id;

    let lowStockProducts = await Product.find({
        seller,
        status: 'active',
        $or: [
            { stockStatus: 'low_stock' },
            { stockStatus: 'out_of_stock' }
        ]
    })
        .select('name quantity lowStockThreshold stockStatus mainImage')
        .sort({ quantity: 1 })
        .lean();
    lowStockProducts = lowStockProducts.map(product => {
        product.mainImage.public_id = undefined
        return product
    })
    res.status(StatusCodes.OK).json({ products: lowStockProducts });
};

// Bulk Update Products
const bulkUpdateProducts = async (req, res) => {
    const { updates } = req.body;

    if (!Array.isArray(updates)) {
        throw new CustomError.BadRequestError('Updates must be an array');
    }
    const results = await Promise.all(
        updates.map(async ({ productId, ...updateData }) => {
            try {
                validateMongoDbId(productId);
                const product = await Product.findById(productId);

                if (!product) {
                    return { productId, success: false, error: 'Product not found' };
                }

                checkPermissions(product.seller, req.user._id, 'seller');

                let updatedProduct = await Product.findByIdAndUpdate(
                    productId,
                    updateData,
                    { new: true, runValidators: true }
                );
                updatedProduct.mainImage.public_id = undefined
                updatedProduct.images = updatedProduct.images.map(image => {
                    image.public_id = undefined
                    return image
                })
                
                return { productId, success: true, product: updatedProduct };
            } catch (error) {
                return { productId, success: false, error: error.message };
            }
        })
    );

    res.status(StatusCodes.OK).json({ results });
};


module.exports = {
    createProduct,//💯
    getAllProducts,//💯
    getSingleProduct,//💯
    getSellerDashboardStats,//💯
    getSellerProducts,//💯
    updateProductStatus,//💯
    updateProductInventory,//💯
    updateProduct,//💯
    deleteProduct,//💯
    updateProductMainImage,//💯
    updateProductImages,//💯
    getProductsByCategory,//💯
    searchProducts,//💯
    getTopSheapestProducts,
    getFeaturedProducts,
    getProductsByPriceRange,
    getRecentProducts,
    getProductsStockAlert,
    bulkUpdateProducts
};