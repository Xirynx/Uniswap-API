const express = require('express');
const router = express.Router();

router.use('/v2', require('./v2'));
router.use('/v3', require('./v3'));
router.use('/address', require('./address'));
router.use('/token', require('./token'));

module.exports = router;