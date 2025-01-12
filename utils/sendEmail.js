const nodemailer = require('nodemailer');
const {google} = require('googleapis');

const sendEmail = async ({ to, subject, html }) => {
  const OAuth2Client = new google.auth.OAuth2(
    process.env.EMAIL_CLIENT_ID,
    process.env.EMAIL_CLIENT_SECRET,
    process.env.EMAIL_CLIENT_REDIRECT_URI
  );
  OAuth2Client.setCredentials({ refresh_token: process.env.REFRESH_TOKEN });
  try {
    const accessToken = await OAuth2Client.getAccessToken();
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
  



  const transporter = nodemailer.createTransport(nodemailerConfig);

  return transporter.sendMail({
    from: '"meroua hadj benaichouche" <meroua.hadjbenaichouche@gmail.com>', // sender address
    to,
    subject,
    html,
  },  (error, info) =>{
    if (error) {
      console.log("Email not sent");
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
  } catch (err) {
    console.log(err)
  }
};

module.exports = sendEmail;
