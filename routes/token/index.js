const express = require('express');
const router = express.Router();

router.use('/team-details', require('./team-details'));

module.exports = router;