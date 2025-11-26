const express = require('express');
const router = express.Router();
const controller = require('../controllers/account.controller');
const transactionController = require('../controllers/transaction.controller');

// Accounts
router.get('/', controller.getAccounts);
router.get('/:id', controller.getAccount);
router.post('/', controller.createAccount);
router.delete('/:id', controller.deleteAccount);

// Transactions for Account
router.get('/:id/transactions', transactionController.getTransactions);

module.exports = router;
