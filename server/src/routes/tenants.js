const express = require('express');
const router = express.Router();
const controller = require('../controllers/tenant.controller');

router.get('/', controller.getTenants);
router.post('/', controller.createTenant);
router.post('/:id/users', controller.addUserToTenant);

module.exports = router;
