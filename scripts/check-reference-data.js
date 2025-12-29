/**
 * Script de diagnostic pour vérifier les données de référence
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    console.log('🔍 Vérification des données de référence...\n');
    
    await prisma.$connect();
    console.log('✅ Connexion à la base de données établie\n');
    
    // Vérifier les orateurs
    try {
      const speakers = await prisma.speaker.findMany();
      console.log(`📊 Orateurs: ${speakers.length} trouvés`);
      if (speakers.length > 0) {
        console.log('   Exemples:', speakers.slice(0, 3).map(s => s.nom).join(', '));
      } else {
        console.log('   ⚠️  Aucun orateur trouvé !');
      }
    } catch (error) {
      console.error('   ❌ Erreur lors de la vérification des orateurs:', error.message);
    }
    
    // Vérifier les types de culte
    try {
      const serviceTypes = await prisma.serviceType.findMany();
      console.log(`📊 Types de culte: ${serviceTypes.length} trouvés`);
      if (serviceTypes.length > 0) {
        console.log('   Exemples:', serviceTypes.slice(0, 3).map(s => s.nom).join(', '));
      } else {
        console.log('   ⚠️  Aucun type de culte trouvé !');
      }
    } catch (error) {
      console.error('   ❌ Erreur lors de la vérification des types de culte:', error.message);
    }
    
    // Vérifier les catégories de témoignage
    try {
      const testimonyCategories = await prisma.testimonyCategoryConfig.findMany();
      console.log(`📊 Catégories de témoignage: ${testimonyCategories.length} trouvées`);
    } catch (error) {
      console.error('   ❌ Erreur lors de la vérification des catégories:', error.message);
    }
    
    // Vérifier les types d'événement
    try {
      const eventTypes = await prisma.eventTypeConfig.findMany();
      console.log(`📊 Types d'événement: ${eventTypes.length} trouvés`);
    } catch (error) {
      console.error('   ❌ Erreur lors de la vérification des types d\'événement:', error.message);
    }
    
    console.log('\n✅ Vérification terminée');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });

