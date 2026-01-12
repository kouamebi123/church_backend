const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
  protect,
  authorize
} = require('../middlewares/auth');
const {
  generateInvitationLink,
  validateInvitationLink,
  registerNetworkViaLink,
  listInvitationLinks
} = require('../controllers/networkInvitationController');

// Configuration multer pour l'upload d'images de profil
const profileImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/profiles/');
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const fileName = `profile_${timestamp}_${file.originalname}`;
    cb(null, fileName);
  }
});

const profileImageUpload = multer({
  storage: profileImageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers image sont autorisés'), false);
    }
  }
});

// Route publique pour valider un lien
router.get('/validate/:token', validateInvitationLink);

// Route publique pour créer un réseau via lien (avec support d'upload d'image)
router.post('/register/:token',
  (req, res, next) => {
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
      profileImageUpload.single('image')(req, res, (err) => {
        if (err) {
          return res.status(400).json({
            success: false,
            message: err.message
          });
        }
        next();
      });
    } else {
      next();
    }
  },
  registerNetworkViaLink
);

// Routes protégées (admin seulement)
router.use(protect);
router.use(authorize('ADMIN', 'SUPER_ADMIN'));

// Générer un lien d'invitation
router.post('/generate', generateInvitationLink);

// Lister les liens d'invitation
router.get('/list', listInvitationLinks);

module.exports = router;
