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

    // Log supprimé pour réduire le volume de logs

    // Filtre pour les utilisateurs : eglise_locale_id (comme dans Mongoose)
    const churchFilter = churchId ? { eglise_locale_id: churchId } : {};

    // Statistiques des réseaux
    const total_reseaux = churchId
      ? await prisma.network.count({ where: { church_id: churchId } })
      : await prisma.network.count();

    // Compter les responsables de réseaux (distincts sur responsable1_id et responsable2_id)
    let total_resp_reseaux = 0;
    if (churchId) {
      const networksInChurchForResp = await prisma.network.findMany({
        where: { church_id: churchId },
        select: { responsable1_id: true, responsable2_id: true }
      });
      const respSetNetworks = new Set();
      networksInChurchForResp.forEach(n => {
        if (n.responsable1_id) respSetNetworks.add(n.responsable1_id);
        if (n.responsable2_id) respSetNetworks.add(n.responsable2_id);
      });
      total_resp_reseaux = respSetNetworks.size;
    } else {
      const allNetworksForResp = await prisma.network.findMany({
        select: { responsable1_id: true, responsable2_id: true }
      });
      const respSetNetworks = new Set();
      allNetworksForResp.forEach(n => {
        if (n.responsable1_id) respSetNetworks.add(n.responsable1_id);
        if (n.responsable2_id) respSetNetworks.add(n.responsable2_id);
      });
      total_resp_reseaux = respSetNetworks.size;
    }

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
        qualification: { in: ['LEADER', 'RESPONSABLE_RESEAU', 'QUALIFICATION_12', 'QUALIFICATION_144', 'QUALIFICATION_1728', 'COMPAGNON_OEUVRE', 'RESPONSABLE_SESSION', 'RESPONSABLE_UNITE'] },
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


    const total_companions = await prisma.user.count({
      where: { qualification: 'COMPAGNON_OEUVRE', ...churchFilter }
    });

    // Statistiques des sessions
    const total_sessions = churchId
      ? await prisma.session.count({ where: { church_id: churchId } })
      : await prisma.session.count();

    // Compter les responsables de sessions (distincts sur responsable1_id et responsable2_id)
    let total_resp_sessions = 0;
    if (churchId) {
      const sessionsInChurch = await prisma.session.findMany({
        where: { church_id: churchId },
        select: { responsable1_id: true, responsable2_id: true }
      });
      const respSet = new Set();
      sessionsInChurch.forEach(s => {
        if (s.responsable1_id) respSet.add(s.responsable1_id);
        if (s.responsable2_id) respSet.add(s.responsable2_id);
      });
      total_resp_sessions = respSet.size;
    } else {
      const allSessions = await prisma.session.findMany({
        select: { responsable1_id: true, responsable2_id: true }
      });
      const respSet = new Set();
      allSessions.forEach(s => {
        if (s.responsable1_id) respSet.add(s.responsable1_id);
        if (s.responsable2_id) respSet.add(s.responsable2_id);
      });
      total_resp_sessions = respSet.size;
    }

    // Statistiques des unités et responsables d'unité
    let total_unites = 0;
    let total_resp_unites = 0;

    if (churchId) {
      // Si on filtre par église, on doit d'abord récupérer les sessions de cette église
      const sessionsInChurch = await prisma.session.findMany({
        where: { church_id: churchId },
        select: { id: true }
      });
      const sessionIds = sessionsInChurch.map(s => s.id);

      // Compter les unités dans ces sessions
      total_unites = await prisma.unit.count({
        where: { session_id: { in: sessionIds } }
      });

      // Compter les responsables d'unité dans ces sessions
      const unitsInChurch = await prisma.unit.findMany({
        where: { session_id: { in: sessionIds } },
        select: { responsable1_id: true, responsable2_id: true }
      });
      const responsableIds = new Set();
      unitsInChurch.forEach(unit => {
        if (unit.responsable1_id) responsableIds.add(unit.responsable1_id);
        if (unit.responsable2_id) responsableIds.add(unit.responsable2_id);
      });
      total_resp_unites = responsableIds.size;
    } else {
      // Toutes les églises
      total_unites = await prisma.unit.count();
      const allUnits = await prisma.unit.findMany({
        select: { responsable1_id: true, responsable2_id: true }
      });
      const responsableIds = new Set();
      allUnits.forEach(unit => {
        if (unit.responsable1_id) responsableIds.add(unit.responsable1_id);
        if (unit.responsable2_id) responsableIds.add(unit.responsable2_id);
      });
      total_resp_unites = responsableIds.size;
    }

    // Membres de section: compter les utilisateurs assignés aux unités (UnitMember) ∪ responsables de sections (responsable1/2 des sessions), distinct par user_id
    let total_membres_session = 0;
    if (churchId) {
      const sessionsInChurchForMembers = await prisma.session.findMany({
        where: { church_id: churchId },
        select: { id: true, responsable1_id: true, responsable2_id: true }
      });
      const sessionIdsForMembers = sessionsInChurchForMembers.map(s => s.id);
      const unitMembers = await prisma.unitMember.findMany({
        where: { unit: { session_id: { in: sessionIdsForMembers } } },
        select: { user_id: true }
      });
      // Ajouter les responsables de sections (1 et 2)
      const sessionRespIds = new Set();
      sessionsInChurchForMembers.forEach(s => {
        if (s.responsable1_id) sessionRespIds.add(s.responsable1_id);
        if (s.responsable2_id) sessionRespIds.add(s.responsable2_id);
      });
      const unitMemberSet = new Set(unitMembers.map(um => um.user_id));
      const unionSet = new Set([...unitMemberSet, ...sessionRespIds]);
      total_membres_session = unionSet.size;
    } else {
      const [unitMembers, allSessionsForMembers] = await Promise.all([
        prisma.unitMember.findMany({ select: { user_id: true } }),
        prisma.session.findMany({ select: { responsable1_id: true, responsable2_id: true } })
      ]);
      const unitMemberSet = new Set(unitMembers.map(um => um.user_id));
      const sessionRespIds = new Set();
      allSessionsForMembers.forEach(s => {
        if (s.responsable1_id) sessionRespIds.add(s.responsable1_id);
        if (s.responsable2_id) sessionRespIds.add(s.responsable2_id);
      });
      const unionSet = new Set([...unitMemberSet, ...sessionRespIds]);
      total_membres_session = unionSet.size;
    }

    // Calcul des Membres réseaux (membres de GR des réseaux + responsables de réseau + compagnons d'œuvre)
    let total_network_members = 0;
    try {
      let networkIds = [];
      if (churchId) {
        const networksInChurch = await prisma.network.findMany({
          where: { church_id: churchId },
          select: { id: true, responsable1_id: true, responsable2_id: true }
        });
        networkIds = networksInChurch.map(n => n.id);

        // Membres des GR des réseaux sélectionnés
        const groupMembers = await prisma.groupMember.findMany({
          where: { group: { network_id: { in: networkIds } } },
          select: { user_id: true }
        });

        // Compagnons d'œuvre des réseaux sélectionnés
        const companions = await prisma.networkCompanion.findMany({
          where: { network_id: { in: networkIds } },
          select: { user_id: true }
        });

        // Responsables 1 et 2 des réseaux sélectionnés
        const respIds = new Set();
        networksInChurch.forEach(n => {
          if (n.responsable1_id) respIds.add(n.responsable1_id);
          if (n.responsable2_id) respIds.add(n.responsable2_id);
        });

        // Union sans doublons
        const membersSet = new Set([
          ...groupMembers.map(gm => gm.user_id),
          ...companions.map(c => c.user_id),
          ...respIds
        ]);
        total_network_members = membersSet.size;
      } 
    } catch (e) {
      logger.warn('Stats - total_network_members - calcul partiel échoué, valeur par défaut 0');
      total_network_members = 0;
    }

    // Calcul des personnes isolées (comme dans Mongoose)
    let usersInGroups = [];
    let usersInUnits = [];
    
    if (churchId) {
      // Si on filtre par église, on doit d'abord récupérer les réseaux et sessions de cette église
      const networksInChurch = await prisma.network.findMany({
        where: { church_id: churchId },
        select: { id: true }
      });
      const networkIds = networksInChurch.map(n => n.id);
      
      const sessionsInChurch = await prisma.session.findMany({
        where: { church_id: churchId },
        select: { id: true }
      });
      const sessionIds = sessionsInChurch.map(s => s.id);
      
      const groupMembers = await prisma.groupMember.findMany({
        where: { group: { network_id: { in: networkIds } } },
        select: { user_id: true }
      });
      usersInGroups = groupMembers.map(gm => gm.user_id);
      
      const unitMembers = await prisma.unitMember.findMany({
        where: { unit: { session_id: { in: sessionIds } } },
        select: { user_id: true }
      });
      usersInUnits = unitMembers.map(um => um.user_id);
    } else {
      const groupMembers = await prisma.groupMember.findMany({
        select: { user_id: true }
      });
      usersInGroups = groupMembers.map(gm => gm.user_id);
      
      const unitMembers = await prisma.unitMember.findMany({
        select: { user_id: true }
      });
      usersInUnits = unitMembers.map(um => um.user_id);
    }
    
    // Combiner tous les utilisateurs dans des groupes ou unités
    const allUsersInStructures = [...new Set([...usersInGroups, ...usersInUnits])];

    const total_personnes_isolees = await prisma.user.count({
      where: {
        id: { notIn: allUsersInStructures },
        qualification: { notIn: ['RESPONSABLE_RESEAU', 'RESPONSABLE_SESSION', 'RESPONSABLE_UNITE', 'GOUVERNANCE', 'ECODIM', 'COMPAGNON_OEUVRE', 'MEMBRE_SESSION'] },
        ...churchFilter // Filtre par église comme dans Mongoose
      }
    });

    // Total général : tous les utilisateurs de l'église (comme dans Mongoose)
    const total_all = await prisma.user.count({ where: churchFilter });

    // Log supprimé pour réduire le volume de logs

    res.json({
      total_gouvernance,
      total_reseaux,
      total_resp_reseaux,
      total_gr,
      total_resp_gr,
      total_sessions,
      total_resp_sessions,
      total_unites,
      total_resp_unites,
      total_membres_session,
      total_network_members,
      total_leaders,
      total_leaders_all,
      total_reguliers,
      total_integration,
      total_irreguliers,
      total_ecodim,
      total_companions,
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
    // Logs supprimés pour réduire le volume de logs

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
    // Logs supprimés pour réduire le volume de logs

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
