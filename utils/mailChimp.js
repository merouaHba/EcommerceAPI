const mailchimp = require("@mailchimp/mailchimp_marketing");
const { CustomAPIError } = require("../errors");
const InternalServerError = require("../errors/server-error");

mailchimp.setConfig({
    apiKey: process.env.MAILCHIMP_API_KEY,
    server: process.env.MAILCHIMP_SERVER_PREFIX,
});
const listId = process.env.MAILCHIMP_LIST_ID;
const addSubscriber = async (email) => {
    // try {
        
        const response = await mailchimp.lists.addListMember(listId, {
            email_address: email,
            status: "subscribed",
        });
    console.log(response)
       return response
    // } catch (err) {
    //     throw new InternalServerError('Failed to subscribe to the newsletter')
    // }
    // const response = await mailchimp.lists.getAllLists()
    // console.log(response)

}

module.exports = addSubscriber