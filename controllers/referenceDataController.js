const { handleError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

// Contrôleur générique pour les données de référence
// Utilisé pour: Speaker, ServiceType, TestimonyCategoryConfig, EventTypeConfig

// Mapping des noms de modèles Prisma
// Prisma convertit automatiquement les noms de modèles PascalCase en camelCase
// Ex: model Speaker -> prisma.speaker, model ServiceType -> prisma.serviceType
const getPrismaModel = (prisma, modelName) => {
  // Les noms sont déjà en camelCase dans notre cas
  return prisma[modelName];
};

// Récupérer tous les éléments d'un type de référence
const getAll = (modelName) => async (req, res) => {
  try {
    const { prisma } = req;
    const model = getPrismaModel(prisma, modelName);

    if (!model) {
      return res.status(500).json({
        success: false,
        message: `Modèle ${modelName} non trouvé`
      });
    }

    const items = await model.findMany({
      where: {
        active: true
      },
      orderBy: {
        nom: 'asc'
      }
    });

    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    logger.error(`${modelName} - getAll - Erreur complète`, error);
    const { status, message } = handleError(error, `la récupération des ${modelName}`);
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Récupérer tous les éléments (y compris inactifs) - pour l'admin
const getAllIncludingInactive = (modelName) => async (req, res) => {
  try {
    const { prisma } = req;
    const model = getPrismaModel(prisma, modelName);

    if (!model) {
      return res.status(500).json({
        success: false,
        message: `Modèle ${modelName} non trouvé`
      });
    }

    const items = await model.findMany({
      orderBy: {
        nom: 'asc'
      }
    });

    res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (error) {
    logger.error(`${modelName} - getAllIncludingInactive - Erreur complète`, error);
    const { status, message } = handleError(error, `la récupération des ${modelName}`);
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Récupérer un élément par ID
const getById = (modelName) => async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;
    const model = getPrismaModel(prisma, modelName);

    if (!model) {
      return res.status(500).json({
        success: false,
        message: `Modèle ${modelName} non trouvé`
      });
    }

    const item = await model.findUnique({
      where: { id }
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `${modelName} non trouvé`
      });
    }

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    logger.error(`${modelName} - getById - Erreur complète`, error);
    const { status, message } = handleError(error, `la récupération du ${modelName}`);
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Créer un nouvel élément
const create = (modelName, displayName) => async (req, res) => {
  try {
    const { prisma } = req;
    const { nom, description, code, active } = req.body;

    if (!nom) {
      return res.status(400).json({
        success: false,
        message: 'Le nom est requis'
      });
    }

    const model = getPrismaModel(prisma, modelName);
    if (!model) {
      return res.status(500).json({
        success: false,
        message: `Modèle ${modelName} non trouvé`
      });
    }

    // Vérifier si un élément avec le même nom existe déjà
    const existing = await model.findUnique({
      where: { nom }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Un ${displayName} avec ce nom existe déjà`
      });
    }

    // Vérifier si un élément avec le même code existe déjà (si code est requis)
    if (code) {
      const existingByCode = await model.findUnique({
        where: { code }
      });

      if (existingByCode) {
        return res.status(400).json({
          success: false,
          message: `Un ${displayName} avec ce code existe déjà`
        });
      }
    }

    const data = {
      nom,
      description: description || null,
      active: active !== undefined ? active : true
    };

    if (code) {
      data.code = code;
    }

    const item = await model.create({
      data
    });

    res.status(201).json({
      success: true,
      data: item
    });
  } catch (error) {
    logger.error(`${modelName} - create - Erreur complète`, error);
    const { status, message } = handleError(error, `la création du ${displayName}`);
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Mettre à jour un élément
const update = (modelName, displayName) => async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;
    const { nom, description, code, active } = req.body;

    // Vérifier si l'élément existe
    const existing = await prisma[modelName].findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `${displayName} non trouvé`
      });
    }

    // Vérifier si un autre élément avec le même nom existe
    if (nom && nom !== existing.nom) {
      const duplicate = await model.findUnique({
        where: { nom }
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: `Un ${displayName} avec ce nom existe déjà`
        });
      }
    }

    // Vérifier si un autre élément avec le même code existe (si code est requis)
    if (code && code !== existing.code) {
      const duplicateByCode = await model.findUnique({
        where: { code }
      });

      if (duplicateByCode) {
        return res.status(400).json({
          success: false,
          message: `Un ${displayName} avec ce code existe déjà`
        });
      }
    }

    const updateData = {};
    if (nom !== undefined) updateData.nom = nom;
    if (description !== undefined) updateData.description = description;
    if (active !== undefined) updateData.active = active;
    if (code !== undefined) updateData.code = code;

    const item = await model.update({
      where: { id },
      data: updateData
    });

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    logger.error(`${modelName} - update - Erreur complète`, error);
    const { status, message } = handleError(error, `la mise à jour du ${displayName}`);
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Supprimer un élément
const remove = (modelName, displayName) => async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    // Vérifier si l'élément existe
    const existing = await prisma[modelName].findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: `${displayName} non trouvé`
      });
    }

    // Vérifier s'il est utilisé (dépend du modèle)
    // Pour l'instant, on désactive au lieu de supprimer
    await model.update({
      where: { id },
      data: { active: false }
    });

    res.status(200).json({
      success: true,
      message: `${displayName} désactivé avec succès`
    });
  } catch (error) {
    logger.error(`${modelName} - remove - Erreur complète`, error);
    const { status, message } = handleError(error, `la suppression du ${displayName}`);
    res.status(status).json({
      success: false,
      message
    });
  }
};

// Contrôleurs pour Speaker
exports.getSpeakers = getAll('speaker');
exports.getSpeakersAll = getAllIncludingInactive('speaker');
exports.getSpeaker = getById('speaker');
exports.createSpeaker = create('speaker', 'orateur');
exports.updateSpeaker = update('speaker', 'orateur');
exports.deleteSpeaker = remove('speaker', 'orateur');

// Contrôleurs pour ServiceType
exports.getServiceTypes = getAll('serviceType');
exports.getServiceTypesAll = getAllIncludingInactive('serviceType');
exports.getServiceType = getById('serviceType');
exports.createServiceType = create('serviceType', 'type de culte');
exports.updateServiceType = update('serviceType', 'type de culte');
exports.deleteServiceType = remove('serviceType', 'type de culte');

// Contrôleurs pour TestimonyCategoryConfig
exports.getTestimonyCategories = getAll('testimonyCategoryConfig');
exports.getTestimonyCategoriesAll = getAllIncludingInactive('testimonyCategoryConfig');
exports.getTestimonyCategory = getById('testimonyCategoryConfig');
exports.createTestimonyCategory = create('testimonyCategoryConfig', 'catégorie de témoignage');
exports.updateTestimonyCategory = update('testimonyCategoryConfig', 'catégorie de témoignage');
exports.deleteTestimonyCategory = remove('testimonyCategoryConfig', 'catégorie de témoignage');

// Contrôleurs pour EventTypeConfig
exports.getEventTypes = getAll('eventTypeConfig');
exports.getEventTypesAll = getAllIncludingInactive('eventTypeConfig');
exports.getEventType = getById('eventTypeConfig');
exports.createEventType = create('eventTypeConfig', 'type d\'événement');
exports.updateEventType = update('eventTypeConfig', 'type d\'événement');
exports.deleteEventType = remove('eventTypeConfig', 'type d\'événement');

