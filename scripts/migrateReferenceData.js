/**
 * Script de migration des données de référence
 * Remplit les tables Speaker, ServiceType, TestimonyCategoryConfig, EventTypeConfig
 * avec les valeurs des constantes existantes
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Types de culte depuis TYPES_CULTE_OPTIONS (sans "Tous")
const SERVICE_TYPES = [
  { nom: 'Culte 1', description: 'Premier culte de la semaine' },
  { nom: 'Culte 2', description: 'Deuxième culte de la semaine' },
  { nom: 'Culte 3', description: 'Troisième culte de la semaine' },
  { nom: 'Culte de prière', description: 'Culte dédié à la prière' },
  { nom: 'Culte spécial', description: 'Culte avec un thème ou événement spécial' },
  { nom: 'Culte de jeûne', description: 'Culte accompagné d\'un jeûne' },
  { nom: 'Autre', description: 'Autre type de culte' }
];

// Catégories de témoignage depuis l'enum TestimonyCategory
const TESTIMONY_CATEGORIES = [
  { code: 'INTIMACY', nom: 'Intimité', description: 'Témoignages sur l\'intimité avec Dieu' },
  { code: 'LEADERSHIP', nom: 'Leadership', description: 'Témoignages sur le leadership' },
  { code: 'HEALING', nom: 'Guérison', description: 'Témoignages de guérison' },
  { code: 'PROFESSIONAL', nom: 'Professionnel', description: 'Témoignages professionnels' },
  { code: 'BUSINESS', nom: 'Business', description: 'Témoignages d\'affaires' },
  { code: 'FINANCES', nom: 'Finances', description: 'Témoignages financiers' },
  { code: 'DELIVERANCE', nom: 'Délivrance', description: 'Témoignages de délivrance' },
  { code: 'FAMILY', nom: 'Famille', description: 'Témoignages familiaux' }
];

// Types d'événement depuis l'enum EventType
const EVENT_TYPES = [
  { code: 'GENERAL', nom: 'Général', description: 'Événement général' },
  { code: 'CULTE', nom: 'Culte', description: 'Culte ou service religieux' },
  { code: 'REUNION', nom: 'Réunion', description: 'Réunion de groupe ou d\'équipe' },
  { code: 'FORMATION', nom: 'Formation', description: 'Session de formation' },
  { code: 'EVANGELISATION', nom: 'Évangélisation', description: 'Événement d\'évangélisation' },
  { code: 'SOCIAL', nom: 'Social', description: 'Événement social' },
  { code: 'JEUNESSE', nom: 'Jeunesse', description: 'Événement pour les jeunes' },
  { code: 'ENFANTS', nom: 'Enfants', description: 'Événement pour les enfants' },
  { code: 'FEMMES', nom: 'Femmes', description: 'Événement pour les femmes' },
  { code: 'HOMMES', nom: 'Hommes', description: 'Événement pour les hommes' },
  { code: 'AUTRE', nom: 'Autre', description: 'Autre type d\'événement' }
];

async function migrateServiceTypes() {
  console.log('📋 Migration des types de culte...');
  
  for (const serviceType of SERVICE_TYPES) {
    try {
      // Vérifier si le type existe déjà
      const existing = await prisma.serviceType.findUnique({
        where: { nom: serviceType.nom }
      });

      if (!existing) {
        await prisma.serviceType.create({
          data: {
            nom: serviceType.nom,
            description: serviceType.description,
            active: true
          }
        });
        console.log(`  ✅ Créé: ${serviceType.nom}`);
      } else {
        console.log(`  ⏭️  Déjà existant: ${serviceType.nom}`);
      }
    } catch (error) {
      console.error(`  ❌ Erreur pour ${serviceType.nom}:`, error.message);
    }
  }
  
  console.log('✅ Migration des types de culte terminée\n');
}

async function migrateTestimonyCategories() {
  console.log('📋 Migration des catégories de témoignage...');
  
  for (const category of TESTIMONY_CATEGORIES) {
    try {
      // Vérifier si la catégorie existe déjà
      const existing = await prisma.testimonyCategoryConfig.findUnique({
        where: { code: category.code }
      });

      if (!existing) {
        await prisma.testimonyCategoryConfig.create({
          data: {
            code: category.code,
            nom: category.nom,
            description: category.description,
            active: true
          }
        });
        console.log(`  ✅ Créé: ${category.nom} (${category.code})`);
      } else {
        console.log(`  ⏭️  Déjà existant: ${category.nom} (${category.code})`);
      }
    } catch (error) {
      console.error(`  ❌ Erreur pour ${category.nom}:`, error.message);
    }
  }
  
  console.log('✅ Migration des catégories de témoignage terminée\n');
}

async function migrateEventTypes() {
  console.log('📋 Migration des types d\'événement...');
  
  for (const eventType of EVENT_TYPES) {
    try {
      // Vérifier si le type existe déjà
      const existing = await prisma.eventTypeConfig.findUnique({
        where: { code: eventType.code }
      });

      if (!existing) {
        await prisma.eventTypeConfig.create({
          data: {
            code: eventType.code,
            nom: eventType.nom,
            description: eventType.description,
            active: true
          }
        });
        console.log(`  ✅ Créé: ${eventType.nom} (${eventType.code})`);
      } else {
        console.log(`  ⏭️  Déjà existant: ${eventType.nom} (${eventType.code})`);
      }
    } catch (error) {
      console.error(`  ❌ Erreur pour ${eventType.nom}:`, error.message);
    }
  }
  
  console.log('✅ Migration des types d\'événement terminée\n');
}

async function main() {
  console.log('🚀 Début de la migration des données de référence\n');
  
  try {
    // Vérifier la connexion à la base de données
    await prisma.$connect();
    console.log('✅ Connexion à la base de données établie\n');
    
    await migrateServiceTypes();
    await migrateTestimonyCategories();
    await migrateEventTypes();
    
    console.log('✨ Migration terminée avec succès !');
    
    // Afficher un résumé
    try {
      const serviceTypesCount = await prisma.serviceType.count();
      const testimonyCategoriesCount = await prisma.testimonyCategoryConfig.count();
      const eventTypesCount = await prisma.eventTypeConfig.count();
      
      console.log('\n📊 Résumé:');
      console.log(`  - Types de culte: ${serviceTypesCount}`);
      console.log(`  - Catégories de témoignage: ${testimonyCategoriesCount}`);
      console.log(`  - Types d'événement: ${eventTypesCount}`);
      
      if (serviceTypesCount === 0 && testimonyCategoriesCount === 0 && eventTypesCount === 0) {
        console.log('\n⚠️  ATTENTION: Toutes les tables sont vides !');
        console.log('   Cela peut indiquer un problème avec la connexion à la base de données.');
      }
    } catch (countError) {
      console.error('⚠️  Erreur lors du comptage des données:', countError.message);
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    if (error.message && error.message.includes('DATABASE_URL')) {
      console.error('⚠️  La variable d\'environnement DATABASE_URL n\'est pas définie.');
      console.error('   Sur Railway, cette variable est définie automatiquement.');
    }
    throw error;
  } finally {
    try {
      await prisma.$disconnect();
      console.log('\n✅ Connexion fermée');
    } catch (disconnectError) {
      console.error('⚠️  Erreur lors de la fermeture de la connexion:', disconnectError.message);
    }
  }
}

// Exécuter le script
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Script terminé');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Erreur fatale:', error);
      process.exit(1);
    });
}

module.exports = { main, migrateServiceTypes, migrateTestimonyCategories, migrateEventTypes };

