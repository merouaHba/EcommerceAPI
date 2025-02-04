const express = require('express')
const {
    getAllProducts,
    getSingleProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    updateProductMainImage,
    updateProductImages,
    getSellerProducts,
    getSellerDashboardStats,
    updateProductStatus,
    updateProductInventory,
    searchProducts,
    getTopSheapestProducts,
    getProductsByCategory,
    getFeaturedProducts,
    getProductsByPriceRange,
    getRecentProducts,
    getProductsStockAlert,
    bulkUpdateProducts } = require('../controllers/productController')
const router = express.Router()
const { authenticateUser, authorizePermissions } = require('../middlewares/authentication')
const { singleFile, anyMulter } = require('../utils/multer')




router.get("/",getAllProducts)
router.get("/search", searchProducts)
router.get("/category/:categoryId", getProductsByCategory)

// Seller dashboard route
router.get(
    '/seller/dashboard',
    authenticateUser,
    authorizePermissions('admin', 'seller'),
    getSellerDashboardStats
);
// Get seller's products with optional filters
router.get(
    '/seller/:id?',
    authenticateUser,
    authorizePermissions('admin', 'seller'),
    getSellerProducts
);




// Product management routes
router.post(
    '/',
    authenticateUser,
    authorizePermissions('admin', 'seller'),
    anyMulter(),
    createProduct
);
router.get('/cheapest', getTopSheapestProducts);
router.get('/featured', getFeaturedProducts);
router.get('/price-range', getProductsByPriceRange);
router.get('/recent', getRecentProducts);
router.get('/stock-alert', authenticateUser, authorizePermissions('seller', 'admin'), getProductsStockAlert);
router.put('/bulk-update', authenticateUser, authorizePermissions('seller', 'admin'), bulkUpdateProducts);

router.get("/:id", getSingleProduct)

router.put(
    '/:id',
    authenticateUser,
    authorizePermissions('seller', 'admin'),
    updateProduct
);

router.delete(
    '/:id',
    authenticateUser,
    authorizePermissions('seller', 'admin'),
    deleteProduct
);

// Product images update route
router.put(
    '/:id/images',
    authenticateUser,
    authorizePermissions('seller', 'admin'),
    anyMulter(),
    updateProductImages
);
// Product main image update route
router.put(
    '/:id/main-image',
    authenticateUser,
    authorizePermissions('seller', 'admin'),
    singleFile('image'),
    updateProductMainImage
);

// Product status update route
router.put(
    '/:id/status',
    authenticateUser,
    authorizePermissions('seller', 'admin'),
    updateProductStatus
);

// Inventory management route
router.put(
    '/:id/inventory',
    authenticateUser,
    authorizePermissions('seller', 'admin'),
    updateProductInventory
);




module.exports = router