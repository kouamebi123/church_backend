const logger = require('../utils/logger');
const { getNiveauFromQualification } = require('../utils/chaineImpactUtils');

// Construire l'arbre hiérarchique récursivement
const buildTree = (nodes, parentId = null) => {
  const filteredNodes = nodes.filter(node => node.responsable_id === parentId);
  
  // Debug: afficher les nœuds filtrés
  
  return filteredNodes.map(node => ({
    id: node.id,
    user_id: node.user_id,
    niveau: node.niveau,
    qualification: node.qualification,
    position_x: node.position_x,
    position_y: node.position_y,
    user: node.user,
    responsable: node.responsable,
    network: node.network,
    group: node.group,
    children: buildTree(nodes, node.user_id) // Récursion pour les enfants
  }));
};

// Récupérer la chaine d'impact pour une église sous forme d'arbre
const getChaineImpact = async (req, res) => {
  try {
    const { church_id } = req.query;
    
    if (!church_id) {
      return res.status(400).json({ message: 'ID de l\'église requis' });
    }

    // Récupérer tous les nœuds de la chaîne d'impact
    const chaineImpactNodes = await req.prisma.chaineImpact.findMany({
      where: { eglise_id: church_id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            pseudo: true,
            image: true,
            qualification: true,
            role: true
          }
        },
        responsable: {
          select: {
            id: true,
            username: true,
            pseudo: true,
            image: true,
            qualification: true
          }
        },
        network: {
          select: {
            id: true,
            nom: true
          }
        },
        group: {
          select: {
            id: true,
            nom: true
          }
        }
      },
      orderBy: [
        { niveau: 'asc' },
        { position_y: 'asc' },
        { position_x: 'asc' }
      ]
    });

    // Construire l'arbre hiérarchique
    const tree = buildTree(chaineImpactNodes);

    logger.info(`Arbre hiérarchique construit pour l'église ${church_id} avec ${chaineImpactNodes.length} nœuds`);
    
    res.json({
      success: true,
      church_id,
      total_nodes: chaineImpactNodes.length,
      tree: tree // Arbre hiérarchique avec enfants
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération de la chaine d\'impact:', error);
    res.status(500).json({ message: 'Erreur serveur', success: false });
  }
};

// Créer ou mettre à jour la chaine d'impact automatiquement
const updateChaineImpact = async (req, res) => {
  try {
    const { church_id } = req.body;
    
    if (!church_id) {
      return res.status(400).json({ message: 'ID de l\'église requis' });
    }

    // Récupérer tous les utilisateurs de l'église avec leurs relations
    const users = await req.prisma.user.findMany({
      where: { eglise_locale_id: church_id },
      include: {
        network_responsable1: true,
        group_responsable1: true,
        group_responsable2: true,
        group_superieur_hierarchique: true
      }
    });

    // Supprimer l'ancienne chaine d'impact
    await req.prisma.chaineImpact.deleteMany({
      where: { eglise_id: church_id }
    });

    const chaineImpactRecords = [];

    // Récupérer le responsable de l'église
    const responsableEglise = await req.prisma.church.findUnique({
      where: { id: church_id },
      include: { responsable: true }
    });

    if (responsableEglise?.responsable) {
      chaineImpactRecords.push({
        user_id: responsableEglise.responsable.id,
        niveau: 0, // Niveau 0 = Responsable d'église
        qualification: 'RESPONSABLE_EGLISE',
        responsable_id: null,
        eglise_id: church_id,
        position_x: 0,
        position_y: 0
      });
    }

    // Traiter les responsables de réseaux (niveau 1)
    const responsablesReseaux = users.filter(user => 
      user.network_responsable1.length > 0
    );

    responsablesReseaux.forEach((user, index) => {
      chaineImpactRecords.push({
        user_id: user.id,
        niveau: 1,
        qualification: 'RESPONSABLE_RESEAU',
        responsable_id: responsableEglise?.responsable?.id || null,
        eglise_id: church_id,
        position_x: index,
        position_y: 1
      });
    });

    // Traiter les utilisateurs par qualification
    const qualifications = [
      'QUALIFICATION_12',
      'QUALIFICATION_144', 
      'QUALIFICATION_1728',
      'QUALIFICATION_20738',
      'QUALIFICATION_248832'
    ];


    for (const qualification of qualifications) {
      const usersWithQualification = users.filter(user => 
        user.qualification === qualification
      );

      const niveau = getNiveauFromQualification(qualification);

      usersWithQualification.forEach((user, index) => {
        // Déterminer le responsable hiérarchique
        let responsable_id = null;
        
        if (niveau === 2) { // QUALIFICATION_12
          // Le responsable est le responsable du réseau auquel appartient l'utilisateur
          const userGroups = user.group_responsable1;
          if (userGroups.length > 0) {
            const group = userGroups[0];
            
            if (group.superieur_hierarchique_id) {
              responsable_id = group.superieur_hierarchique_id;
            } else {
              // Chercher le responsable du réseau
              const networkResponsable = responsablesReseaux.find(r => 
                r.network_responsable1.some(n => n.id === group.network_id)
              );
              if (networkResponsable) {
                responsable_id = networkResponsable.id;
              }
            }
          }
        } else {
          // Pour les autres niveaux, chercher dans les groupes
          const userGroups = user.group_responsable1;
          if (userGroups.length > 0) {
            const group = userGroups[0];
            if (group.superieur_hierarchique_id) {
              responsable_id = group.superieur_hierarchique_id;
            }
          }
        }

        const record = {
          user_id: user.id,
          niveau,
          qualification,
          responsable_id,
          eglise_id: church_id,
          position_x: index,
          position_y: niveau
        };

        chaineImpactRecords.push(record);
      });
    }

    // Insérer tous les enregistrements
    if (chaineImpactRecords.length > 0) {
      await req.prisma.chaineImpact.createMany({
        data: chaineImpactRecords
      });
    }

    logger.info(`Chaine d'impact mise à jour pour l'église ${church_id} avec ${chaineImpactRecords.length} enregistrements`);
    res.json({ 
      message: 'Chaine d\'impact mise à jour avec succès',
      count: chaineImpactRecords.length 
    });
  } catch (error) {
    logger.error('Erreur lors de la mise à jour de la chaine d\'impact:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Construire l'arbre récursivement à partir des groupes pour un responsable de réseau
const buildTreeFromGroups = (groups, networkResponsableId) => {
  if (!Array.isArray(groups)) {
    logger.error('buildTreeFromGroups: groups doit être un tableau');
    return [];
  }
  
  if (!networkResponsableId) {
    logger.error('buildTreeFromGroups: networkResponsableId est requis');
    return [];
  }
  
  // Convertir en string pour la comparaison
  const networkResponsableIdStr = String(networkResponsableId);
  
  // Éviter les boucles infinies en gardant une trace des groupes visités (par ID de groupe)
  const visitedGroupIds = new Set();
  
  // Fonction récursive pour construire les enfants d'un parent donné
  const buildChildren = (parentUserId, currentNiveau = 2) => {
    if (!parentUserId) return [];
    
    const parentUserIdStr = String(parentUserId);
    
    // Trouver tous les groupes où le supérieur hiérarchique est le parent
    const childGroups = groups.filter(group => {
      if (!group || !group.responsable1 || !group.responsable1.id) return false;
      if (visitedGroupIds.has(group.id)) return false;
      
      const superieurId = group.superieur_hierarchique_id ? String(group.superieur_hierarchique_id) : null;
      return superieurId === parentUserIdStr;
    });

    return childGroups.map(group => {
      // Marquer ce groupe comme visité
      visitedGroupIds.add(group.id);
      
      // Déterminer le niveau basé sur la qualification du responsable du groupe
      const responsableQualification = group.responsable1?.qualification || 'QUALIFICATION_12';
      let niveau = getNiveauFromQualification(responsableQualification);
      
      // S'assurer que le niveau est au moins égal au niveau actuel + 1
      if (niveau <= currentNiveau) {
        niveau = currentNiveau + 1;
      }
      
      // Construire le nœud pour le responsable du groupe
      const node = {
        id: `group-${group.id}`,
        niveau: niveau,
        user: {
          id: group.responsable1.id,
          username: group.responsable1.username || group.responsable1.pseudo || 'Sans nom',
          image: group.responsable1.image || null,
          qualification: group.responsable1.qualification || 'QUALIFICATION_12'
        },
        children: []
      };

      // Récursion : trouver les groupes où ce responsable est le supérieur hiérarchique
      try {
        const childGroupsNodes = buildChildren(group.responsable1.id, niveau);
        node.children = childGroupsNodes || [];
      } catch (error) {
        logger.error(`Erreur lors de la construction des enfants pour le groupe ${group.id}:`, error);
        node.children = [];
      }

      return node;
    });
  };
  
  // Trouver les groupes directement sous le responsable de réseau (niveau 1 -> niveau 2)
  const rootGroups = groups.filter(group => {
    if (!group || !group.responsable1 || !group.responsable1.id) return false;
    if (visitedGroupIds.has(group.id)) return false;
    
    const superieurId = group.superieur_hierarchique_id ? String(group.superieur_hierarchique_id) : null;
    return superieurId === networkResponsableIdStr;
  });

  // Construire les nœuds racine (groupes de niveau 2)
  return rootGroups.map(group => {
    // Marquer ce groupe comme visité
    visitedGroupIds.add(group.id);
    
    const responsableQualification = group.responsable1?.qualification || 'QUALIFICATION_12';
    let niveau = getNiveauFromQualification(responsableQualification);
    
    // Les groupes directement sous le responsable de réseau sont au niveau 2
    if (niveau < 2) {
      niveau = 2;
    }
    
    let children = [];
    try {
      children = buildChildren(group.responsable1.id, niveau);
    } catch (error) {
      logger.error(`Erreur lors de la construction des enfants pour le groupe racine ${group.id}:`, error);
      children = [];
    }
    
    const node = {
      id: `group-${group.id}`,
      niveau: niveau,
      user: {
        id: group.responsable1.id,
        username: group.responsable1.username || group.responsable1.pseudo || 'Sans nom',
        image: group.responsable1.image || null,
        qualification: group.responsable1.qualification || 'QUALIFICATION_12'
      },
      children: children
    };

    return node;
  });
};

// Récupérer la chaine d'impact d'un utilisateur spécifique
const getChaineImpactByUser = async (req, res) => {
  try {
    const { user_id } = req.params;
    
    if (!user_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'ID utilisateur requis' 
      });
    }

    if (!req.prisma) {
      logger.error('Prisma client non disponible');
      return res.status(500).json({ 
        success: false, 
        message: 'Erreur serveur: Prisma client non disponible' 
      });
    }
    
    // D'abord, vérifier si l'utilisateur est un responsable de réseau
    let networks = [];
    try {
      networks = await req.prisma.network.findMany({
        where: { responsable1_id: user_id },
        include: {
          responsable1: {
            select: {
              id: true,
              username: true,
              pseudo: true,
              image: true,
              qualification: true
            }
          }
        }
      });
    } catch (error) {
      logger.error(`Erreur lors de la récupération des réseaux pour l'utilisateur ${user_id}:`, error);
      throw error; // Relancer l'erreur pour qu'elle soit capturée par le catch principal
    }

    // Si l'utilisateur est responsable de réseau, construire l'arbre à partir des groupes
    if (networks.length > 0) {
      const allGroups = [];
      
      // Récupérer TOUS les groupes de tous les réseaux où cet utilisateur est responsable
      for (const network of networks) {
        try {
          const groups = await req.prisma.group.findMany({
            where: {
              network_id: network.id
            },
            include: {
              responsable1: {
                select: {
                  id: true,
                  username: true,
                  pseudo: true,
                  image: true,
                  qualification: true
                }
              },
              superieur_hierarchique: {
                select: {
                  id: true,
                  username: true,
                  pseudo: true,
                  image: true,
                  qualification: true
                }
              }
            }
          });
          
          // Filtrer les groupes qui ont bien un responsable1
          const validGroups = groups.filter(group => group.responsable1 && group.responsable1.id);
          allGroups.push(...validGroups);
        } catch (error) {
          logger.error(`Erreur lors de la récupération des groupes du réseau ${network.id}:`, error);
          // Continuer avec les autres réseaux
        }
      }

      // Construire l'arbre à partir des groupes (commence par les groupes où le responsable de réseau est le supérieur)
      let tree = [];
      try {
        logger.info(`Construction de l'arbre pour le responsable ${user_id} avec ${allGroups.length} groupes`);
        tree = buildTreeFromGroups(allGroups, user_id);
        logger.info(`Arbre construit avec ${tree.length} nœuds racine`);
      } catch (error) {
        logger.error(`Erreur lors de la construction de l'arbre pour le responsable ${user_id}:`, error);
        logger.error('Stack trace:', error.stack);
        // Si erreur, retourner un arbre vide avec juste le responsable
        tree = [];
      }

      // Créer le nœud racine avec le responsable de réseau
      if (!networks[0] || !networks[0].responsable1) {
        logger.error(`Responsable de réseau non trouvé pour l'utilisateur ${user_id}`);
        return res.status(404).json({ 
          success: false, 
          message: 'Responsable de réseau non trouvé' 
        });
      }

      const rootNode = {
        id: `network-responsable-${user_id}`,
        niveau: 1,
        user: {
          id: networks[0].responsable1.id,
          username: networks[0].responsable1.username || networks[0].responsable1.pseudo || 'Sans nom',
          image: networks[0].responsable1.image || null,
          qualification: networks[0].responsable1.qualification || 'RESPONSABLE_RESEAU'
        },
        children: tree
      };

      // Calculer le nombre total de nœuds (récursif)
      const countNodes = (node) => {
        if (!node) return 0;
        let count = 1;
        if (node.children && Array.isArray(node.children) && node.children.length > 0) {
          node.children.forEach(child => {
            count += countNodes(child);
          });
        }
        return count;
      };

      const totalNodes = rootNode ? countNodes(rootNode) : 1;

      logger.info(`Chaine d'impact construite pour le responsable de réseau ${user_id} avec ${totalNodes} nœuds`);
      
      return res.json({
        success: true,
        total_nodes: totalNodes,
        tree: [rootNode]
      });
    }

    // Sinon, chercher dans la table chaineImpact (comportement original)
    const chaineImpact = await req.prisma.chaineImpact.findMany({
      where: { user_id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            pseudo: true,
            image: true,
            qualification: true,
            role: true
          }
        },
        responsable: {
          select: {
            id: true,
            username: true,
            pseudo: true,
            image: true,
            qualification: true
          }
        },
        network: {
          select: {
            id: true,
            nom: true
          }
        },
        group: {
          select: {
            id: true,
            nom: true
          }
        }
      }
    });

    // Si des enregistrements existent dans chaineImpact, construire l'arbre
    if (chaineImpact.length > 0) {
      const tree = buildTree(chaineImpact);
      logger.info(`Chaine d'impact récupérée depuis la table pour l'utilisateur ${user_id}`);
      return res.json({
        success: true,
        total_nodes: chaineImpact.length,
        tree: tree
      });
    }

    // Aucune chaîne d'impact trouvée
    logger.info(`Aucune chaîne d'impact trouvée pour l'utilisateur ${user_id}`);
    return res.json({
      success: false,
      total_nodes: 0,
      tree: []
    });
  } catch (error) {
    logger.error('Erreur lors de la récupération de la chaine d\'impact utilisateur:', error);
    logger.error('Stack trace:', error.stack);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur lors de la récupération de la chaîne d\'impact',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Supprimer la chaine d'impact d'une église
const deleteChaineImpact = async (req, res) => {
  try {
    const { church_id } = req.params;
    
    await req.prisma.chaineImpact.deleteMany({
      where: { eglise_id: church_id }
    });

    logger.info(`Chaine d'impact supprimée pour l'église ${church_id}`);
    res.json({ message: 'Chaine d\'impact supprimée avec succès' });
  } catch (error) {
    logger.error('Erreur lors de la suppression de la chaine d\'impact:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

module.exports = {
  getChaineImpact,
  updateChaineImpact,
  getChaineImpactByUser,
  deleteChaineImpact
};
