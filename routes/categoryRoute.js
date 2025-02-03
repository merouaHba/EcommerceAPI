const express = require('express')
const { deleteCategory, updateCategory, getCategory, updateCategoryImage, createCategory, getAllCategories, addSubcategory, updateSubcategory, deleteSubcategory } = require('../controllers/categoryController')
const router = express.Router()
const { authenticateUser, authorizePermissions } = require('../middlewares/authentication')
const { singleFile } = require('../utils/multer')

router.get('/', getAllCategories)
router.post('/', authenticateUser, authorizePermissions('admin'),singleFile('image'), createCategory)
router.put('/:id/update-category-image', authenticateUser,authorizePermissions('admin'),singleFile('image'), updateCategoryImage)
router.get('/:id', getCategory)
router.put('/:id', authenticateUser,authorizePermissions('admin'), updateCategory)
router.delete('/:id', authenticateUser,authorizePermissions('admin'), deleteCategory)
module.exports = router