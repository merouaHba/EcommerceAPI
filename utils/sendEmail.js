const nodemailer = require('nodemailer');
const {google} = require('googleapis');

// const nodemailerConfig = require('./nodemailerConfig');
const sendEmail = async ({ to, subject, html }) => {
  // console.log(google.auth)
  const OAuth2Client = new google.auth.OAuth2(
    process.env.EMAIL_CLIENT_ID,
    process.env.EMAIL_CLIENT_SECRET,
    process.env.EMAIL_CLIENT_REDIRECT_URI
  );
// console.log("",OAuth2Client)
  OAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
  try {
    // Generate the accessToken on the fly
    const accessToken = await OAuth2Client.getAccessToken();
    // console.log(accessToken)
    const nodemailerConfig = {
      service: "gmail",
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      tls: {
        rejectUnauthorized: false
      },
      auth: {
        type: 'OAuth2',
        user: process.env.FROM_EMAIL,
        clientId: process.env.EMAIL_CLIENT_ID,
        clientSecret: process.env.EMAIL_CLIENT_SECRET,
        refreshToken: process.env.REFRESH_TOKEN,
        accessToken: accessToken
      }
    }
  


  // console.log(nodemailerConfig)

  const transporter = nodemailer.createTransport(nodemailerConfig);

  return transporter.sendMail({
    from: '"maroua hba" <marouahba31@gmail.com>', // sender address
    to,
    subject,
    html,
  },  (error, info) =>{
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
      // do something useful
    }
  });
  } catch (err) {
    console.log(err)
  }
};

module.exports = sendEmail;
