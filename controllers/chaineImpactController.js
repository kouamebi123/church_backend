const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const { getNiveauFromQualification } = require('../utils/chaineImpactUtils');

const prisma = new PrismaClient();

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
    const chaineImpactNodes = await prisma.chaineImpact.findMany({
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
    const users = await prisma.user.findMany({
      where: { eglise_locale_id: church_id },
      include: {
        network_responsable1: true,
        group_responsable1: true,
        group_responsable2: true,
        group_superieur_hierarchique: true
      }
    });

    // Supprimer l'ancienne chaine d'impact
    await prisma.chaineImpact.deleteMany({
      where: { eglise_id: church_id }
    });

    const chaineImpactRecords = [];

    // Récupérer le responsable de l'église
    const responsableEglise = await prisma.church.findUnique({
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
      await prisma.chaineImpact.createMany({
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

// Récupérer la chaine d'impact d'un utilisateur spécifique
const getChaineImpactByUser = async (req, res) => {
  try {
    const { user_id } = req.params;
    
    const chaineImpact = await prisma.chaineImpact.findMany({
      where: { user_id },
      include: {
        user: true,
        responsable: true,
        eglise: true,
        network: true,
        group: true
      }
    });

    logger.info(`Chaine d'impact récupérée pour l'utilisateur ${user_id}`);
    res.json(chaineImpact);
  } catch (error) {
    logger.error('Erreur lors de la récupération de la chaine d\'impact utilisateur:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// Supprimer la chaine d'impact d'une église
const deleteChaineImpact = async (req, res) => {
  try {
    const { church_id } = req.params;
    
    await prisma.chaineImpact.deleteMany({
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
