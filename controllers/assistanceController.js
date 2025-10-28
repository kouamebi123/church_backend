const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// Fonction utilitaire pour vérifier les doublons par semaine et type de culte
const checkDuplicateAssistance = async (network_id, date, type_culte, excludeId = null) => {
  try {
    // Calculer le début et la fin de la semaine (lundi à dimanche)
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0 = dimanche, 1 = lundi
    
    const monday = new Date(targetDate);
    monday.setDate(targetDate.getDate() - daysToMonday);
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    // Vérifier s'il existe déjà une assistance pour cette semaine et ce type de culte
    const existingAssistance = await prisma.assistance.findFirst({
      where: {
        network_id,
        type_culte,
        date: {
          gte: monday,
          lte: sunday
        },
        ...(excludeId && { id: { not: excludeId } })
      }
    });
    
    return existingAssistance;
  } catch (error) {
    logger.error('❌ Erreur lors de la vérification des doublons:', error);
    throw error;
  }
};

// Créer une nouvelle assistance
const createAssistance = async (req, res) => {
  try {
    logger.info('🔍 Création assistance - Données reçues:', { body: req.body });
    const { date, type_culte, total_presents, invites, network_id, church_id, groupes_assistance, responsables_reseau, compagnons_oeuvre } = req.body;
    const created_by_id = req.user.id;

    // Vérifier les permissions
    const user = await prisma.user.findUnique({
      where: { id: created_by_id },
      include: { eglise_locale: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Vérifier que l'utilisateur a accès à cette église
    if (user.eglise_locale_id !== church_id) {
      return res.status(403).json({ message: 'Accès non autorisé à cette église' });
    }

    // Vérifier que le réseau existe et appartient à cette église
    const network = await prisma.network.findFirst({
      where: {
        id: network_id,
        church_id: church_id
      }
    });

    if (!network) {
      return res.status(404).json({ message: 'Réseau non trouvé' });
    }

    // Calculer le dimanche de la semaine correspondante
    const culteDate = new Date(date);
    const dayOfWeek = culteDate.getDay(); // 0 = dimanche, 1 = lundi, etc.
    const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek; // Si c'est déjà dimanche, on reste sur dimanche
    const sundayDate = new Date(culteDate);
    sundayDate.setDate(culteDate.getDate() + daysToSunday);
    sundayDate.setHours(0, 0, 0, 0); // Mettre à minuit pour éviter les problèmes d'heure

    logger.info('📅 Calcul dimanche de la semaine:', {
      culte_date: culteDate.toISOString(),
      day_of_week: dayOfWeek,
      days_to_sunday: daysToSunday,
      sunday_date: sundayDate.toISOString()
    });

    // Vérifier s'il n'y a pas déjà une assistance pour cette semaine et ce type de culte
    const duplicateAssistance = await checkDuplicateAssistance(network_id, sundayDate, type_culte);
    if (duplicateAssistance) {
      logger.warn('⚠️ Tentative de création d\'une assistance en doublon:', {
        network_id,
        sunday_date: sundayDate.toISOString(),
        type_culte,
        existing_id: duplicateAssistance.id
      });
      
      return res.status(409).json({
        success: false,
        message: `Il existe déjà une assistance pour la semaine du ${sundayDate.toLocaleDateString('fr-FR')} avec le type de culte "${type_culte}". Impossible de créer un doublon.`
      });
    }

    // Créer l'assistance et les groupes d'assistance en transaction
    const assistance = await prisma.$transaction(async (tx) => {
      const newAssistance = await tx.assistance.create({
        data: {
          date: sundayDate,
          type_culte,
          total_presents,
          invites: invites || 0,
          responsables_reseau: responsables_reseau || 0,
          compagnons_oeuvre: compagnons_oeuvre || 0,
          network_id,
          church_id,
          created_by_id
        }
      });

      // Créer les groupes d'assistance
      if (groupes_assistance && groupes_assistance.length > 0) {
        await Promise.all(
          groupes_assistance.map(groupe => 
            tx.groupeAssistance.create({
              data: {
                assistance_id: newAssistance.id,
                group_id: groupe.group_id,
                effectif_actuel: groupe.effectif_actuel,
                nombre_presents: groupe.nombre_presents
              }
            })
          )
        );
      }

      return newAssistance;
    });

    logger.info('✅ Assistance créée avec succès:', { assistance_id: assistance.id });

    res.status(201).json({
      message: 'Assistance enregistrée avec succès',
      assistance: {
        id: assistance.id,
        date: assistance.date,
        type_culte: assistance.type_culte,
        total_presents: assistance.total_presents
      }
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la création de l\'assistance:', error);
    res.status(500).json({
      message: 'Erreur lors de la création de l\'assistance',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne'
    });
  }
};

// Obtenir les statistiques d'assistance
const getAssistanceStats = async (req, res) => {
  try {
    const { church_id, network_id, type_culte, date_from, date_to } = req.query;

    logger.info('🔍 Récupération statistiques assistance:', { query: req.query });

    // Construire les filtres
    const where = {};
    if (church_id) where.church_id = church_id;
    if (network_id) where.network_id = network_id;
    if (type_culte) where.type_culte = type_culte;
    if (date_from || date_to) {
      where.date = {};
      if (date_from) where.date.gte = new Date(date_from);
      if (date_to) where.date.lte = new Date(date_to);
    }

    // Récupérer les assistances avec les détails
    const assistances = await prisma.assistance.findMany({
      where,
      include: {
        network: {
          select: { nom: true }
        },
        groupes_assistance: {
          include: {
            group: {
              select: { nom: true }
            }
          }
        }
      },
      orderBy: { date: 'desc' }
    });

    // Calculer les statistiques
    let total_presents = 0;
    let total_effectif_reel = 0;
    const chartData = [];
    const details = [];

    for (const assistance of assistances) {
      const assistance_total = assistance.groupes_assistance.reduce(
        (sum, ga) => sum + ga.nombre_presents, 0
      );
      total_presents += assistance_total;

      // Calculer l'effectif réel total (somme des effectifs actuels des groupes)
      const effectif_reel_total = assistance.groupes_assistance.reduce(
        (sum, ga) => sum + ga.effectif_actuel, 0
      );
      total_effectif_reel += effectif_reel_total;

      // Données pour le graphique
      chartData.push({
        date: assistance.date.toISOString().split('T')[0],
        effectif_reel: effectif_reel_total,
        assistance: assistance_total
      });

      // Détails pour le tableau
      details.push({
        id: assistance.id,
        network_name: assistance.network.nom,
        type_culte: assistance.type_culte,
        date: assistance.date,
        effectif_reel: effectif_reel_total,
        assistance: assistance_total,
        difference: assistance_total - effectif_reel_total,
        taux_presence: effectif_reel_total > 0 ? 
          ((assistance_total / effectif_reel_total) * 100).toFixed(1) : 0
      });
    }



    const stats = {
      total_presents,
      effectif_reel: total_effectif_reel,
      difference: total_presents - total_effectif_reel,
      precision: total_effectif_reel > 0 ? 
        ((total_presents / total_effectif_reel) * 100).toFixed(1) : 0,
      chartData,
      details
    };

    logger.info('✅ Statistiques assistance récupérées avec succès');

    // Transformer les données pour correspondre à la structure attendue par le frontend
    const transformedStats = {
      total_presents: stats.total_presents,
      effectif_reel: stats.effectif_reel,
      difference: stats.difference,
      precision: stats.precision,
      chart_data: stats.chartData,
      details: stats.details
    };

    res.json({
      success: true,
      message: 'Statistiques récupérées avec succès',
      data: transformedStats
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des statistiques',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne'
    });
  }
};

// Obtenir une assistance par ID
const getAssistanceById = async (req, res) => {
  try {
    const { id } = req.params;

    const assistance = await prisma.assistance.findUnique({
      where: { id },
      include: {
        network: true,
        groupes_assistance: {
          include: {
            group: true
          }
        }
      }
    });

    if (!assistance) {
      return res.status(404).json({ message: 'Assistance non trouvée' });
    }

    res.json({
      message: 'Assistance récupérée avec succès',
      data: assistance
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la récupération de l\'assistance:', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération de l\'assistance',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne'
    });
  }
};

// Mettre à jour une assistance
const updateAssistance = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, type_culte, total_presents, groupes_assistance, responsables_reseau, compagnons_oeuvre } = req.body;

    // Vérifier que l'assistance existe
    const existingAssistance = await prisma.assistance.findUnique({
      where: { id },
      include: { created_by: true }
    });

    if (!existingAssistance) {
      return res.status(404).json({ message: 'Assistance non trouvée' });
    }

    // Vérifier les permissions
    if (existingAssistance.created_by_id !== req.user.id) {
      return res.status(403).json({ message: 'Non autorisé à modifier cette assistance' });
    }

    // Calculer le dimanche de la semaine correspondante
    const culteDate = new Date(date);
    const dayOfWeek = culteDate.getDay(); // 0 = dimanche, 1 = lundi, etc.
    const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek; // Si c'est déjà dimanche, on reste sur dimanche
    const sundayDate = new Date(culteDate);
    sundayDate.setDate(culteDate.getDate() + daysToSunday);
    sundayDate.setHours(0, 0, 0, 0); // Mettre à minuit pour éviter les problèmes d'heure

    logger.info('📅 Calcul dimanche de la semaine (update):', {
      culte_date: culteDate.toISOString(),
      day_of_week: dayOfWeek,
      days_to_sunday: daysToSunday,
      sunday_date: sundayDate.toISOString()
    });

    // Vérifier s'il n'y a pas déjà une assistance pour cette semaine et ce type de culte (en excluant l'actuelle)
    const duplicateAssistance = await checkDuplicateAssistance(
      existingAssistance.network_id, 
      sundayDate, 
      type_culte, 
      id
    );
    if (duplicateAssistance) {
      logger.warn('⚠️ Tentative de mise à jour vers une assistance en doublon:', {
        network_id: existingAssistance.network_id,
        sunday_date: sundayDate.toISOString(),
        type_culte,
        existing_id: duplicateAssistance.id,
        updating_id: id
      });
      
      return res.status(409).json({
        success: false,
        message: `Il existe déjà une assistance pour la semaine du ${sundayDate.toLocaleDateString('fr-FR')} avec le type de culte "${type_culte}". Impossible de créer un doublon.`
      });
    }

    // Mettre à jour en transaction
    const assistance = await prisma.$transaction(async (tx) => {
      // Mettre à jour l'assistance
      const updatedAssistance = await tx.assistance.update({
        where: { id },
        data: {
          date: sundayDate,
          type_culte,
          total_presents,
          responsables_reseau: responsables_reseau || 0,
          compagnons_oeuvre: compagnons_oeuvre || 0
        }
      });

      // Supprimer les anciens groupes d'assistance
      await tx.groupeAssistance.deleteMany({
        where: { assistance_id: id }
      });

      // Créer les nouveaux groupes d'assistance
      if (groupes_assistance && groupes_assistance.length > 0) {
        await Promise.all(
          groupes_assistance.map(groupe => 
            tx.groupeAssistance.create({
              data: {
                assistance_id: id,
                group_id: groupe.group_id,
                effectif_actuel: groupe.effectif_actuel,
                nombre_presents: groupe.nombre_presents
              }
            })
          )
        );
      }

      return updatedAssistance;
    });

    logger.info('✅ Assistance mise à jour avec succès:', { assistance_id: id });

    res.json({
      message: 'Assistance mise à jour avec succès',
      data: assistance
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la mise à jour de l\'assistance:', error);
    res.status(500).json({
      message: 'Erreur lors de la mise à jour de l\'assistance',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne'
    });
  }
};

// Supprimer une assistance
const deleteAssistance = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que l'assistance existe
    const existingAssistance = await prisma.assistance.findUnique({
      where: { id },
      include: { created_by: true }
    });

    if (!existingAssistance) {
      return res.status(404).json({ message: 'Assistance non trouvée' });
    }

    // Vérifier les permissions
    if (existingAssistance.created_by_id !== req.user.id) {
      return res.status(403).json({ message: 'Non autorisé à supprimer cette assistance' });
    }

    // Supprimer l'assistance (les groupes seront supprimés automatiquement par CASCADE)
    await prisma.assistance.delete({
      where: { id }
    });

    logger.info('✅ Assistance supprimée avec succès:', { assistance_id: id });

    res.json({
      message: 'Assistance supprimée avec succès'
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la suppression de l\'assistance:', error);
    res.status(500).json({
      message: 'Erreur lors de la suppression de l\'assistance',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne'
    });
  }
};

module.exports = {
  createAssistance,
  getAssistanceStats,
  getAssistanceById,
  updateAssistance,
  deleteAssistance
};
