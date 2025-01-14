const User = require('../models/userModel');
const { StatusCodes } = require('http-status-codes');
const {
    createTokenUser,
    attachCookiesToResponse,
    createJWT,
    checkPermissions
} = require('../utils');

const { uploadFile, destroyFile } = require('../utils/cloudinary')
const CustomError = require('../errors');
const validateMongoDbId = require('../utils/validateMongodbId');



const createUser = async (req, res) => {
    const { email } = req.body;


    const findUserByEmail = await User.findOne({ email: email });

    console.log(!findUserByEmail)

    if (!findUserByEmail && !findUserByMobile) {


        const verificationToken = "";
        console.log(req.body)
        const user = await User.create({ ...req.body, verificationToken, isVerified: true })
        res.status(StatusCodes.CREATED).json({
            msg: 'Success! Account Created',
        });

    } else {
        throw new CustomError.BadRequestError('User Already Exists')
    }

}


const getAllUsers = async (req, res) => {
    console.log(req.user);
    // const users = await User.find({ $or:[{role: 'user'},{role:'seller'}] }).select('-password');
    // res.status(StatusCodes.OK).json({ users });
    const result = await apiFeatures(req, User);

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
    // generate token
    const tokenUser = createTokenUser(user);
    const refreshToken = attachCookiesToResponse({ res, rememberMe:false, user: tokenUser });
    user.refreshToken = [...user.refreshToken,refreshToken];
    await user.save();
    const accessToken = createJWT({ payload: tokenUser, expireDate: '15m', jwtSecret: process.env.ACCESS_TOKEN_SECRET })
    res.status(StatusCodes.OK).json({ user: tokenUser, accessToken });
};

const updateUser = async (req, res) => {
    const { userId } = req.params;
    const { _id, role } = req.user;
    const id = role === "admin" ? userId : _id;
    validateMongoDbId(id)
    const {firstname,lastname, mobile,address,storeName,storeDetails} = req.body;
    if (!firstname || !lastname|| !mobile || !address || (role === "seller" &&(!storeName || !storeDetails))) {
        throw new CustomError.BadRequestError("no updated data")
    }
    const updatedData = {};
    if (mobile) {
        const user = await User.findOne({ mobile: mobile });
        if (user) {
            throw new CustomError.BadRequestError("mobile number already exist")
        }
        updatedData.mobile = mobile
    }
    if (firstname) {
        updatedData.firstname = firstname
    }
    if (lastname) {
        updatedData.lastname = lastname
    }

    if (address) {
        updatedData.address = address
        }

    if (role === "seller") { 
        if (storeName) {
            updatedData.storeName = storeName
        }
        if (storeDetails) {
            updatedData.storeDetails = storeDetails
        }

    }

    const user = await User.findOneAndUpdate({ _id: id }, updatedData, {
        new: true,
        runValidators: true,
    })
    console.log(user)

    if (!user) {
        throw new CustomError.NotFoundError(`No user with this id: ${id}`)
    }

    const tokenUser = createTokenUser(user);
    const accessToken = createJWT({ payload: tokenUser, expireDate: '15m', jwtSecret: process.env.ACCESS_TOKEN_SECRET })
    res.status(StatusCodes.OK).json({ user: tokenUser, accessToken });
};

const deleteUser = async (req, res) => {
    const { userId: id } = req.params
    validateMongoDbId(id)
    const userFound = await User.findOne({ _id: id })

    if (!userFound) {
        throw new CustomError.NotFoundError(`No user with this id: ${id}`)
    }

    checkPermissions(id, userFound._id, userFound.role)

    const user = await User.findOneAndDelete({ _id: id })
    if (user.profilePicture.public_id) {

        await destroyFile(user.profilePicture.public_id)
    }
    await Cart.findOneAndDelete({ orderBy: user._id })
    res.status(200).json({ msg: "success! user deleted", user })
}

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

        res.status(StatusCodes.OK).json({ profilePicture: user.profilePicture.url })
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

