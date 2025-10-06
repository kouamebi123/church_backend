const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { createUserRoleAssignment } = require('../utils/roleAssignment');
require('dotenv').config();

const prisma = new PrismaClient();

async function createSuperAdmin() {
  try {
    console.log('🔧 Création du super admin et de l\'église temporaire...');
    
    // Vérifier si un super admin existe déjà
    const existingSuperAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    });

    if (existingSuperAdmin) {
      console.log('✅ Un super admin existe déjà:', existingSuperAdmin.email);
      return;
    }

    // Récupérer les informations depuis les variables d'environnement
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'emmanuel.bikouame@gmail.com';
    const superAdminUsername = process.env.SUPER_ADMIN_USERNAME || 'manu99';
    const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin2024!';
    const superAdminPseudo = process.env.SUPER_ADMIN_PSEUDO || 'Super Admin';
    const superAdminPhone = process.env.SUPER_ADMIN_PHONE || '+0775778652';

    // Créer l'église temporaire d'abord
    console.log('🏛️  Création de l\'église temporaire...');
    const tempChurch = await prisma.church.create({
      data: {
        nom: process.env.TEMP_CHURCH_NAME || 'Église Temporaire',
        adresse: process.env.TEMP_CHURCH_ADDRESS || 'Adresse temporaire',
        ville: process.env.TEMP_CHURCH_CITY || 'Paris',
        pays: process.env.TEMP_CHURCH_COUNTRY || 'France',
        description: 'Église temporaire pour l\'administration du système',
        is_active: true
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
        current_role: null, // Sera défini par défaut sur le rôle principal
        pseudo: superAdminPseudo,
        profession: 'Administrateur',
        genre: 'HOMME',
        tranche_age: '30-40',
        ville_residence: 'Paris',
        origine: 'France',
        situation_matrimoniale: 'Célibataire',
        niveau_education: 'Universitaire',
        qualification: 'EN_INTEGRATION',
        telephone: superAdminPhone,
        adresse: 'Adresse administrative',
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

    console.log('✅ Super admin créé avec succès:');
    console.log('📧 Email:', superAdmin.email);
    console.log('👤 Username:', superAdmin.username);
    console.log('🔑 Mot de passe temporaire:', superAdminPassword);
    console.log('🏛️  Église assignée:', tempChurch.nom);
    console.log('🎭 Rôle assigné: SUPER_ADMIN');
    console.log('⚠️  IMPORTANT: Changez le mot de passe après la première connexion!');
    
  } catch (error) {
    console.error('❌ Erreur lors de la création du super admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
createSuperAdmin();
