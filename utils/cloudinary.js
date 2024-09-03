const cloudinary = require("cloudinary");

// Setting The Cloudinary Configurations
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY,
});

const destroyFile = (PublicID) =>
  cloudinary.v2.uploader.destroy(PublicID, (err, des) => des).catch((error) => {
    console.log(error);
  });;

const uploadFile = (file, folderName) =>
  cloudinary.v2.uploader.upload(file, {
    folder: `${process.env.CLOUDINARY_FOLDER}/${folderName}`,
    crop: 'fit',
    format: 'webp'
  }).catch((error) => {
    console.log(error);
  });;
module.exports = {
  uploadFile,
  destroyFile
}