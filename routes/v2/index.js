const express = require('express');
const router = express.Router();

router.use('/pair-details', require('./pair-details'));
router.use('/quote', require('./quote'));

module.exports = router;