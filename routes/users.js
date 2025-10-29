const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  protect,
  authorize,
  authorizeAdminReadOnly,
  authorizeManagerNetworkAccess,
  authorizeUserModification
} = require('../middlewares/auth');
const { authorizeAdminOrCollecteurReseaux } = require('../middlewares/auth');
const { requireChurchAssignment } = require('../middlewares/churchValidation');

// PostgreSQL obligatoire maintenant
const userController = require('../controllers/userController');

// Configuration multer pour l'upload d'images de profil
const profileImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/profiles');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
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
    fileSize: 5 * 1024 * 1024 // 5MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'), false);
    }
  }
});

router.use(protect);



router.use(requireChurchAssignment);

// Route pour modifier son propre profil (accessible à tous les utilisateurs connectés)
router.put('/profile', userController.updateOwnProfile || ((req, res) => res.status(501).json({ success: false, message: 'Non implémenté' })));

// Routes pour l'upload et la suppression d'images de profil (accessible à tous les utilisateurs connectés)
router.post('/profile/image', profileImageUpload.single('image'), userController.uploadProfileImage || ((req, res) => res.status(501).json({ success: false, message: 'Non implémenté' })));
router.delete('/profile/image', userController.removeProfileImage || ((req, res) => res.status(501).json({ success: false, message: 'Non implémenté' })));

// Route pour uploader l'image d'un utilisateur spécifique (accessible aux admins, managers et collecteurs de réseau)
router.post('/:id/image', authorize('ADMIN', 'MANAGER', 'COLLECTEUR_RESEAUX'), authorizeUserModification, profileImageUpload.single('image'), userController.uploadUserImage || ((req, res) => res.status(501).json({ success: false, message: 'Non implémenté' })));

// Accessible à tous les utilisateurs connectés
router.get('/:id/network', userController.getUserNetwork);
router.get('/:id/session', userController.getUserSession);

// Accessible aux admins, collecteurs de réseau ET managers
router.get('/available', authorize('ADMIN', 'COLLECTEUR_RESEAUX', 'MANAGER'), userController.getAvailableUsers);

// Route pour récupérer tous les utilisateurs GOUVERNANCE (pour la gestion des églises)
router.get('/governance', userController.getGovernanceUsers);

// Routes accessibles aux admins (lecture seule) ET aux managers (lecture et écriture sur leur église)
router.get('/non-isoles', userController.getNonIsoles);
router.get('/isoles', userController.getIsoles);

router.route('/')
  .get(userController.getUsers)
  .post(authorize('ADMIN', 'MANAGER', 'COLLECTEUR_RESEAUX'), authorizeUserModification, userController.createUser);

router.get('/retired', userController.getRetiredUsers || ((req, res) => res.status(501).json({ success: false, message: 'Non implémenté' })));
router.get('/stats', userController.getUserStats);

router.route('/:id')
  .get(userController.getUser)
  .put(authorize('ADMIN', 'MANAGER', 'COLLECTEUR_RESEAUX'), authorizeUserModification, userController.updateUser)
  .delete(authorize('ADMIN', 'MANAGER', 'COLLECTEUR_RESEAUX'), userController.deleteUser);

router.put('/:id/qualification', authorize('ADMIN', 'MANAGER', 'COLLECTEUR_RESEAUX'), userController.updateQualification);
router.post('/:id/reset-password', authorize('ADMIN', 'MANAGER', 'COLLECTEUR_RESEAUX'), userController.resetPassword || ((req, res) => res.status(501).json({ success: false, message: 'Non implémenté' })));

module.exports = router;
