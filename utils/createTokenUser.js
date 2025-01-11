const createTokenUser = (user) => {
  // console.log({ name: `${user.firstname} ${user.lastname}`, email: user.email, role: user.role })
  return { _id:user._id, name: `${user.firstname} ${user.lastname}`, email: user.email, role: user.role , profilePicture: user.profilePicture?.url, mobile: user.mobile };
};

module.exports = createTokenUser;
