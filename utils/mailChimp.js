const mailchimp = require("@mailchimp/mailchimp_marketing");
const InternalServerError = require("../errors/server-error");

mailchimp.setConfig({
    apiKey: process.env.MAILCHIMP_API_KEY,
    server: process.env.MAILCHIMP_SERVER_PREFIX,
});
const listId = process.env.MAILCHIMP_LIST_ID;
const addSubscriber = async (email) => {

        const response = await mailchimp.lists.addListMember(listId, {
            email_address: email,
            status: "subscribed",
        });

}

module.exports = addSubscriber