
const isPastTenDays = (date) => {
    if (date) {
       
        const currentDate = new Date();
        const tenDaysAgo = new Date()
        tenDaysAgo.setDate(date.getDate() - 10)
        console.log(tenDaysAgo, date)
    
    
        console.log( date < tenDaysAgo)
        return currentDate < date
    }
    return false
}

module.exports = isPastTenDays