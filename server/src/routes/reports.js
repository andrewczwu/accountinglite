const express = require('express');
const router = express.Router();
const controller = require('../controllers/report.controller');

router.get('/balance-sheet', controller.getBalanceSheet);
router.get('/profit-loss', controller.getProfitLoss);

module.exports = router;
