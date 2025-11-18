const logger = require('./logger');
const { getNiveauFromQualification } = require('./chaineImpactUtils');

/**
 * Reconstruit automatiquement la chaîne d'impact pour une église
 * @param {PrismaClient} prisma - Instance Prisma
 * @param {string} church_id - ID de l'église
 * @returns {Promise<void>}
 */
const rebuildChaineImpact = async (prisma, church_id) => {
  try {
    if (!church_id) {
      logger.warn('rebuildChaineImpact: church_id manquant');
      return;
    }

    logger.info(`Reconstruction de la chaîne d'impact pour l'église ${church_id}`);

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

    logger.info(`Chaîne d'impact reconstruite pour l'église ${church_id} avec ${chaineImpactRecords.length} enregistrements`);
  } catch (error) {
    logger.error(`Erreur lors de la reconstruction de la chaîne d'impact pour l'église ${church_id}:`, error);
    // Ne pas bloquer l'opération principale en cas d'erreur
    // L'erreur est loggée mais ne remonte pas
  }
};

module.exports = {
  rebuildChaineImpact
};

