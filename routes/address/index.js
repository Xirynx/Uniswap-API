const express = require('express');
const router = express.Router();

router.use('/funding', require('./funding'));

module.exports = router;