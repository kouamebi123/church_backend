const bcrypt = require('bcryptjs');
const { createUserRoleAssignment } = require('../utils/roleAssignment');
require('dotenv').config();

/**
 * Créer un super admin d'urgence
 * Ne fonctionne que si aucun super admin n'existe dans la base
 */
const createEmergencySuperAdmin = async (req, res) => {
  try {
    // Vérifier si un super admin existe déjà
    const existingSuperAdmin = await req.prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    });

    if (existingSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Un super admin existe déjà dans le système'
      });
    }

    // Utiliser les variables d'environnement ou les données de la requête
    const email = req.body.email || process.env.SUPER_ADMIN_EMAIL || 'emmanuel.bikouame@gmail.com';
    const username = req.body.username || process.env.SUPER_ADMIN_USERNAME || 'Emmanuel KOUAME';
    const password = req.body.password || process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin2024!';
    const pseudo = req.body.pseudo || process.env.SUPER_ADMIN_PSEUDO || 'manu99';
    const phone = req.body.phone || process.env.SUPER_ADMIN_PHONE || '+0775778652';

    // Vérifier que l'email n'existe pas déjà
    const existingUser = await req.prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Un utilisateur avec cet email existe déjà'
      });
    }

    // Créer l'église temporaire d'abord
    const tempChurch = await req.prisma.church.create({
      data: {
        nom: process.env.TEMP_CHURCH_NAME || 'Église Temporaire',
        adresse: process.env.TEMP_CHURCH_ADDRESS || 'Adresse temporaire',
        ville: process.env.TEMP_CHURCH_CITY || 'Paris',
        pays: process.env.TEMP_CHURCH_COUNTRY || 'France',
        description: 'Église temporaire pour l\'administration du système',
        is_active: true
      }
    });

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);

    // Créer le super admin
    const superAdmin = await req.prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        pseudo,
        genre: 'M',
        tranche_age: '30-40',
        profession: 'Administrateur',
        ville_residence: 'Paris',
        origine: 'France',
        situation_matrimoniale: 'Célibataire',
        niveau_education: 'Universitaire',
        telephone: phone,
        adresse: 'Adresse administrative',
        is_active: true,
        email_verified: true,
        eglise_locale_id: tempChurch.id
      }
    });

    // Créer les assignations de rôles multiples pour le super admin
    const roles = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPERVISEUR', 'COLLECTEUR_CULTE', 'COLLECTEUR_RESEAUX', 'MEMBRE'];
    
    for (const role of roles) {
      await createUserRoleAssignment(superAdmin.id, role);
    }
    
    console.log('✅ Rôles assignés au super admin d\'urgence:', roles.join(', '));

    // Ne pas retourner le mot de passe
    const { password: _, ...userWithoutPassword } = superAdmin;

    res.status(201).json({
      success: true,
      message: 'Super admin et église temporaire créés avec succès',
      data: {
        user: userWithoutPassword,
        church: {
          id: tempChurch.id,
          nom: tempChurch.nom,
          adresse: tempChurch.adresse,
          ville: tempChurch.ville,
          pays: tempChurch.pays
        }
      }
    });

  } catch (error) {
    // console.error('Erreur lors de la création du super admin d\'urgence:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};

module.exports = {
  createEmergencySuperAdmin
};
