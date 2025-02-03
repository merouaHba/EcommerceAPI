const Category = require('../models/categoryModel');
const { StatusCodes } = require('http-status-codes');
const { uploadFile, destroyFile } = require('../utils/cloudinary');
const CustomError = require('../errors');
const validateMongoDbId = require('../utils/validateMongodbId');
const { categoryAPIFeatures } = require('../utils/apiFeatures');

/**
 * Creates a new category.
 * 
 * Validates required fields, checks for duplicate category names, and handles image uploads.
 * 
 * @param {Object} req - The request object containing category data.
 * @param {Object} res - The response object used to send the result.
 * 
 * @throws {CustomError.BadRequestError} If required fields are missing or if the category already exists.
 * @throws {CustomError.NotFoundError} If no file is uploaded for the image.
 * @throws {CustomError.BadRequestError} If image upload fails.
 * 
 * @returns {void} Responds with the created category data.
 */
const createCategory = async (req, res) => {
    const { name, description, parentCategory } = req.body;

    if (!name || !description) {
        throw new CustomError.BadRequestError("Please provide name and description");
    }

    const existingCategory = await Category.findOne({ name,parentCategory: parentCategory || null });
    if (existingCategory) {
        throw new CustomError.BadRequestError("This category already exists");
    }

    if (!req.file) {
        throw new CustomError.NotFoundError("No file found, please upload file");
    }

    let image;
    try {
        const result = await uploadFile(req.file.path, "categories");
        image = {
            public_id: result.public_id,
            url: result.secure_url
        };
    } catch (error) {
        throw new CustomError.BadRequestError("Failed to upload image");
    }

    const category = await Category.create({ name, description, image, parentCategory: parentCategory || null });
    category.image.public_id = undefined;
    res.status(StatusCodes.CREATED).json({ category });
};

/**
 * Retrieves all categories.
 * 
 * Applies query filters using the categoryAPIFeatures helper function.
 * 
 * @param {Object} req - The request object containing the query parameters.
 * @param {Object} res - The response object used to send the result.
 * 
 * @throws {CustomError.InternalServerError} If an error occurs while retrieving categories.
 * 
 * @returns {void} Responds with the category data.
 */
const getAllCategories = async (req, res) => {
    // Add filter to only get parent categories
    req.query.parentCategory = null;
    try {
        const result = await categoryAPIFeatures(req, Category);
        res.status(StatusCodes.OK).json(result);
    } catch (error) {
        throw new CustomError.InternalServerError(error.message);
    }
};

/**
 * Retrieves a single category by its ID.
 * 
 * Validates the category ID and checks for the existence of the category.
 * Populates both parent category and subcategories data.
 * 
 * @param {Object} req - The request object containing the category ID.
 * @param {Object} res - The response object used to send the result.
 * 
 * @throws {CustomError.NotFoundError} If no category is found with the given ID.
 * 
 * @returns {void} Responds with the category data including parent and subcategories.
 */
const getCategory = async (req, res) => {
    const { id } = req.params;
    validateMongoDbId(id);

    const category = await Category.findById(id).select('-image.public_id')
        .populate('parentCategory', 'name slug image.url')
        .populate({
            path: 'subcategories',
            select: 'name description slug image.url status displayOrder -parentCategory',
            match: { status: 'active' },
            options: { sort: { displayOrder: 1 } }
        });

    if (!category) {
        throw new CustomError.NotFoundError(`No category found with id: ${id}`);
    }

    res.status(StatusCodes.OK).json({ category });
};

/**
 * Updates a category by its ID.
 * 
 * Validates the category ID, checks for duplicate names, and updates the category.
 * 
 * @param {Object} req - The request object containing the category ID and updated data.
 * @param {Object} res - The response object used to send the result.
 * 
 * @throws {CustomError.BadRequestError} If no data is provided to update.
 * @throws {CustomError.BadRequestError} If the category name already exists.
 * @throws {CustomError.NotFoundError} If no category is found with the given ID.
 * 
 * @returns {void} Responds with the updated category data.
 */
const updateCategory = async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name && !description) {
        throw new CustomError.BadRequestError("Please provide data to update");
    }
    validateMongoDbId(id);

    if (name) {
        const existingCategory = await Category.findOne({
            name,
            _id: { $ne: id }
        });
        if (existingCategory) {
            throw new CustomError.BadRequestError("This category name already exists");
        }
    }

    const category = await Category.findByIdAndUpdate(
        id,
        { name, description },
        { new: true, runValidators: true }
    );

    if (!category) {
        throw new CustomError.NotFoundError(`No category found with id: ${id}`);
    }

    res.status(StatusCodes.OK).json({
        msg: 'Category updated successfully',
        category
    });
};

/**
 * Deletes a category by its ID.
 * 
 * Validates the category ID, checks for the existence of the category, and deletes it.
 * 
 * @param {Object} req - The request object containing the category ID.
 * @param {Object} res - The response object used to send the result.
 * 
 * @throws {CustomError.NotFoundError} If no category is found with the given ID.
 * 
 * @returns {void} Responds with a success message upon deletion.
 */
const deleteCategory = async (req, res) => {
    const { id } = req.params;
    validateMongoDbId(id);

    const category = await Category.findById(id);
    if (!category) {
        throw new CustomError.NotFoundError(`No category found with id: ${id}`);
    }

    if (category.image?.public_id) {
        await destroyFile(category.image.public_id);
    }

    await Category.deleteOne({ _id: id });
    res.status(StatusCodes.OK).json({ msg: 'Category deleted successfully' });
};

/**
 * Updates the image of a category by its ID.
 * 
 * Validates the category ID, checks for the existence of the category, and updates its image.
 * 
 * @param {Object} req - The request object containing the category ID and the new image file.
 * @param {Object} res - The response object used to send the result.
 * 
 * @throws {CustomError.NotFoundError} If no category is found with the given ID.
 * @throws {CustomError.BadRequestError} If no file is uploaded for the image.
 * @throws {CustomError.BadRequestError} If image upload fails.
 * 
 * @returns {void} Responds with the updated category data.
 */
const updateCategoryImage = async (req, res) => {
    const { id } = req.params;
    validateMongoDbId(id);

    if (!req.file) {
        throw new CustomError.NotFoundError("No file found, please upload file");
    }

    const category = await Category.findById(id);
    if (!category) {
        throw new CustomError.NotFoundError(`No category found with id: ${id}`);
    }

    const result = await uploadFile(req.file.path, "categories");
    if (!result) {
        throw new CustomError.BadRequestError("Uploading image failed");
    }

    if (category.image?.public_id) {
        await destroyFile(category.image.public_id);
    }

    category.image = {
        public_id: result.public_id,
        url: result.secure_url
    };

    await category.save();

    category.image = {
        url: result.secure_url
    };

    res.status(StatusCodes.OK).json({
        msg: "Image updated successfully",
        category
    });
};

module.exports = {
    createCategory,
    getAllCategories,
    getCategory,
    updateCategory,
    deleteCategory,
    updateCategoryImage
};