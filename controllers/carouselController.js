const { handleError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

// Récupérer toutes les images du carousel
exports.getAllImages = async (req, res) => {
  try {
    const { prisma } = req;

    const images = await prisma.carouselImage.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      success: true,
      data: images
    });
  } catch (error) {
    logger.error('Carousel - getAllImages - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération des images du carousel');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Ajouter une nouvelle image au carousel (super-admin seulement)
exports.addImage = async (req, res) => {
  try {
    const { prisma } = req;

    logger.info('addImage - Fichier reçu', req.file);
    logger.info('addImage - Body reçu', req.body);

    // Vérifier si un fichier a été uploadé
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Aucun fichier image n\'a été fourni'
      });
    }

    // Générer automatiquement le titre et l'URL
    const titre = req.body.titre || req.file.originalname || 'Image du carousel';
    const image_url = `/uploads/carousel/${req.file.filename}`;

    // Déterminer l'ordre automatiquement si non fourni
    let imageOrder = req.body.ordre;
    if (!imageOrder) {
      const lastImage = await prisma.carouselImage.findFirst({
        orderBy: {
          ordre: 'desc'
        }
      });
      imageOrder = lastImage ? lastImage.ordre + 1 : 1;
    }

    logger.info('addImage - Données à insérer', { titre, image_url, ordre: imageOrder });

    // Créer l'image
    const image = await prisma.carouselImage.create({
      data: {
        titre,
        description: req.body.description || null,
        image_url,
        ordre: imageOrder,
        active: req.body.active !== undefined ? req.body.active : true
      }
    });

    logger.info('addImage - Image créée avec succès', image);

    res.status(201).json({
      success: true,
      data: image
    });
  } catch (error) {
    logger.error('Carousel - addImage - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'l\'ajout de l\'image au carousel');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Supprimer une image du carousel (super-admin seulement)
exports.deleteImage = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    // Vérifier si l'image existe
    const existingImage = await prisma.carouselImage.findUnique({
      where: { id }
    });

    if (!existingImage) {
      return res.status(404).json({
        success: false,
        message: 'Image non trouvée'
      });
    }

    // Supprimer l'image
    await prisma.carouselImage.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Image supprimée avec succès'
    });
  } catch (error) {
    logger.error('Carousel - deleteImage - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la suppression de l\'image du carousel');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Mettre à jour une image du carousel (super-admin seulement)
exports.updateImage = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;
    const updateData = req.body;

    // Vérifier si l'image existe
    const existingImage = await prisma.carouselImage.findUnique({
      where: { id }
    });

    if (!existingImage) {
      return res.status(404).json({
        success: false,
        message: 'Image non trouvée'
      });
    }

    // Mettre à jour l'image
    const updatedImage = await prisma.carouselImage.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      data: updatedImage
    });
  } catch (error) {
    logger.error('Carousel - updateImage - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la mise à jour de l\'image du carousel');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Réorganiser l'ordre des images (super-admin seulement)
exports.reorderImages = async (req, res) => {
  try {
    const { prisma } = req;
    const { imageOrders } = req.body; // Array of {id, ordre}

    if (!Array.isArray(imageOrders) || imageOrders.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'La liste des ordres d\'images est requise'
      });
    }

    // Mettre à jour l'ordre de chaque image
    const updatePromises = imageOrders.map(({ id, ordre }) =>
      prisma.carouselImage.update({
        where: { id },
        data: { ordre }
      })
    );

    await Promise.all(updatePromises);

    // Récupérer les images mises à jour
    const updatedImages = await prisma.carouselImage.findMany({
      orderBy: {
        ordre: 'asc'
      }
    });

    res.json({
      success: true,
      message: 'Ordre des images mis à jour avec succès',
      data: updatedImages
    });
  } catch (error) {
    logger.error('Carousel - reorderImages - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la réorganisation des images du carousel');

    res.status(status).json({
      success: false,
      message
    });
  }
};
