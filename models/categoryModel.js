const mongoose = require('mongoose')


const CategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        public_id: {
            type: String,
            required:[true,'please provide image id']
        },
        url: {
            type: String,
            required:[true,'please provide image url']
        }
    },
  
});

CategorySchema.index({ name: 'text', description: 'text' })


module.exports = mongoose.model('Category', CategorySchema)