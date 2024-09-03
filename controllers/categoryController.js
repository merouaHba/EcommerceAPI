const Category = require('../models/categoryModel');
const { StatusCodes } = require('http-status-codes');
const {
    checkPermissions,
    apiFeatures
} = require('../utils');

const { uploadFile, destroyFile } = require('../utils/cloudinary')
const CustomError = require('../errors');
const validateMongoDbId = require('../utils/validateMongodbId');

const createCategory = async (req, res) => {
    const { name, description } = req.body;
    if (!name || !description) {
        throw new CustomError.BadRequestError("Please Provide name and description")
    }
    const isCategoryExist = await Category.find({ name })
    if (isCategoryExist) {
        throw new CustomError.BadRequestError("this category is already exists")
    }
    if (!req.file) {
        throw new CustomError.NotFoundError("No file found, please upload file")
    }
    let image
    try {
        result = await uploadFile(req.file.path, "categories")
        image = {
            public_id: result.public_id,
            url: result.secure_url
        }  
    } catch (error) {
        throw new CustomError.BadRequestError(" Failed to Upload Image")
    }
   
    console.log(name, description, image)
    const category = await Category.create({ name, description, image })
    res.status(StatusCodes.CREATED).json({ category})
}
const getAllCategories = async (req, res) => {
    const result = await apiFeatures(req, Category);

    res.status(StatusCodes.OK).json({ ...result });
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
    const { name, description } = req.body;
    if (!name && !description) {
        throw new CustomError.BadRequestError("Please Provide data to update")
    }
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
    const category = await Category.findOne({ _id: id })

    if (!category) {
        throw new CustomError.NotFoundError(`no category found with this id ${id}`)
    }
    await destroyFile(category.image.public_id);
    await Category.deleteOne({ _id: id })

    res.status(StatusCodes.OK).json({ msg: 'category deleted successfully' })

 }
const updateCategoryImage = async (req, res) => {
    const { id } = req.params;
    validateMongoDbId(id)
    const category = await Category.findOne({ _id: id });
    if (!req.file) {
        throw new CustomError.NotFoundError("No file found, please upload file")
    }
    console.log(req.file)
    const result = await uploadFile(req.file.path, "categories");
    await destroyFile(category.image.public_id);

    category.image = {
        public_id: result.public_id,
        url: result.secure_url
    }

    category.save();

    res.status(StatusCodes.OK).json({ msg: "image updated" ,category})
}

module.exports = {
    createCategory,
    getAllCategories,
    getCategory,
    updateCategory,
    deleteCategory,
    updateCategoryImage
}