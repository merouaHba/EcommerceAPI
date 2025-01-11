const createTokenUser = (user) => {
  if (user.role === "seller") {
    return { _id: user._id, name: `${user.firstname} ${user.lastname}`, firstname: user.firstname, lastname: user.lastname, email: user.email, role: user.role , profilePicture: user.profilePicture?.url, mobile: user.mobile ,address: user.address, storeName: user.storeName, storeDetails: user.storeDetails };
    
  }
  return { _id:user._id, name: `${user.firstname} ${user.lastname}`,firstname: user.firstname, lastname: user.lastname, email: user.email, role: user.role , profilePicture: user.profilePicture?.url, mobile: user.mobile ,address: user.address, };
};

module.exports = createTokenUser;
