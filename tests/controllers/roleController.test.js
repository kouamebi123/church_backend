/**
 * Tests pour le contrôleur des rôles
 */

// Mock des dépendances avant d'importer le contrôleur
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn()
    },
    userRoleAssignment: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn()
    }
  }))
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const roleController = require('../../controllers/roleController');
const { PrismaClient } = require('@prisma/client');

describe('RoleController', () => {
  let mockPrisma;
  let req, res;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    req = {
      user: { id: 'user-123', role: 'ADMIN' },
      body: {},
      params: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('changeRole', () => {
    test('devrait changer le rôle de l\'utilisateur avec succès', async () => {
      req.body = { role: 'MANAGER' };
      
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'ADMIN',
        role_assignments: [
          { role: 'ADMIN', is_active: true },
          { role: 'MANAGER', is_active: true }
        ]
      });

      mockPrisma.user.update.mockResolvedValue({
        id: 'user-123',
        role: 'ADMIN',
        current_role: 'MANAGER'
      });

      await roleController.changeRole(req, res);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        include: { role_assignments: true }
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { current_role: 'MANAGER' }
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Rôle changé avec succès',
        current_role: 'MANAGER'
      });
    });

    test('devrait retourner une erreur si le rôle n\'est pas assigné', async () => {
      req.body = { role: 'INVALID_ROLE' };
      
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'ADMIN',
        role_assignments: [
          { role: 'ADMIN', is_active: true }
        ]
      });

      await roleController.changeRole(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Rôle non assigné à cet utilisateur'
      });
    });

    test('devrait retourner une erreur si l\'utilisateur n\'existe pas', async () => {
      req.body = { role: 'MANAGER' };
      
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await roleController.changeRole(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    });
  });

  describe('getAvailableRoles', () => {
    test('devrait retourner les rôles disponibles pour l\'utilisateur', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        role: 'ADMIN',
        role_assignments: [
          { role: 'ADMIN', is_active: true },
          { role: 'MANAGER', is_active: true },
          { role: 'SUPERVISEUR', is_active: true }
        ]
      });

      await roleController.getAvailableRoles(req, res);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        include: { role_assignments: true }
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        roles: ['ADMIN', 'MANAGER', 'SUPERVISEUR']
      });
    });

    test('devrait retourner une erreur si l\'utilisateur n\'existe pas', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await roleController.getAvailableRoles(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    });
  });

  describe('assignMultipleRoles', () => {
    test('devrait assigner plusieurs rôles à un utilisateur', async () => {
      req.body = {
        userId: 'user-456',
        roles: ['MANAGER', 'SUPERVISEUR', 'COLLECTEUR_CULTE']
      };

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-456',
        role: 'MANAGER'
      });

      mockPrisma.userRoleAssignment.deleteMany.mockResolvedValue({});
      mockPrisma.userRoleAssignment.createMany.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-456',
        role: 'MANAGER',
        current_role: 'MANAGER'
      });

      await roleController.assignMultipleRoles(req, res);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-456' }
      });

      expect(mockPrisma.userRoleAssignment.deleteMany).toHaveBeenCalledWith({
        where: { user_id: 'user-456' }
      });

      expect(mockPrisma.userRoleAssignment.createMany).toHaveBeenCalledWith({
        data: [
          { user_id: 'user-456', role: 'MANAGER', is_active: true },
          { user_id: 'user-456', role: 'SUPERVISEUR', is_active: true },
          { user_id: 'user-456', role: 'COLLECTEUR_CULTE', is_active: true }
        ]
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Rôles assignés avec succès',
        assigned_roles: ['MANAGER', 'SUPERVISEUR', 'COLLECTEUR_CULTE'],
        primary_role: 'MANAGER'
      });
    });

    test('devrait retourner une erreur si l\'utilisateur n\'existe pas', async () => {
      req.body = {
        userId: 'user-456',
        roles: ['MANAGER']
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await roleController.assignMultipleRoles(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    });

    test('devrait retourner une erreur si des rôles sont invalides', async () => {
      req.body = {
        userId: 'user-456',
        roles: ['INVALID_ROLE', 'MANAGER']
      };

      await roleController.assignMultipleRoles(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Rôles invalides: INVALID_ROLE'
      });
    });
  });

  describe('getUserRoles', () => {
    test('devrait retourner les rôles d\'un utilisateur', async () => {
      req.params = { userId: 'user-456' };

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-456',
        username: 'testuser',
        role: 'MANAGER',
        current_role: 'SUPERVISEUR',
        role_assignments: [
          { role: 'MANAGER', is_active: true },
          { role: 'SUPERVISEUR', is_active: true }
        ]
      });

      await roleController.getUserRoles(req, res);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-456' },
        include: { role_assignments: true }
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        user_id: 'user-456',
        username: 'testuser',
        primary_role: 'MANAGER',
        current_role: 'SUPERVISEUR',
        assigned_roles: ['MANAGER', 'SUPERVISEUR']
      });
    });

    test('devrait retourner une erreur si l\'utilisateur n\'existe pas', async () => {
      req.params = { userId: 'user-456' };

      mockPrisma.user.findUnique.mockResolvedValue(null);

      await roleController.getUserRoles(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    });
  });
});
