const { handleError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

// Obtenir les statistiques globales
exports.getGlobalStats = async (req, res) => {
  try {
    const { prisma } = req;

    // Extraire le churchId correctement (peut être une chaîne ou un objet)
    let {churchId} = req.query;
    if (typeof churchId === 'object' && churchId !== null) {
      churchId = churchId.id || churchId._id;
    }

    logger.info('Stats - getGlobalStats - churchId', { churchId });

    // Filtre pour les utilisateurs : eglise_locale_id (comme dans Mongoose)
    const churchFilter = churchId ? { eglise_locale_id: churchId } : {};

    // Statistiques des réseaux
    const total_reseaux = churchId
      ? await prisma.network.count({ where: { church_id: churchId } })
      : await prisma.network.count();

    const total_resp_reseaux = await prisma.user.count({
      where: {
        qualification: 'RESPONSABLE_RESEAU',
        ...churchFilter
      }
    });

    // Statistiques des groupes et responsables de GR
    let total_gr = 0;
    let total_resp_gr = 0;

    if (churchId) {
      // Si on filtre par église, on doit d'abord récupérer les réseaux de cette église
      const networksInChurch = await prisma.network.findMany({
        where: { church_id: churchId },
        select: { id: true }
      });
      const networkIds = networksInChurch.map(n => n.id);

      // Compter les groupes dans ces réseaux
      total_gr = await prisma.group.count({
        where: { network_id: { in: networkIds } }
      });

      // Compter les responsables de GR dans ces réseaux
      const groupsInChurch = await prisma.group.findMany({
        where: { network_id: { in: networkIds } },
        select: { responsable1_id: true, responsable2_id: true }
      });
      const responsableIds = new Set();
      groupsInChurch.forEach(gr => {
        if (gr.responsable1_id) responsableIds.add(gr.responsable1_id);
        if (gr.responsable2_id) responsableIds.add(gr.responsable2_id);
      });
      total_resp_gr = responsableIds.size;
    } else {
      // Toutes les églises
      total_gr = await prisma.group.count();
      const allGroups = await prisma.group.findMany({
        select: { responsable1_id: true, responsable2_id: true }
      });
      const responsableIds = new Set();
      allGroups.forEach(gr => {
        if (gr.responsable1_id) responsableIds.add(gr.responsable1_id);
        if (gr.responsable2_id) responsableIds.add(gr.responsable2_id);
      });
      total_resp_gr = responsableIds.size;
    }

    // Autres statistiques (avec filtre eglise_locale comme dans Mongoose)
    const total_leaders = await prisma.user.count({
      where: { qualification: 'LEADER', ...churchFilter }
    });

    const total_leaders_all = await prisma.user.count({
      where: {
        qualification: { in: ['LEADER', 'RESPONSABLE_RESEAU', 'QUALIFICATION_12', 'QUALIFICATION_144', 'QUALIFICATION_1728'] },
        ...churchFilter
      }
    });

    const total_reguliers = await prisma.user.count({
      where: { qualification: 'REGULIER', ...churchFilter }
    });

    const total_integration = await prisma.user.count({
      where: { qualification: 'EN_INTEGRATION', ...churchFilter }
    });

    const total_irreguliers = await prisma.user.count({
      where: { qualification: 'IRREGULIER', ...churchFilter }
    });

    const total_gouvernance = await prisma.user.count({
      where: { qualification: 'GOUVERNANCE', ...churchFilter }
    });

    const total_ecodim = await prisma.user.count({
      where: { qualification: 'ECODIM', ...churchFilter }
    });

    const total_resp_ecodim = await prisma.user.count({
      where: { qualification: 'RESPONSABLE_ECODIM', ...churchFilter }
    });

    // Calcul des personnes isolées (comme dans Mongoose)
    let usersInGroups = [];
    if (churchId) {
      // Si on filtre par église, on doit d'abord récupérer les réseaux de cette église
      const networksInChurch = await prisma.network.findMany({
        where: { church_id: churchId },
        select: { id: true }
      });
      const networkIds = networksInChurch.map(n => n.id);
      const groupMembers = await prisma.groupMember.findMany({
        where: { group: { network_id: { in: networkIds } } },
        select: { user_id: true }
      });
      usersInGroups = groupMembers.map(gm => gm.user_id);
    } else {
      const groupMembers = await prisma.groupMember.findMany({
        select: { user_id: true }
      });
      usersInGroups = groupMembers.map(gm => gm.user_id);
    }

    const total_personnes_isolees = await prisma.user.count({
      where: {
        id: { notIn: usersInGroups },
        qualification: { notIn: ['RESPONSABLE_RESEAU', 'GOUVERNANCE', 'ECODIM', 'RESPONSABLE_ECODIM'] },
        ...churchFilter // Filtre par église comme dans Mongoose
      }
    });

    // Total général : tous les utilisateurs de l'église (comme dans Mongoose)
    const total_all = await prisma.user.count({ where: churchFilter });

    logger.info('Stats - getGlobalStats - Résultats', {
      total_gouvernance,
      total_reseaux,
      total_resp_reseaux,
      total_gr,
      total_resp_gr,
      total_leaders,
      total_leaders_all,
      total_reguliers,
      total_integration,
      total_irreguliers,
      total_ecodim,
      total_resp_ecodim,
      total_personnes_isolees,
      total_all
    });

    res.json({
      total_gouvernance,
      total_reseaux,
      total_resp_reseaux,
      total_gr,
      total_resp_gr,
      total_leaders,
      total_leaders_all,
      total_reguliers,
      total_integration,
      total_irreguliers,
      total_ecodim,
      total_resp_ecodim,
      total_personnes_isolees,
      total_all
    });
  } catch (error) {
    logger.error('Stats - getGlobalStats - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération des statistiques globales');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Obtenir l'évolution des réseaux
exports.getNetworksEvolution = async (req, res) => {
  try {
    logger.info('Stats - getNetworksEvolution - Début de la fonction');
    logger.info('Stats - getNetworksEvolution - req.query', req.query);
    logger.info('Stats - getNetworksEvolution - req.user', req.user);

    const { prisma } = req;

    const filter = {};

    // Ajouter le filtre par église si spécifié
    if (req.query.churchId) {
      filter.church_id = req.query.churchId;
    }

    // Récupère tous les réseaux
    const networks = await prisma.network.findMany({
      where: filter,
      select: { id: true, nom: true }
    });
    const networkNames = networks.map(n => n.nom);

    // Prépare exactement les 12 derniers mois (YYYY-MM), y compris le mois en cours
    const now = new Date();
    const months = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 10 + i, 1);
      const month = d.toISOString().slice(0, 7);
      months.push(month);
    }

    // Optimisation : récupérer tous les groupes avec leurs membres en une seule requête
    let allGroups;
    if (req.query.churchId) {
      // Si on filtre par église, on doit d'abord récupérer les réseaux de cette église
      const networksInChurch = await prisma.network.findMany({
        where: { church_id: req.query.churchId },
        select: { id: true }
      });
      const networkIds = networksInChurch.map(n => n.id);
      allGroups = await prisma.group.findMany({
        where: { network_id: { in: networkIds } },
        select: {
          id: true,
          network_id: true,
          members: {
            select: {
              user_id: true,
              createdAt: true
            }
          }
        }
      });
    } else {
      allGroups = await prisma.group.findMany({
        select: {
          id: true,
          network_id: true,
          members: {
            select: {
              user_id: true,
              createdAt: true
            }
          }
        }
      });
    }

    // Créer un Map pour accélérer les recherches
    const groupsByNetwork = new Map();
    allGroups.forEach(group => {
      if (!groupsByNetwork.has(group.network_id)) {
        groupsByNetwork.set(group.network_id, []);
      }
      groupsByNetwork.get(group.network_id).push(group);
    });

    // Prépare l'évolution
    const evolution = [];
    for (const month of months) {
      // Date de fin du mois (inclus)
      const [year, m] = month.split('-');
      const endOfMonth = new Date(Number(year), Number(m), 0, 23, 59, 59, 999);

      // Pour chaque réseau, compte les membres présents dans les groupes à cette date
      const row = { month };
      for (const network of networks) {
        const networkGroups = groupsByNetwork.get(network.id) || [];

        // Récupère tous les membres uniques présents dans les groupes à cette date
        const memberIds = new Set();
        networkGroups.forEach(g => {
          if (Array.isArray(g.members)) {
            g.members.forEach(member => {
              // Un membre est considéré comme présent s'il a rejoint le groupe avant la fin du mois
              if (new Date(member.createdAt) <= endOfMonth) {
                memberIds.add(member.user_id);
              }
            });
          }
        });

        row[network.nom] = memberIds.size;
      }
      evolution.push(row);
    }

    res.status(200).json({
      data: evolution
    });
  } catch (error) {
    logger.error('Stats - getNetworksEvolution - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la récupération de l\'évolution des réseaux');

    res.status(status).json({
      success: false,
      message
    });
  }
};

// Comparer les réseaux par année
exports.compareNetworksByYear = async (req, res) => {
  try {
    logger.info('Stats - compareNetworksByYear - Début de la fonction');
    logger.info('Stats - compareNetworksByYear - req.query', req.query);
    logger.info('Stats - compareNetworksByYear - req.user', req.user);

    const { prisma } = req;
    const { year1, year2 } = req.query;

    if (!year1 || !year2) {
      return res.status(400).json({
        success: false,
        message: 'Les années year1 et year2 sont requises'
      });
    }

    const dates = [
      new Date(Number(year1), 11, 31, 23, 59, 59, 999),
      new Date(Number(year2), 11, 31, 23, 59, 59, 999)
    ];

    const filter = {};

    // Ajouter le filtre par église si spécifié
    if (req.query.churchId) {
      filter.church_id = req.query.churchId;
    }

    const networks = await prisma.network.findMany({
      where: filter,
      select: { id: true, nom: true }
    });

    // Optimisation : récupérer tous les groupes avec leur historique en une seule requête
    let allGroups;
    if (req.query.churchId) {
      // Si on filtre par église, on doit d'abord récupérer les réseaux de cette église
      const networksInChurch = await prisma.network.findMany({
        where: { church_id: req.query.churchId },
        select: { id: true }
      });
      const networkIds = networksInChurch.map(n => n.id);
      allGroups = await prisma.group.findMany({
        where: { network_id: { in: networkIds } },
        select: {
          id: true,
          network_id: true,
          members: {
            select: {
              user_id: true,
              createdAt: true
            }
          }
        }
      });
    } else {
      allGroups = await prisma.group.findMany({
        select: {
          id: true,
          network_id: true,
          members: {
            select: {
              user_id: true,
              createdAt: true
            }
          }
        }
      });
    }

    // Créer un Map pour accélérer les recherches
    const groupsByNetwork = new Map();
    allGroups.forEach(group => {
      if (!groupsByNetwork.has(group.network_id)) {
        groupsByNetwork.set(group.network_id, []);
      }
      groupsByNetwork.get(group.network_id).push(group);
    });

    const result = [];

    for (const network of networks) {
      const row = { network: network.nom };
      const networkGroups = groupsByNetwork.get(network.id) || [];

      for (let i = 0; i < 2; i++) {
        const endOfYear = dates[i];
        const memberIds = new Set();
        networkGroups.forEach(g => {
          if (Array.isArray(g.members)) {
            g.members.forEach(m => {
              const joinedAt = new Date(m.createdAt);
              // Un membre est considéré comme présent s'il a rejoint le groupe avant la fin de l'année
              if (joinedAt <= endOfYear) {
                memberIds.add(m.user_id);
              }
            });
          }
        });

        // Assigner le bon nombre selon l'année
        if (i === 0) {
          row[year1] = memberIds.size;
        } else {
          row[year2] = memberIds.size;
        }
      }

      result.push(row);
    }

    res.status(200).json({
      data: result
    });
  } catch (error) {
    logger.error('Stats - compareNetworksByYear - Erreur complète', error);

    // Utilisation du gestionnaire d'erreurs centralisé
    const { status, message } = handleError(error, 'la comparaison des réseaux par année');

    res.status(status).json({
      success: false,
      message
    });
  }
};
