const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

// Fonction utilitaire pour calculer le dimanche de la semaine d'une date donnée
// Utilise la logique ISO 8601 mais retourne le dimanche précédent (fin de semaine précédente)
const getSundayOfWeek = (date) => {
  const targetDate = new Date(date);
  const year = targetDate.getFullYear();
  
  // Calculer le numéro de semaine ISO
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((targetDate - startOfYear) / (24 * 60 * 60 * 1000));
  let weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  
  // Ajuster pour les années où le 1er janvier est dans la semaine 52/53 de l'année précédente
  if (weekNumber === 0) {
    const lastYear = year - 1;
    const lastYearStart = new Date(lastYear, 0, 1);
    const lastYearDays = Math.floor((targetDate - lastYearStart) / (24 * 60 * 60 * 1000));
    weekNumber = Math.ceil((lastYearDays + lastYearStart.getDay() + 1) / 7);
  }
  
  // Calculer le lundi de cette semaine ISO
  const firstDayOfYear = new Date(year, 0, 1);
  const firstThursdayOfYear = new Date(year, 0, 1);
  
  // Trouver le premier jeudi de l'année
  while (firstThursdayOfYear.getDay() !== 4) {
    firstThursdayOfYear.setDate(firstThursdayOfYear.getDate() + 1);
  }
  
  // Calculer le lundi de la semaine demandée
  const mondayOfWeek = new Date(firstThursdayOfYear);
  mondayOfWeek.setDate(firstThursdayOfYear.getDate() + (weekNumber - 1) * 7 - 3);
  
  // Calculer le dimanche précédent (fin de la semaine précédente)
  const sundayOfWeek = new Date(mondayOfWeek);
  sundayOfWeek.setDate(mondayOfWeek.getDate() - 1);
  sundayOfWeek.setHours(0, 0, 0, 0);
  
  return sundayOfWeek;
};

// Fonction utilitaire pour vérifier les doublons par semaine et type de culte
const checkDuplicateAssistance = async (network_id, date, type_culte, excludeId = null) => {
  try {
    // Calculer le dimanche de la semaine pour cette date
    const sundayOfWeek = getSundayOfWeek(date);
    
    // Calculer le dimanche suivant pour la plage de recherche
    const nextSunday = new Date(sundayOfWeek);
    nextSunday.setDate(sundayOfWeek.getDate() + 7);
    nextSunday.setHours(0, 0, 0, 0);
    
    // Vérifier s'il existe déjà une assistance pour cette semaine (dimanche) et ce type de culte
    const existingAssistance = await prisma.assistance.findFirst({
      where: {
        network_id,
        type_culte,
        date: {
          gte: sundayOfWeek,
          lt: nextSunday
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

    // Calculer le dimanche de la semaine pour cette date
    const sundayOfWeek = getSundayOfWeek(date);
    logger.info('📅 Date du culte:', { originalDate: date, sundayOfWeek: sundayOfWeek.toISOString() });

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

    // Vérifier s'il n'y a pas déjà une assistance pour cette semaine et ce type de culte
    const duplicateAssistance = await checkDuplicateAssistance(network_id, date, type_culte);
    if (duplicateAssistance) {
      logger.warn('⚠️ Tentative de création d\'une assistance en doublon:', {
        network_id,
        originalDate: date,
        sundayOfWeek: sundayOfWeek.toISOString(),
        type_culte,
        existing_id: duplicateAssistance.id
      });
      
      return res.status(409).json({
        success: false,
        message: `Il existe déjà une assistance pour la semaine du ${sundayOfWeek.toLocaleDateString('fr-FR')} avec le type de culte "${type_culte}". Impossible de créer un doublon.`
      });
    }

    // Créer l'assistance et les groupes d'assistance en transaction
    const assistance = await prisma.$transaction(async (tx) => {
      const newAssistance = await tx.assistance.create({
        data: {
          date: sundayOfWeek, // Utiliser le dimanche de la semaine
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
      // Utiliser total_presents directement qui inclut déjà tous les éléments :
      // - Membres des groupes (groupes_assistance)
      // - Responsables de réseau (responsables_reseau)
      // - Compagnons d'œuvre (compagnons_oeuvre)
      // - Invités (invites)
      const assistance_total = assistance.total_presents || 0;
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
    const { date, type_culte, total_presents, invites, groupes_assistance, responsables_reseau, compagnons_oeuvre } = req.body;

    // Calculer le dimanche de la semaine pour cette date
    const sundayOfWeek = getSundayOfWeek(date);
    logger.info('📅 Mise à jour assistance - Date du culte:', { originalDate: date, sundayOfWeek: sundayOfWeek.toISOString() });

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

    // Vérifier s'il n'y a pas déjà une assistance pour cette semaine et ce type de culte (en excluant l'actuelle)
    const duplicateAssistance = await checkDuplicateAssistance(
      existingAssistance.network_id, 
      date, 
      type_culte, 
      id
    );
    if (duplicateAssistance) {
      logger.warn('⚠️ Tentative de mise à jour vers une assistance en doublon:', {
        network_id: existingAssistance.network_id,
        date,
        type_culte,
        existing_id: duplicateAssistance.id,
        updating_id: id
      });
      
      return res.status(409).json({
        success: false,
        message: `Il existe déjà une assistance pour la semaine du ${sundayOfWeek.toLocaleDateString('fr-FR')} avec le type de culte "${type_culte}". Impossible de créer un doublon.`
      });
    }

    // Mettre à jour en transaction
    const assistance = await prisma.$transaction(async (tx) => {
      // Mettre à jour l'assistance
      const updatedAssistance = await tx.assistance.update({
        where: { id },
        data: {
          date: sundayOfWeek, // Utiliser le dimanche de la semaine
          type_culte,
          total_presents,
          invites: invites || 0,
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
