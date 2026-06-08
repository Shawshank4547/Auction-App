const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const auctionController = require('../controllers/auctionController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.post('/',
  authenticate, authorize('organizer', 'super_admin'),
  [body('name').trim().notEmpty()], validate,
  auctionController.createAuction
);
router.get('/', authenticate, auctionController.getAuctions);
router.get('/:id', authenticate, auctionController.getAuction);
router.get('/:id/state', authenticate, auctionController.getAuctionState);
router.get('/:id/items', authenticate, auctionController.getAuctionItems);
router.patch('/:id', authenticate, authorize('organizer', 'super_admin'), auctionController.updateAuction);
router.post('/:id/start', authenticate, authorize('organizer', 'super_admin'), auctionController.startAuction);
router.post('/:id/pause', authenticate, authorize('organizer', 'super_admin'), auctionController.pauseAuction);
router.post('/:id/resume', authenticate, authorize('organizer', 'super_admin'), auctionController.resumeAuction);
router.post('/:id/end', authenticate, authorize('organizer', 'super_admin'), auctionController.endAuction);  // NEW
router.post('/:id/next-player',
  authenticate, authorize('organizer', 'super_admin'),
  [body('auctionItemId').notEmpty()], validate,
  auctionController.nextPlayer
);
router.post('/:id/participants',
  authenticate, authorize('organizer', 'super_admin'),
  [body('userId').notEmpty()], validate,
  auctionController.addParticipant
);

module.exports = router;