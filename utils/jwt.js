const jwt = require('jsonwebtoken');

const createJWT = ({ payload,expireDate,jwtSecret }) => {
  const token = jwt.sign(payload, jwtSecret, {
    expiresIn: expireDate,
  });
  return token;
};

const isTokenValid = ({ token, jwtSecret }) => jwt.verify(token,jwtSecret);

const attachCookiesToResponse = ({ res, rememberMe, user }) => {
  const token = createJWT({ payload: user, expireDate: rememberMe?'30d':'24h', jwtSecret: process.env.REFRESH_TOKEN_SECRET });

  const expireTime = rememberMe ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 24;
  res.cookie('token', token, {
    httpOnly: true,
    path:'/',
    secure: process.env.NODE_ENV === 'production',
    signed: true,
    sameSite: process.env.NODE_ENV === 'production'?'lax':"strict",
    maxAge: expireTime,

  });
  return token;
};

module.exports = {
  createJWT,
  isTokenValid,
  attachCookiesToResponse,
};
