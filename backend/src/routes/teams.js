const express = require('express');
const { body } = require('express-validator');
const router = express.Router({ mergeParams: true });
const teamController = require('../controllers/teamController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { upload, handleUploadError } = require('../middleware/upload');

router.post('/',
  authenticate, authorize('organizer', 'super_admin'),
  upload.single('logo'), handleUploadError,
  [body('name').trim().notEmpty(), body('totalBudget').isInt({ min: 1 })], validate,
  teamController.createTeam
);
router.get('/', authenticate, teamController.getTeams);
router.get('/:teamId', authenticate, teamController.getTeam);
router.get('/:teamId/bids', authenticate, teamController.getTeamBids);
router.patch('/:teamId',
  authenticate, authorize('organizer', 'super_admin'),
  upload.single('logo'), handleUploadError,
  teamController.updateTeam
);
router.delete('/:teamId', authenticate, authorize('organizer', 'super_admin'), teamController.deleteTeam);

module.exports = router;
