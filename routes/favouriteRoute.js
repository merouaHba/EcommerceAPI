const express = require('express');
const {
    getFavourites,
    addFavourite,
    deleteFavourite
} = require('../controllers/favouriteController');
const router = express.Router();
const {
    authenticateUser,
    authorizePermissions
} = require('../middlewares/authentication');


router
    .route('/')
    .get(
        authenticateUser,
        authorizePermissions('user'),
        getFavourites
    )
    .post(
        authenticateUser,
        authorizePermissions('user'),
        addFavourite
    );

router
    .route('/:id')
    .delete(
        authenticateUser,
        authorizePermissions('user'),
        deleteFavourite
    );

module.exports = router;