const User = require('../models/userModel');
const { StatusCodes } = require('http-status-codes');
const {
    createTokenUser,
    attachCookiesToResponse,
    checkPermissions
} = require('../utils');

const {uploadFile,destroyFile} = require('../utils/cloudinary')
const  CustomError = require('../errors');
const validateMongoDbId = require('../utils/validateMongodbId');



const createUser = async (req, res) => {
    const {email, mobile} = req.body;
    

    const findUserByEmail = await User.findOne({ email: email });
    const findUserByMobile = await User.findOne({ mobile: mobile });

    console.log(!findUserByEmail && !findUserByMobile)

    if (!findUserByEmail && !findUserByMobile) {


        const verificationToken = "";
        console.log(req.body)
        const user = await User.create({ ...req.body, verificationToken, isVerified: true })
        // send verification token back only while testing in postman!!!
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
    const user = await User.findOne({ _id: id }).select('-password');
    if (!user) {
        throw new CustomError.NotFoundError(`No user with id : ${id}`);
    }
    res.status(StatusCodes.OK).json({ user });
};

// update user with user.save()
const updateUser = async (req, res) => {
    const id = req.params.userId;
    if (Array.from(req.body).length === 0) {
        throw new CustomError.BadRequestError("no updated data")
    }
    
    const user = await User.findOneAndUpdate({ _id: id }, req.body, {
        new: true,
        runValidators: true,
    })
    console.log(user)

    if (!user) {
        throw new CustomError.NotFoundError(`No user with this id: ${id}`)
    }

    const tokenUser = createTokenUser(user);
    attachCookiesToResponse({ res, user: tokenUser });
    res.status(StatusCodes.OK).json({ user: tokenUser });
};

const deleteUser = async (req, res) => {
    const { userId: id } = req.params
    validateMongoDbId(id)
    const userFound = await User.findOne({ _id: id })

    if (!userFound) {
        throw new CustomError.NotFoundError(`No user with this id: ${id}`)
    }
     
    checkPermissions(id, userFound._id,userFound.role)

    const user = await User.findOneAndDelete({ _id: id })
    if (user.profilePicture.public_id) {
        
        await destroyFile(user.profilePicture.public_id)
    }
    await Cart.findOneAndDelete({orderBy:user._id})
    res.status(200).json({ msg:"success! user deleted",user })
}

const uploadProfileImage = async (req, res) => {
    const { userId: id } = req.params;
    validateMongoDbId(id)
    const user = await User.findOne({ _id: id });
    console.log(!req.file)
    if (!req.file) {
        throw new CustomError.NotFoundError("No file found, please upload file")
    }
    const result = await uploadFile(req.file.path, "users");

    if (user.profilePicture.url) {
      await  destroyFile(user.profilePicture.public_id)
    }
    console.log("top")
    user.profilePicture = {
        public_id: result.public_id,
        url: result.secure_url
    }
    console.log(user)
    user.save();
    console.log(user)

    res.status(StatusCodes.OK).json({msg:"image uploaded"})
}
const deleteProfileImage = async (req, res) => {
    const { userId: id } = req.params;
    validateMongoDbId(id)
    const user = await User.findOne({ _id: id });
    if (!user) {
        throw new CustomError.NotFoundError(`No user with this id: ${id}`)
    }
    if (user.profilePicture.url) {
      await  destroyFile(user.profilePicture.public_id)
      user.profilePicture = {
          public_id: "",
          url: ""
      }
  
      user.save();
  
      res.status(StatusCodes.OK).json({msg:"image deleted"})
    } else {
        
        throw new CustomError.NotFoundError(`Profile image not found`)

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

