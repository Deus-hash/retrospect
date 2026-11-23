const { Router } = require('express');
const accessoryController = require('../controllers/accessoryController');

const router = Router();

router.get('/', accessoryController.list);
router.get('/:slug', accessoryController.detail);

module.exports = router;
