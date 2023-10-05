const Category = require('../models/categoryModel');
const { StatusCodes } = require('http-status-codes');
const {
    checkPermissions
} = require('../utils');

const { uploadFile, destroyFile } = require('../utils/cloudinary')
const CustomError = require('../errors');
const validateMongoDbId = require('../utils/validateMongodbId');

const createCategory = async (req, res) => {
    if (!req.file) {
        throw new CustomError.NotFoundError("No file found, please upload file")
    }
    const result = await uploadFile(req.file.path, "categories")
    image = {
        public_id: result.public_id,
        url: result.secure_url
    }
    const category = await Category.create({ ...req.body, image })
    res.status(StatusCodes.CREATED).json({ category})
}
const getAllCategories = async (req, res) => {
    const categories = await Category.find({})
    res.status(StatusCodes.OK).json({ categories,nbCategories: categories.length })
}
const getCategory = async (req, res) => {
    const { id } = req.params;
    validateMongoDbId(id)
    const category = await Category.findOne({ _id: id })
    if (!category) {
        throw new CustomError.NotFoundError(`no category found with this id ${id}`)
    }
    res.status(StatusCodes.OK).json({ category})
}
const updateCategory = async (req, res) => {
    const { id } = req.params
    validateMongoDbId(id)
    const category = await Category.findOneAndUpdate({ _id: id }, req.body, {
        new: true,
        runValidators: true,
    })

    if (!category) {
        throw new CustomError.NotFoundError(`no category found with this id ${id}`)
    }
    res.status(StatusCodes.OK).json({msg:'category updated successfully', category })

}
const deleteCategory = async (req, res) => {
    const { id } = req.params
    validateMongoDbId(id)
    const category = await Category.findOneAndDelete({ _id: id })

    if (!category) {
        throw new CustomError.NotFoundError(`no category found with this id ${id}`)
    }
    res.status(StatusCodes.OK).json({ msg: 'category deleted successfully' })

 }
const updateCategoryImage = async (req, res) => {
    const { id } = req.params;
    validateMongoDbId(id)
    const category = await Category.findOne({ _id: id });
    if (!req.file) {
        throw new CustomError.NotFoundError("No file found, please upload file")
    }
    const result = await uploadFile(req.file.path, "categories");

    category.image = {
        public_id: result.public_id,
        url: result.secure_url
    }

    category.save();

    res.status(StatusCodes.OK).json({ msg: "image uploaded" })
}

module.exports = {
    createCategory,
    getAllCategories,
    getCategory,
    updateCategory,
    deleteCategory,
    updateCategoryImage
}