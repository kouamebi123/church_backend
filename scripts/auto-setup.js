const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { createUserRoleAssignment } = require('../utils/roleAssignment');
const { clearUploadsDirectory } = require('./clear-uploads');
require('dotenv').config();

const prisma = new PrismaClient();

async function autoSetup() {
  try {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const environment = isDevelopment ? 'développement' : 'production';
    
    console.log(`🔧 Configuration automatique pour l'environnement ${environment}...`);
    
    // Nettoyer le dossier uploads
    clearUploadsDirectory();
    
    // Vérifier si un super admin existe déjà
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    });

    if (existingSuperAdmin) {
      console.log('✅ Un super admin existe déjà:', existingSuperAdmin.email);
      return;
    }

    // Récupérer les informations depuis les variables d'environnement
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || (isDevelopment ? 'dev@votre-domaine.com' : 'admin@votre-domaine.com');
    const superAdminUsername = process.env.SUPER_ADMIN_USERNAME || (isDevelopment ? 'devadmin' : 'superadmin');
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || (isDevelopment ? 'DevAdmin2024!' : 'SuperAdmin2024!');
    const superAdminPseudo = process.env.SUPER_ADMIN_PSEUDO || (isDevelopment ? 'Dev Admin' : 'Super Admin');
    const superAdminPhone = process.env.SUPER_ADMIN_PHONE || '+33123456789';

    // Configuration de l'église temporaire selon l'environnement
    const churchName = process.env.TEMP_CHURCH_NAME || (isDevelopment ? 'Église Temporaire Dev' : 'Église Temporaire');
    const churchAddress = process.env.TEMP_CHURCH_ADDRESS || (isDevelopment ? 'Adresse temporaire développement' : 'Adresse temporaire');
    const churchDescription = isDevelopment ? 'Église temporaire pour le développement du système' : 'Église temporaire pour l\'administration du système';

    // Créer l'église temporaire d'abord
    console.log('🏛️  Création de l\'église temporaire...');
    const tempChurch = await prisma.church.upsert({
      where: { nom: churchName },
      update: {},
      create: {
        nom: churchName,
        adresse: churchAddress,
        ville: process.env.TEMP_CHURCH_CITY || 'Paris',
        description: churchDescription
      }
    });

    console.log('✅ Église temporaire créée:', tempChurch.nom);

    // Créer le super admin
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
        profession: isDevelopment ? 'Développeur' : 'Administrateur',
        ville_residence: 'Paris',
        origine: 'France',
        situation_matrimoniale: 'Célibataire',
        niveau_education: 'Universitaire',
        telephone: superAdminPhone,
        adresse: isDevelopment ? 'Adresse de développement' : 'Adresse administrative',
        eglise_locale_id: tempChurch.id
      }
    });

    // Créer les assignations de rôles multiples pour le super admin
    console.log('🎭 Création des assignations de rôles...');
    const roles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPERVISEUR', 'COLLECTEUR_CULTE', 'COLLECTEUR_RESEAUX', 'MEMBRE'];
    
    for (const role of roles) {
      await createUserRoleAssignment(superAdmin.id, role);
    }
    
    console.log('✅ Rôles assignés:', roles.join(', '));

    console.log(`✅ Super admin ${environment} créé avec succès:`);
    console.log('📧 Email:', superAdmin.email);
    console.log('👤 Username:', superAdmin.username);
    console.log('🔑 Mot de passe temporaire:', superAdminPassword);
    console.log('🏛️  Église assignée:', tempChurch.nom);
    console.log('🎭 Rôle assigné: SUPER_ADMIN');
    console.log('⚠️  IMPORTANT: Changez le mot de passe après la première connexion!');
    
  } catch (error) {
    console.error('❌ Erreur lors de la configuration automatique:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
autoSetup();
