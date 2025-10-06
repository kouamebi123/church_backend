const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect, authorize } = require('../middlewares/auth');

const carouselController = require('../controllers/carouselController');

// Multer config
const storage = multer.diskStorage({
  destination (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads/carousel');
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

const upload = multer({
  storage,
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

// Routes
router.get('/', carouselController.getAllImages);
// Routes protégées (super-admin seulement)
router.post('/', protect, authorize('SUPER_ADMIN'), upload.single('image'), carouselController.addImage);
router.delete('/:id', protect, authorize('SUPER_ADMIN'), carouselController.deleteImage);

module.exports = router;
