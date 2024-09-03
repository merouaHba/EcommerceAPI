const CustomError = require('../errors');

const checkPermissions = (id,userId,userRole) => {
  console.log(typeof userId ,typeof id)
  if (userRole === 'admin') return;
  if (userId.toString() === id.toString()) return;
  throw new CustomError.UnauthorizedError(
    'Not authorized to access this route'
  );
};

module.exports = checkPermissions;
