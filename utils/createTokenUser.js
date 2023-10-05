const createTokenUser = (user) => {
  // console.log({ name: `${user.firstname} ${user.lastname}`, email: user.email, role: user.role })
  return { name: `${user.firstname} ${user.lastname}`, email: user.email, role: user.role };
};

module.exports = createTokenUser;
