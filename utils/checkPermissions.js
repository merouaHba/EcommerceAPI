const CustomError = require('../errors');

const checkPermissions = (id,userId,userRole) => {

  if (userRole === 'admin') return;
  if (userId.toString() === id) return;
  throw new CustomError.UnauthorizedError(
    'Not authorized to access this route'
  );
};

module.exports = checkPermissions;
