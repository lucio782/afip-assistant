const express = require('express');
const { getNoticias } = require('../services/news');
const h = require('../services/asyncHandler');

const router = express.Router();

router.get('/', h(async (req, res) => {
  const data = await getNoticias();
  const cat = req.query.categoria;
  if (cat && ['local', 'internacional', 'cripto'].includes(cat)) return res.json(data[cat] || []);
  res.json(data);
}));

module.exports = router;
