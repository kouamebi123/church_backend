const express = require('express');
const router = express.Router();
const {
  protect,
  authorize,
  authorizeChurchAccess
} = require('../middlewares/auth');

const {
  getChurches,
  getChurch,
  createChurch,
  updateChurch,
  deleteChurch,
  getChurchStats,
  getCityInfo
} = require('../controllers/churchController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer config pour les églises
const churchStorage = multer.diskStorage({
  destination (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/churches');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename (req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const churchUpload = multer({
  storage: churchStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Le fichier doit être une image'));
    }
  },
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
});

// Routes accessibles sans authentification (pour l'inscription)
router.get('/', getChurches);
router.get('/city-info/:cityName', getCityInfo);

router.use(protect);



// Routes accessibles uniquement aux super-admins
router.post('/', authorize('SUPER_ADMIN'), churchUpload.single('image'), createChurch);
router.get('/stats', authorize('SUPER_ADMIN'), getChurchStats);

router.route('/:id')
  .put(authorize('SUPER_ADMIN'), churchUpload.single('image'), updateChurch)
  .patch(authorize('SUPER_ADMIN'), churchUpload.single('image'), updateChurch)
  .delete(authorize('SUPER_ADMIN'), deleteChurch);

module.exports = router;
