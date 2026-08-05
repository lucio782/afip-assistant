const express = require('express');
const { getNoticias } = require('../services/news');
const h = require('../services/asyncHandler');

const router = express.Router();

router.get('/', h(async (req, res) => {
  res.json(await getNoticias());
}));

module.exports = router;
