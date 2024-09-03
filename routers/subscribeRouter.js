const express = require('express')
const subscribeToNewsLetter = require('../controllers/subscribeController')
const router = express.Router()

router.post('/subscribe', subscribeToNewsLetter)


module.exports = router