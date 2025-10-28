const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addPrevisionnelAssistanceFields() {
  try {
    console.log('🔄 Ajout des colonnes responsables_reseau et compagnons_oeuvre...');

    // Ajouter les colonnes à la table previsionnels
    await prisma.$executeRaw`
      ALTER TABLE "previsionnels" 
      ADD COLUMN IF NOT EXISTS "responsables_reseau" INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "compagnons_oeuvre" INTEGER DEFAULT 0;
    `;

    // Ajouter les colonnes à la table assistance
    await prisma.$executeRaw`
      ALTER TABLE "assistance" 
      ADD COLUMN IF NOT EXISTS "responsables_reseau" INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "compagnons_oeuvre" INTEGER DEFAULT 0;
    `;

    console.log('✅ Colonnes ajoutées avec succès !');
    
    // Mettre à jour les enregistrements existants avec des valeurs par défaut
    const previsionnelsCount = await prisma.$executeRaw`
      UPDATE "previsionnels" 
      SET "responsables_reseau" = 0, "compagnons_oeuvre" = 0 
      WHERE "responsables_reseau" IS NULL OR "compagnons_oeuvre" IS NULL;
    `;

    const assistanceCount = await prisma.$executeRaw`
      UPDATE "assistance" 
      SET "responsables_reseau" = 0, "compagnons_oeuvre" = 0 
      WHERE "responsables_reseau" IS NULL OR "compagnons_oeuvre" IS NULL;
    `;

    console.log(`✅ ${previsionnelsCount} prévisionnels mis à jour`);
    console.log(`✅ ${assistanceCount} assistances mises à jour`);

  } catch (error) {
    console.error('❌ Erreur lors de l\'ajout des colonnes:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
addPrevisionnelAssistanceFields()
  .then(() => {
    console.log('🎉 Migration terminée avec succès !');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erreur lors de la migration:', error);
    process.exit(1);
  });
