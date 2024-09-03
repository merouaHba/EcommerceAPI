const express = require('express')
const { getAllProducts, getSingleProduct, createProduct, updateProduct, deleteProduct, updateProductMainImage, updateProductImages, getSellerProducts } = require('../controllers/productController')
const router = express.Router()
const { authenticateUser, authorizePermissions } = require('../middlewares/authentication')
const { singleFile, anyMulter } = require('../utils/multer')




router.get("/",getAllProducts)
router.get("/seller/:id?", authenticateUser, getSellerProducts)
router.post("/",authenticateUser,authorizePermissions("seller"),anyMulter(),createProduct)
router.get("/:id", getSingleProduct)
router.put("/:id",authenticateUser,authorizePermissions("seller"),updateProduct)
router.delete("/:id",authenticateUser,authorizePermissions("seller"),deleteProduct)
router.put("/update-product-main-image/:id", authenticateUser, authorizePermissions("seller"), singleFile('mainImage'), updateProductMainImage)
router.put("/update-product-images/:id", authenticateUser, authorizePermissions("seller"), anyMulter(), updateProductImages)

module.exports = router