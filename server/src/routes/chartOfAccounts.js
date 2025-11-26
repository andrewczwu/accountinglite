const express = require('express');
const router = express.Router();
const controller = require('../controllers/account.controller');

router.get('/', controller.getChartOfAccounts);
router.post('/', controller.createChartOfAccount);
router.put('/:id', controller.updateChartOfAccount);
router.delete('/:id', controller.deleteChartOfAccount);

module.exports = router;
