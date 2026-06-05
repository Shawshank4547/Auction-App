const express = require('express');
const { body } = require('express-validator');
const router = express.Router({ mergeParams: true });
const bidController = require('../controllers/bidController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.post('/',
  authenticate, authorize('bidder', 'organizer', 'super_admin'),
  [
    body('auctionItemId').notEmpty(),
    body('teamId').notEmpty(),
    body('amount').isInt({ min: 1 }),
  ], validate,
  bidController.placeBid
);
router.post('/tiebreak',
  authenticate,
  [body('tieBreakRoundId').notEmpty(), body('teamId').notEmpty(), body('amount').isInt({ min: 1 })], validate,
  bidController.submitTieBreakBid
);
router.post('/tiebreak/close',
  authenticate, authorize('organizer', 'super_admin'),
  [body('tieBreakRoundId').notEmpty(), body('auctionItemId').notEmpty()], validate,
  bidController.closeTieBreakRound
);
router.get('/', authenticate, bidController.getBidHistory);

module.exports = router;
