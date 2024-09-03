const sendEmail = require('./sendEmail');

const sendVerificationEmail = async ({
  name,
  email,
  verificationToken,
  origin,
}) => {
  console.log(name)
  const verificationUrl = `${origin}/user/verify-email/${verificationToken}`;

  const message = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }

    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .header {
      text-align: center;
      padding: 10px 0;
      border-bottom: 1px solid #dddddd;
    }

    .header img {
      width: 100px;
      margin-bottom: 20px;
    }

    .content {
      padding: 20px;
      color: #333333;
      line-height: 1.6;
    }

    .content h1 {
      font-size: 24px;
      margin-bottom: 10px;
    }

    .content p {
      margin-bottom: 20px;
    }

    .content a.button {
     margin-bottom: 20px;
      display: inline-block;
      background-color: #28a745;
      color: #ffffff;
      padding: 10px 20px;
      text-decoration: none;
      border-radius: 5px;
      font-size: 16px;
    }
    .content a.button:hover {
      background-color: #218838;
    }

    .footer {
      text-align: center;
      padding: 10px 0;
      border-top: 1px solid #dddddd;
      margin-top: 20px;
      font-size: 12px;
      color: #777777;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <img src="https://example.com/logo.png" alt="Company Logo">
    </div>
    <div class="content">
      <h1>Verify Your Email Address</h1>
      <p>Hello,</p>
      <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
     <a href="${{verificationUrl}}" class="button">Verify Email</a>
      <p>If the button above doesn't work, copy and paste this link into your browser:</p>
      <a href="${{verificationUrl}}">${{verificationUrl}}</a>
    </div>
    <div class="footer">
      <p>&copy; 2024 meroua. All rights reserved.</p>
      <p>1234 Street Name, City, State, 56789</p>
    </div>
  </div>
</body>
</html>
`;

  return sendEmail({
    to: email,
    subject: 'Email Confirmation',
    html: `<h4> Hello, ${name}</h4>
    ${message}
    `,
  });
};

module.exports = sendVerificationEmail;
