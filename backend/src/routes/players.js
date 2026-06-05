const express = require('express');
const { body } = require('express-validator');
const router = express.Router({ mergeParams: true });
const playerController = require('../controllers/playerController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { upload, handleUploadError } = require('../middleware/upload');

router.post('/',
  authenticate, authorize('organizer', 'super_admin'),
  upload.single('photo'), handleUploadError,
  [body('name').trim().notEmpty(), body('basePrice').isInt({ min: 0 })], validate,
  playerController.createPlayer
);
router.post('/bulk',
  authenticate, authorize('organizer', 'super_admin'),
  [body('players').isArray({ min: 1 })], validate,
  playerController.bulkCreatePlayers
);
router.post('/schedule',
  authenticate, authorize('organizer', 'super_admin'),
  [body('playerIds').isArray({ min: 1 })], validate,
  playerController.schedulePlayersForAuction
);
router.get('/', authenticate, playerController.getPlayers);
router.get('/:playerId', authenticate, playerController.getPlayer);
router.patch('/:playerId',
  authenticate, authorize('organizer', 'super_admin'),
  upload.single('photo'), handleUploadError,
  playerController.updatePlayer
);
router.delete('/:playerId', authenticate, authorize('organizer', 'super_admin'), playerController.deletePlayer);

module.exports = router;
