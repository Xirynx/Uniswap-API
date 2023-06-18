const express = require('express');
const router = express.Router();

router.use('/pair-details', require('./pair-details'));

module.exports = router;