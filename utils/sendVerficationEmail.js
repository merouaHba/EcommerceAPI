const sendEmail = require('./sendEmail');

const sendVerificationEmail = async ({
  name,
  email,
  verificationToken,
  origin,
}) => {
    const verificationUrl = `${origin}/email-verification?token=${verificationToken}`;
  const message = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="x-apple-disable-message-reformatting">
    <title>Reset Your Password</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            background-color: #f6f9fc;
            color: #333333;
            margin: 0;
            padding: 0;
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }

        .email-container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }

        .header {
            background-color: #4F46E5;
            padding: 30px 0;
            text-align: center;
        }

        .header img {
            width: 120px;
            height: auto;
        }

        .content {
            padding: 40px 30px;
            background-color: #ffffff;
        }

        .content h1 {
            color: #1f2937;
            font-size: 24px;
            margin-bottom: 20px;
            text-align: center;
        }

        .content p {
            color: #4b5563;
            margin-bottom: 20px;
            font-size: 16px;
        }

        .button-container {
            text-align: center;
            margin: 30px 0;
        }

        .reset-button {
            display: inline-block;
            padding: 14px 32px;
            background-color: #4F46E5;
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
        }

        .security-box {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 20px;
            margin: 30px 0;
        }

        .link-display {
            background-color: #f8fafc;
            padding: 15px;
            border-radius: 6px;
            word-break: break-all;
            margin: 20px 0;
            font-size: 14px;
            color: #4b5563;
        }

        .footer {
            background-color: #f8fafc;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }

        .footer p {
            color: #64748b;
            font-size: 12px;
            margin: 5px 0;
        }

        @media only screen and (max-width: 600px) {
            .email-container {
                margin: 20px;
            }
            .content {
                padding: 30px 20px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <img src="cid:company-logo" alt="Company Logo">
        </div>
        
        <div class="content">
            <h1>Reset Your Password</h1>
            
            <p>Hello ${name},</p>
            

            <div class="button-container">
                <a href="${verificationUrl}" class="reset-button">Reset Password</a>
            </div>

                         <p>This verification link will expire in 24 hours. If you didn't create an account, please ignore this email.</p>
      
      <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
     
            <div class="link-display">
                ${verificationUrl}
            </div>
        </div>

        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Company Name. All rights reserved.</p>
            <p>This is an automated message, please do not reply.</p>
        </div>
    </div>
</body>
</html>`;

  return sendEmail({
    to: email,
    subject: 'Email Confirmation',
    html: `<h4> Hello, ${name}</h4>
    ${message}
    `,
  });
};

module.exports = sendVerificationEmail;
