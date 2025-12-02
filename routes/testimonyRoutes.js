const express = require('express');
const router = express.Router();
const testimonyController = require('../controllers/testimonyController');
const { protect } = require('../middlewares/auth');

// Routes publiques (accessibles sans authentification)
router.get('/churches', testimonyController.getChurches);
router.get('/networks/:churchId', testimonyController.getNetworksByChurch);
router.get('/sections/:churchId', testimonyController.getSectionsByChurch);
router.get('/categories', testimonyController.getTestimonyCategories);
router.get('/approved', testimonyController.getApprovedTestimonies);

// Route pour créer un témoignage (publique) - AVANT l'application du middleware protect
router.post('/', 
  (req, res, next) => {
    testimonyController.uploadTestimonyFiles(req, res, (err) => {
      if (err) {
        console.error('Erreur multer:', err);
        
        // Messages d'erreur précis selon le type d'erreur
        let message = 'Erreur lors de l\'upload du fichier';
        
        if (err.code === 'LIMIT_FILE_SIZE') {
          message = 'Fichier trop volumineux. Taille maximale autorisée : 10 MB par fichier.';
        } else if (err.code === 'LIMIT_FILE_COUNT') {
          message = 'Trop de fichiers. Maximum autorisé : 2 illustrations + 1 fichier audio par témoignage.';
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          message = 'Champ de fichier inattendu. Utilisez les champs "illustrations" ou "audioFile".';
        } else if (err.message && err.message.includes('Type de fichier non autorisé')) {
          message = 'Type de fichier non autorisé. Formats acceptés : images (jpg, png, gif), vidéos (mp4, avi, mov), documents (pdf, doc, docx, txt), fichiers audio (mp3, wav, ogg, m4a, webm).';
        } else if (err.message) {
          message = err.message;
        }
        
        return res.status(400).json({
          success: false,
          message: message
        });
      }
      next();
    });
  },
  testimonyController.createTestimony
);

// Appliquer l'authentification à toutes les routes admin
router.use(protect);

// Routes pour l'admin (nécessitent une authentification) - AVANT les routes avec paramètres
router.get('/admin/all', testimonyController.getAllTestimonies);

// Route avec paramètre à la fin pour éviter les conflits
router.get('/:id', testimonyController.getTestimonyById);

// Routes pour l'admin (nécessitent une authentification)
router.delete('/:id', testimonyController.deleteTestimony);
router.put('/:id/mark-read', testimonyController.markAsRead);
router.put('/:id/note', testimonyController.addNote);

// Routes pour la gestion des témoignages de culte
router.get('/admin/culte/:churchId', testimonyController.getTestimoniesForCulte);
router.put('/:id/confirm-culte', testimonyController.confirmTestimonyForCulte);
router.put('/:id/mark-testified', testimonyController.markAsTestified);

module.exports = router;
