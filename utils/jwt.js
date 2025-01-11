const jwt = require('jsonwebtoken');

const createJWT = ({ payload,expireDate,jwtSecret }) => {
  const token = jwt.sign(payload, jwtSecret, {
    expiresIn: expireDate,
  });
  return token;
};

const isTokenValid = ({ token, jwtSecret }) => jwt.verify(token,jwtSecret);

const attachCookiesToResponse = ({ res, user }) => {
  const token = createJWT({ payload: user, expireDate: process.env.JWT_LIFETIME, jwtSecret: process.env.REFRESH_TOKEN_SECRET });

  const month = 1000 * 60 * 60 * 24 * 30;
  res.cookie('token', token, {
    httpOnly: true,
    path:'/',
    secure: process.env.NODE_ENV === 'production',
    signed: true,
    sameSite: process.env.NODE_ENV === 'production'?'None':"strict",
    domain: process.env.NODE_ENV === 'production'? process.env.DOMAIN:"localhost",
    expires: new Date(Date.now() + month),

  });
  return token;
};

module.exports = {
  createJWT,
  isTokenValid,
  attachCookiesToResponse,
};
