/**
 * Tests backend pour le système de rôles et de contrôle d'accès
 * 
 * Ce fichier contient les tests d'intégration pour valider :
 * - Les API de gestion des rôles
 * - Les restrictions d'accès par rôle
 * - La synchronisation des données utilisateur
 * - Les permissions multi-rôles
 */

const request = require('supertest');
const app = require('../server');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

describe('Système de Rôles - Tests Backend', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Créer un utilisateur de test avec plusieurs rôles
  testUser = await prisma.user.create({
    data: {
      username: 'testuser_roles',
      email: 'testuser_roles@example.com',
      password: 'password123',
      role: 'MANAGER',
      current_role: null,
      pseudo: 'Test User Roles',
      profession: 'Test',
      genre: 'HOMME',
      tranche_age: '25-35',
      ville_residence: 'Test City',
      origine: 'Test Country',
      situation_matrimoniale: 'Célibataire',
      niveau_education: 'Universitaire',
      qualification: 'EN_INTEGRATION',
      eglise_locale: {
        connect: {
          id: 'cmfas41300000tuke15q5qm1e' // ID d'une église existante
        }
      }
    }
  });

    // Créer des assignations de rôles multiples
    await prisma.userRoleAssignment.createMany({
      data: [
        { user_id: testUser.id, role: 'MANAGER', is_active: true },
        { user_id: testUser.id, role: 'SUPERVISEUR', is_active: true },
        { user_id: testUser.id, role: 'COLLECTEUR_CULTE', is_active: true }
      ]
    });

    // Connexion pour obtenir le token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testuser_roles',
        password: 'password123'
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    // Nettoyer les données de test
    await prisma.userRoleAssignment.deleteMany({
      where: { user_id: testUser.id }
    });
    await prisma.user.delete({
      where: { id: testUser.id }
    });
    await prisma.$disconnect();
  });

  describe('API de Changement de Rôle', () => {
    it('devrait permettre de changer de rôle vers un rôle autorisé', async () => {
      const response = await request(app)
        .post('/api/roles/change-role')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ role: 'SUPERVISEUR' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.current_role).toBe('SUPERVISEUR');
      expect(response.body.data.available_roles).toContain('SUPERVISEUR');
    });

    it('devrait refuser de changer vers un rôle non autorisé', async () => {
      const response = await request(app)
        .post('/api/roles/change-role')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ role: 'ADMIN' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('accès');
    });

    it('devrait retourner les rôles disponibles', async () => {
      const response = await request(app)
        .get('/api/roles/available-roles')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.available_roles).toEqual(
        expect.arrayContaining(['MANAGER', 'SUPERVISEUR', 'COLLECTEUR_CULTE'])
      );
    });
  });

  describe('API de Gestion des Rôles (Admin)', () => {
    let adminUser;
    let adminToken;

    beforeAll(async () => {
      // Créer un utilisateur admin pour les tests
    adminUser = await prisma.user.create({
      data: {
        username: 'admin_test',
        email: 'admin_test@example.com',
        password: 'password123',
        role: 'ADMIN',
        pseudo: 'Admin Test',
        profession: 'Test',
        genre: 'HOMME',
        tranche_age: '25-35',
        ville_residence: 'Test City',
        origine: 'Test Country',
        situation_matrimoniale: 'Célibataire',
        niveau_education: 'Universitaire',
        qualification: 'EN_INTEGRATION',
        eglise_locale_id: 'test-church-id'
      }
    });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin_test',
          password: 'password123'
        });

      adminToken = loginResponse.body.token;
    });

    afterAll(async () => {
      await prisma.user.delete({
        where: { id: adminUser.id }
      });
    });

    it('devrait permettre d\'attribuer plusieurs rôles à un utilisateur', async () => {
      const response = await request(app)
        .post('/api/roles/assign-multiple')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          userId: testUser.id,
          roles: ['MANAGER', 'SUPERVISEUR', 'COLLECTEUR_RESEAUX']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.assigned_roles).toEqual(
        expect.arrayContaining(['MANAGER', 'SUPERVISEUR', 'COLLECTEUR_RESEAUX'])
      );
    });

    it('devrait retourner les rôles d\'un utilisateur', async () => {
      const response = await request(app)
        .get(`/api/roles/user/${testUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user_id).toBe(testUser.id);
      expect(response.body.data.assigned_roles).toBeDefined();
    });
  });

  describe('Synchronisation des Données Utilisateur', () => {
    it('devrait retourner les données utilisateur mises à jour après changement de rôle', async () => {
      // Changer de rôle
      await request(app)
        .post('/api/roles/change-role')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ role: 'COLLECTEUR_CULTE' });

      // Vérifier que getMe retourne les bonnes données
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.current_role).toBe('COLLECTEUR_CULTE');
      expect(response.body.data.available_roles).toEqual(
        expect.arrayContaining(['MANAGER', 'SUPERVISEUR', 'COLLECTEUR_CULTE'])
      );
    });
  });

  describe('Restrictions d\'Accès par Rôle', () => {
    it('devrait autoriser l\'accès aux pages selon le rôle', async () => {
      // Tester l'accès avec le rôle MANAGER
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const user = response.body.data;
      expect(user.current_role || user.role).toBe('COLLECTEUR_CULTE');
    });

    it('devrait bloquer l\'accès aux utilisateurs MEMBRE', async () => {
      // Créer un utilisateur MEMBRE
      const membreUser = await prisma.user.create({
        data: {
          username: 'membre_test',
          email: 'membre_test@example.com',
          password: 'password123',
          role: 'MEMBRE',
          pseudo: 'Membre Test',
          genre: 'M',
          tranche_age: '25-35'
        }
      });

      // Tenter de se connecter
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'membre_test',
          password: 'password123'
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('accès non autorisé');

      // Nettoyer
      await prisma.user.delete({
        where: { id: membreUser.id }
      });
    });
  });

  describe('Validation des Données', () => {
    it('devrait valider les rôles lors de l\'attribution', async () => {
      const response = await request(app)
        .post('/api/roles/assign-multiple')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: testUser.id,
          roles: ['INVALID_ROLE', 'MANAGER']
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('rôle invalide');
    });

    it('devrait valider les permissions pour les actions admin', async () => {
      const response = await request(app)
        .post('/api/roles/assign-multiple')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: testUser.id,
          roles: ['MANAGER']
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('permissions');
    });
  });
});

// Tests de performance pour le système de rôles
describe('Performance du Système de Rôles', () => {
  it('devrait répondre rapidement aux requêtes de changement de rôle', async () => {
    const startTime = Date.now();
    
    await request(app)
      .post('/api/roles/change-role')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ role: 'MANAGER' });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // La réponse devrait être rapide (moins de 1 seconde)
    expect(responseTime).toBeLessThan(1000);
  });

  it('devrait gérer efficacement les utilisateurs avec de nombreux rôles', async () => {
    // Créer un utilisateur avec beaucoup de rôles
    const multiRoleUser = await prisma.user.create({
      data: {
        username: 'multirole_test',
        email: 'multirole_test@example.com',
        password: 'password123',
        role: 'MANAGER',
        pseudo: 'Multi Role Test',
        profession: 'Test',
        genre: 'HOMME',
        tranche_age: '25-35',
        ville_residence: 'Test City',
        origine: 'Test Country',
        situation_matrimoniale: 'Célibataire',
        niveau_education: 'Universitaire',
        qualification: 'EN_INTEGRATION',
        eglise_locale_id: 'test-church-id'
      }
    });

    // Attribuer plusieurs rôles
    const roles = ['MANAGER', 'SUPERVISEUR', 'COLLECTEUR_CULTE', 'COLLECTEUR_RESEAUX'];
    await prisma.userRoleAssignment.createMany({
      data: roles.map(role => ({
        user_id: multiRoleUser.id,
        role,
        is_active: true
      }))
    });

    const startTime = Date.now();
    
    const response = await request(app)
      .get('/api/roles/available-roles')
      .set('Authorization', `Bearer ${authToken}`);
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    expect(response.status).toBe(200);
    expect(responseTime).toBeLessThan(500); // Moins de 500ms
    
    // Nettoyer
    await prisma.userRoleAssignment.deleteMany({
      where: { user_id: multiRoleUser.id }
    });
    await prisma.user.delete({
      where: { id: multiRoleUser.id }
    });
  });
});
