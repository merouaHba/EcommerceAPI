const express = require('express')
const { getFavourites, addFavourite, deleteFavourite } = require('../controllers/favouriteController')
const router = express.Router()
const { authenticateUser, authorizePermissions } = require('../middlewares/authentication')

router.get('/', authenticateUser, authorizePermissions('user'), getFavourites)
router.post('/', authenticateUser, authorizePermissions('user'), addFavourite)
router.delete('/:id', authenticateUser, authorizePermissions('user'), deleteFavourite)



module.exports = router