const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function removeResponsableEcodim() {
  try {
    console.log('🔄 Suppression de RESPONSABLE_ECODIM du système...');

    // 1. Compter les utilisateurs avec RESPONSABLE_ECODIM
    const count = await prisma.user.count({
      where: { qualification: 'RESPONSABLE_ECODIM' }
    });

    console.log(`📊 ${count} utilisateur(s) trouvé(s) avec RESPONSABLE_ECODIM`);

    if (count > 0) {
      // 2. Lister les utilisateurs concernés
      const users = await prisma.user.findMany({
        where: { qualification: 'RESPONSABLE_ECODIM' },
        select: { id: true, username: true, qualification: true }
      });

      console.log('👥 Utilisateurs concernés :');
      users.forEach(user => {
        console.log(`   - ${user.username} (ID: ${user.id})`);
      });

      // 3. Mettre à jour leur qualification vers ECODIM
      await prisma.user.updateMany({
        where: { qualification: 'RESPONSABLE_ECODIM' },
        data: { qualification: 'ECODIM' }
      });

      console.log('✅ Tous les utilisateurs RESPONSABLE_ECODIM ont été mis à jour vers ECODIM');
    }

    // 4. Supprimer RESPONSABLE_ECODIM de l'enum (si possible)
    try {
      await prisma.$executeRaw`ALTER TYPE "Qualification" DROP VALUE IF EXISTS 'RESPONSABLE_ECODIM'`;
      console.log('✅ RESPONSABLE_ECODIM supprimé de l\'enum Qualification');
    } catch (error) {
      console.log('⚠️ Impossible de supprimer RESPONSABLE_ECODIM de l\'enum (peut-être déjà supprimé)');
    }

    console.log('🎉 Suppression de RESPONSABLE_ECODIM terminée avec succès !');

  } catch (error) {
    console.error('❌ Erreur lors de la suppression de RESPONSABLE_ECODIM:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
if (require.main === module) {
  removeResponsableEcodim()
    .then(() => {
      console.log('✅ Script terminé avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur:', error);
      process.exit(1);
    });
}

module.exports = { removeResponsableEcodim };
