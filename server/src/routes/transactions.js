const express = require('express');
const router = express.Router();
const controller = require('../controllers/transaction.controller');

router.post('/', controller.createTransaction);
router.put('/:id', controller.updateTransaction);
router.delete('/:id', controller.deleteTransaction);
router.post('/:id/restore', controller.restoreTransaction);
router.put('/:id/reorder', controller.reorderTransaction);

module.exports = router;
