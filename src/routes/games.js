const { Router } = require('express');
const gameController = require('../controllers/gameController');

const router = Router();

router.get('/', gameController.list);
router.get('/:slug', gameController.detail);

module.exports = router;
