const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Démarrage du seeding...');

  // Vérifier si la base de données est vide
  const userCount = await prisma.user.count();
  const churchCount = await prisma.church.count();
  
  console.log(`📊 État de la base de données: ${userCount} utilisateurs, ${churchCount} églises`);

  if (userCount > 0 || churchCount > 0) {
    console.log('⚠️  Base de données non vide - Seeding ignoré pour éviter la duplication');
    console.log('💡 Si vous voulez réinitialiser, utilisez: npx prisma migrate reset --force');
    return;
  }

  console.log('✅ Base de données vide - Procédure de seeding initiale...');

  // Récupérer les informations depuis les variables d'environnement
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'emmanuel.bikouame@gmail.com';
  const superAdminUsername = process.env.SUPER_ADMIN_USERNAME || 'Emmanuel KOUAME';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin2024!';
  const superAdminPseudo = process.env.SUPER_ADMIN_PSEUDO || 'manu99';
  const superAdminPhone = process.env.SUPER_ADMIN_PHONE || '0775778652';

  // Créer l'église temporaire d'abord
  console.log('🏛️  Création de l\'église temporaire...');
  const tempChurch = await prisma.church.create({
    data: {
      nom: process.env.TEMP_CHURCH_NAME || 'Église Temporaire',
      adresse: process.env.TEMP_CHURCH_ADDRESS || 'Adresse temporaire',
      ville: process.env.TEMP_CHURCH_CITY || 'Paris',
      description: 'Église temporaire pour l\'administration du système'
    }
  });

  console.log('✅ Église temporaire créée:', tempChurch.nom);

  // Créer le super admin
  console.log('👤 Création du super admin...');
  const hashedPassword = await bcrypt.hash(superAdminPassword, 12);
  
  const superAdmin = await prisma.user.create({
    data: {
      username: superAdminUsername,
      email: superAdminEmail,
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      pseudo: superAdminPseudo,
      genre: 'HOMME',
      tranche_age: '30-40',
      profession: 'Administrateur',
      ville_residence: 'Paris',
      origine: 'France',
      situation_matrimoniale: 'Célibataire',
      niveau_education: 'Universitaire',
      telephone: superAdminPhone,
      adresse: 'Adresse administrative',
      eglise_locale_id: tempChurch.id
    }
  });

  console.log('✅ Super admin créé:', superAdmin.email);
  console.log('🔑 Mot de passe temporaire:', superAdminPassword);
  console.log('🏛️  Église assignée:', tempChurch.nom);
  console.log('🎉 Seeding initial terminé avec succès !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
