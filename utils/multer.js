const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { BadRequestError, CustomAPIError } = require("../errors");
const InternalServerError = require("../errors/server-error");



const storage = multer.diskStorage({
  destination:  "../public/images/",
  filename: function (req, file, cb) {
    const uniquesuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniquesuffix + path.extname(file.originalname));
  },
});

const limits = {
  fileSize: 1024 * 1024
};

const fileFilter = (req, file, cb) => {
  if (!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|WEBP|webp)$/)) {
    req.fileValidationError = 'Only image files are allowed!';
    return cb(
      new BadRequestError('Not an image! Please upload only images'),
      false
    );
  }
  cb(null, true);
};

const uploadImage = multer({
  storage: storage,
  fileFilter: fileFilter,
  // limits,
});



const singleFile = (name) => (req, res, next) => {
  const upload = uploadImage.single(name);

  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {

console.log(err.code)
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        // throw new InternalServerError(`Cannot Upload More Than 1 Image`);
        return res.status(500).json({ msg:"Cannot Upload More Than 1 Image"})
      }
    }

    next();
  });
};
/**
 * Upload any number of images with any name
 */
const anyMulter = () => (req, res, next) => {

  console.log('hi')
  const upload =uploadImage.any();
  upload(req, res, (err) => {
    if (err) return res.status(500).json({ msg: err })

    next();
  });
};

module.exports = { singleFile ,anyMulter};
