const mongoose = require('mongoose');


const connectDatabase = (url) => {
    mongoose.set("strictQuery", false);
    mongoose.connect(url, {
        useNewUrlParser: true,
    }).then(()=>console.log("db"))
}

module.exports = connectDatabase;