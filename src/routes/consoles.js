const { Router } = require('express');
const consoleController = require('../controllers/consoleController');

const router = Router();

router.get('/', consoleController.list);
router.get('/:slug', consoleController.detail);

module.exports = router;
