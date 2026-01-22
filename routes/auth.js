const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../middlewares/auth');
const {
  validateRegister,
  validateLogin,
  validateUpdateProfile,
  validateUpdatePassword
} = require('../middlewares/validation');
// PostgreSQL obligatoire maintenant
const authController = require('../controllers/authController');

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
    // Vérifier le type de fichier
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers image sont autorisés'), false);
    }
  }
});

// Route d'inscription avec support d'upload d'image
router.post('/register', 
  (req, res, next) => {
    // Vérifier si c'est un upload de fichier ou des données JSON
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
      // Upload avec image
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
      // Inscription normale sans image
      next();
    }
  },
  validateRegister, 
  authController.register
);
// Route publique pour créer un responsable de GR et son groupe
router.post('/register-group-responsible',
  (req, res, next) => {
    // Vérifier si c'est un upload de fichier ou des données JSON
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
      // Upload avec image
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
      // Inscription normale sans image
      next();
    }
  },
  validateRegister,
  authController.registerGroupResponsible
);
router.post('/login', validateLogin, authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPasswordWithToken);
router.get('/me', protect, authController.getMe);
router.put('/updatedetails', protect, validateUpdateProfile, authController.updateDetails);
router.put('/updatepassword', protect, validateUpdatePassword, authController.updatePassword);

module.exports = router;
