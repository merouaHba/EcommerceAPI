const cron = require('node-cron');





const sheduledFunction =(time,callback ) => {
    cron.schedule(time, callback);
}
module.exports = sheduledFunction