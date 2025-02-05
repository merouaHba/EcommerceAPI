const User = require('../models/userModel');
const Favourite = require('../models/userModel');
const Cart = require('../models/userModel');
const { StatusCodes } = require('http-status-codes');
const {
    createTokenUser,
    createJWT,
} = require('../utils');

const { uploadFile, destroyFile } = require('../utils/cloudinary')
const CustomError = require('../errors');
const validateMongoDbId = require('../utils/validateMongodbId');
const { userAPIFeatures } = require('../utils/apiFeatures');
const { default: mongoose } = require('mongoose');




const createUser = async (req, res) => {
   
        const {
            email,
            mobile,
            role = 'user',
            firstname,
            lastname,
            password,
            storeName,
            storeDetails
        } = req.body;

        // Basic validation for all users
        if (!firstname || !lastname || !email || !password) {
            throw new CustomError.BadRequestError('Please provide all required fields: firstname, lastname, email, password');
        }

        // Check for existing email
        const findUserByEmail = await User.findOne({ email });
        if (findUserByEmail) {
            throw new CustomError.BadRequestError('User with this email already exists');
        }

        // Additional validation for seller accounts
        if (role === 'seller') {
            // Validate seller-specific fields
            if (!mobile || !storeName || !storeDetails) {
                throw new CustomError.BadRequestError('Seller accounts require mobile, storeName, and storeDetails');
            }

            // Validate store details
            const requiredStoreFields = ['street', 'state', 'postalCode', 'country'];
            for (const field of requiredStoreFields) {
                if (!storeDetails[field]) {
                    throw new CustomError.BadRequestError(`Store details must include ${field}`);
                }
            }

            // Check for existing mobile number (only for sellers)
            const findUserByMobile = await User.findOne({ mobile });
            if (findUserByMobile) {
                throw new CustomError.BadRequestError('User with this mobile number already exists');
            }
        }

        // Base user data
        const userData = {
            firstname,
            lastname,
            email,
            password,
            role,
            isVerified: true, // Since admin is creating
            verified: new Date(),
            termsAccepted: true,
            termsAcceptedAt: new Date(),
            termsVersion: '1.0'
        };

        // Add seller-specific data if role is seller
        if (role === 'seller') {
            Object.assign(userData, {
                mobile,
                storeName,
                storeDetails,
                balance: 0 // Initialize seller balance
            });
        }

        // Create the user
        const user = await User.create(userData);


        // Structure the response based on role
        const responseUser = {
            _id: user._id,
            email: user.email,
            role: user.role,
            name: `${user.firstname} ${user.lastname}`,
            isVerified: user.isVerified
        };

        // Add seller-specific info to response if applicable
        if (role === 'seller') {
            Object.assign(responseUser, {
                mobile: user.mobile,
                storeName: user.storeName,
                balance: user.balance
            });
        }

        res.status(StatusCodes.CREATED).json({
            msg: `Success! ${role.charAt(0).toUpperCase() + role.slice(1)} account created`,
            user: responseUser
        });

    
};


const getAllUsers = async (req, res) => {
    req.query.role = { $nin:['admin']}
    const result = await userAPIFeatures(req, User);

    res.status(StatusCodes.OK).json({ ...result });
};

const getSingleUser = async (req, res) => {
    const { userId } = req.params;
    const { _id, role } = req.user;
    const id = role === "admin" ? userId : _id;
    validateMongoDbId(id)
    let user ;
    if (role === "admin") {
        user = await User.findOne({ _id: id }).select('-password');
    } else if (role === "seller") {
        user = await User.findOne({ _id: id }).select('firstname lastname profilePicture email mobile role address storeName storeDetails balance');
    } else {
        user = await User.findOne({ _id: id }).select('firstname lastname profilePicture email mobile role address');
    }
    if (!user) {
        throw new CustomError.NotFoundError(`No user with id : ${id}`);
    }
   
    const userObject = user.toObject()
    userObject.name = `${user.firstname} ${user.lastname}`
    userObject.profilePicture = user.profilePicture?.url
    res.status(StatusCodes.OK).json({ user: userObject });
};

const updateUser = async (req, res) => {
    const { userId } = req.params;
    const { _id, role } = req.user;
    const id = role === "admin" ? userId : _id;
    validateMongoDbId(id)
    let user = await User.findById( id)

    if (!user) {
        throw new CustomError.NotFoundError(`No user with this id: ${id}`)
    }
    const {firstname,lastname, mobile,address,storeName,storeDetails} = req.body;
    if (!firstname && !lastname && !mobile && !address && (user.role === "seller" && (!storeName && !storeDetails))) {
        throw new CustomError.BadRequestError("no updated data")
    }
    if (mobile) {
        const userExists = await User.findOne({ mobile: mobile });

        if (userExists && !(new mongoose.Types.ObjectId(user._id)).equals(userExists._id) ) {
            throw new CustomError.BadRequestError("mobile number already exist")
        }
        user.mobile = mobile
    }
    if (firstname) {
        user.firstname = firstname
    }
    if (lastname) {
        user.lastname = lastname
    }

    if (address) {
        user.address = address
        }

    if (user.role === "seller") { 
        if (storeName) {
            user.storeName = storeName
        }
        if (storeDetails) {
            user.storeDetails = storeDetails
        }

    }

    await user.save();

    const tokenUser = createTokenUser(user);
    const accessToken = createJWT({ payload: tokenUser, expireDate: '75m', jwtSecret: process.env.ACCESS_TOKEN_SECRET })
    res.status(StatusCodes.OK).json({ user: tokenUser, accessToken });
};

const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        validateMongoDbId(userId);

        // Find user first to check existence and delete
        const user = await User.findByIdAndDelete(userId );
        if (!user) {
            throw new CustomError.NotFoundError(`No user found with id: ${userId}`);
        }
        // Delete associated profile image if exists
        if (user.profilePicture?.public_id) {
            await destroyFile(user.profilePicture.public_id);
        }

        // Delete user's cart
        await Cart.findOneAndDelete({ user: userId });

        // Delete user's favourites
        await Favourite.findOneAndDelete({ user: userId });

       

        res.status(StatusCodes.OK).json({
            msg: 'Success! User deleted',
            deletedUser: {
                _id: user._id,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        throw new CustomError.BadRequestError('Failed to delete user: ' + error.message);
    }
};

const uploadProfileImage = async (req, res) => {
    const { userId } = req.params;
    const { _id, role } = req.user;
    const id = role === "admin" ? userId : _id;
    validateMongoDbId(id)
    const user = await User.findOne({ _id: id });
    if (!req.file) {
        throw new CustomError.NotFoundError("No file found, please upload file")
    }
    const result = await uploadFile(req.file.path, `users/${id}`);

    if (user.profilePicture.url) {
        await destroyFile(user.profilePicture.public_id)
    }
    if (!result.public_id && !result.secure_url) {
        throw new CustomError.BadRequestError("Uploading image failed")
    }
    user.profilePicture = {
        public_id: result.public_id,
        url: result.secure_url
    }
    user.save();

    res.status(StatusCodes.OK).json({ profilePicture: user.profilePicture.url })
}
const deleteProfileImage = async (req, res) => {
    const { userId } = req.params;
    const { _id, role } = req.user;
    const id = role === "admin" ? userId : _id;
    validateMongoDbId(id)
    const user = await User.findOne({ _id: id });
    if (!user) {
        throw new CustomError.NotFoundError(`No user with this id: ${id}`)
    }
    if (user.profilePicture.url) {
        try {
            await destroyFile(user.profilePicture.public_id)
        } catch (err) {
            throw new CustomError.BadRequestError("Deleting Image failed")
        }
        user.profilePicture = {
            public_id: "",
            url: ""
        }

        user.save();

        res.status(StatusCodes.OK).json({ msg: 'profile image deleted successfully' })
    } else {

        throw new CustomError.NotFoundError(`There is no profile image`)

    }
}





module.exports = {
    createUser,
    getAllUsers,
    getSingleUser,
    updateUser,
    deleteUser,
    uploadProfileImage,
    deleteProfileImage
};

