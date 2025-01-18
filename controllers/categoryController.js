const Category = require('../models/categoryModel');
const { StatusCodes } = require('http-status-codes');
const { uploadFile, destroyFile } = require('../utils/cloudinary');
const CustomError = require('../errors');
const validateMongoDbId = require('../utils/validateMongodbId');
const { categoryAPIFeatures } = require('../utils/apiFeatures');

/**
 * Creates a new category.
 * 
 * This function validates the required fields from the request body,
 * checks for the existence of a category with the same name, and 
 * handles file uploads for the category image. If all validations 
 * pass, it creates and saves a new category in the database.
 * 
 * @param {Object} req - The request object containing category data.
 * @param {Object} res - The response object used to send the result.
 * 
 * @throws {CustomError.BadRequestError} If required fields are missing
 *                                       or if the category already exists.
 * @throws {CustomError.NotFoundError} If no file is uploaded for the image.
 * @throws {CustomError.BadRequestError} If image upload fails.
 * 
 * @returns {void} Responds with the created category data.
 */

const createCategory = async (req, res) => {
    const { name, description } = req.body;

    if (!name || !description) {
        throw new CustomError.BadRequestError("Please provide name and description");
    }

    const existingCategory = await Category.findOne({ name });
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

    const category = await Category.create({ name, description, image });
    res.status(StatusCodes.CREATED).json({ category });
};

/**
 * Retrieves all categories.
 * 
 * This function validates the query parameters, applies query filters using
 * the categoryAPIFeatures helper function, and sends the category data in the
 * response.
 * 
 * @param {Object} req - The request object containing the query parameters.
 * @param {Object} res - The response object used to send the result.
 * 
 * @throws {CustomError.InternalServerError} If an error occurs while retrieving
 *                                          categories.
 * 
 * @returns {void} Responds with the category data.
 */
const getAllCategories = async (req, res) => {
    try {
        const result = await categoryAPIFeatures(req, Category);

        res.status(StatusCodes.OK).json(result);
    } catch (error) {
        throw new CustomError.InternalServerError(error.message);
    }
};



/**
 * This function validates the category id, checks for the existence of the
 * category, and sends the category data in the response.
 * 
 * @param {Object} req - The request object containing the category id.
 * @param {Object} res - The response object used to send the result.
 * 
 * @throws {CustomError.NotFoundError} If no category is found with the given id.
 * 
 * @returns {void} Responds with the category data.
 **/

const getCategory = async (req, res) => {
    const { id } = req.params;
    validateMongoDbId(id);

    const category = await Category.findById(id);
    if (!category) {
        throw new CustomError.NotFoundError(`No category found with id: ${id}`);
    }

    res.status(StatusCodes.OK).json({ category });
};

/**
 * Updates a category with the given id.
 * 
 * This function validates the category id, checks for the existence of the
 * category, and checks if the category name already exists. If all validations
 * pass, it updates and saves the category in the database.
 * 
 * @param {Object} req - The request object containing the category id and
 *                       updated data.
 * @param {Object} res - The response object used to send the result.
 * 
 * @throws {CustomError.BadRequestError} If no data is provided to update.
 * @throws {CustomError.BadRequestError} If the category name already exists.
 * @throws {CustomError.NotFoundError} If no category is found with the given id.
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
 * This function validates the provided category ID, checks for the existence 
 * of the category, and handles the deletion of any associated image files.
 * If successful, it deletes the category from the database.
 * 
 * @param {Object} req - The request object containing the category ID in params.
 * @param {Object} res - The response object used to send the result.
 * 
 * @throws {CustomError.NotFoundError} If no category is found with the given id.
 * 
 * @returns {void} Responds with a success message upon successful deletion.
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
 * This function validates the provided category ID, checks for the existence of
 * the category, and handles the deletion of any associated image files. If
 * successful, it updates and saves the category in the database with the new
 * image.
 * 
 * @param {Object} req - The request object containing the category ID in params
 *                       and the new image file.
 * @param {Object} res - The response object used to send the result.
 * 
 * @throws {CustomError.NotFoundError} If no category is found with the given id.
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
    if(!result) {
        throw new CustomError.BadRequestError("Uploading image failed")
    }

    if (category.image?.public_id) {
        await destroyFile(category.image.public_id);
    }

    category.image = {
        public_id: result.public_id,
        url: result.secure_url
    };

    await category.save();
    res.status(StatusCodes.OK).json({
        msg: "Image updated successfully",
        category
    });
};

const addSubcategory = async (req, res) => {
    const { categoryId } = req.params;
    const { name, description } = req.body;

    validateMongoDbId(categoryId);

    if (!name || !description) {
        throw new CustomError.BadRequestError("Please provide name and description");
    }

    const category = await Category.findById(categoryId);
    if (!category) {
        throw new CustomError.NotFoundError(`No category found with id: ${categoryId}`);
    }

    const existingSubcategory = category.subcategories.find(sub => sub.name === name);
    if (existingSubcategory) {
        throw new CustomError.BadRequestError("This subcategory already exists");
    }

    category.subcategories.push({ name, description });
    await category.save();

    res.status(StatusCodes.CREATED).json({
        msg: "Subcategory added successfully",
        category
    });
};

const updateSubcategory = async (req, res) => {
    const { categoryId, subcategoryId } = req.params;
    const { name, description } = req.body;
    if (!name && !description) {
        throw new CustomError.BadRequestError("Please provide update data");
    }
    validateMongoDbId(categoryId);
    validateMongoDbId(subcategoryId);

    const category = await Category.findById(categoryId);
    if (!category) {
        throw new CustomError.NotFoundError(`No category found with id: ${categoryId}`);
    }

    const subcategory = category.subcategories.id(subcategoryId);
    if (!subcategory) {
        throw new CustomError.NotFoundError(`No subcategory found with id: ${subcategoryId}`);
    }

    if (name) {
        const existingSubcategory = category.subcategories.find(
            sub => sub.name === name && sub._id.toString() !== subcategoryId
        );
        if (existingSubcategory) {
            throw new CustomError.BadRequestError("This subcategory name already exists");
        }
    }

    if (name) subcategory.name = name;
    if (description) subcategory.description = description;

    await category.save();
    res.status(StatusCodes.OK).json({
        msg: "Subcategory updated successfully",
        category
    });
};

/**
 * Deletes a subcategory by its ID.
 * 
 * This function validates the provided category and subcategory IDs, checks for the existence of the
 * category and subcategory, and removes the subcategory from the category's subcategories array. If
 * successful, it saves the category in the database and responds with the updated category.
 * 
 * @param {Object} req - The request object containing the category ID and subcategory ID in params.
 * @param {Object} res - The response object used to send the result.
 * 
 * @throws {CustomError.NotFoundError} If no category is found with the given id.
 * @throws {CustomError.NotFoundError} If no subcategory is found with the given id.
 * 
 * @returns {void} Responds with the updated category data.
 */
const deleteSubcategory = async (req, res) => {
    const { categoryId, subcategoryId } = req.params;

    validateMongoDbId(categoryId);
    validateMongoDbId(subcategoryId);

    const category = await Category.findById(categoryId);
    if (!category) {
        throw new CustomError.NotFoundError(`No category found with id: ${categoryId}`);
    }

    const subcategory = category.subcategories.id(subcategoryId);
    if (!subcategory) {
        throw new CustomError.NotFoundError(`No subcategory found with id: ${subcategoryId}`);
    }

    category.subcategories.pull(subcategoryId);
    await category.save();

    res.status(StatusCodes.OK).json({
        msg: "Subcategory deleted successfully",
        category
    });
};

module.exports = {
    createCategory,
    getAllCategories,
    getCategory,
    updateCategory,
    deleteCategory,
    updateCategoryImage,
    addSubcategory,
    updateSubcategory,
    deleteSubcategory
};