const authController = require('../../controllers/authController');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createTestRequest, createTestResponse, expectSuccessResponse, expectErrorResponse } = require('../utils/testHelpers');

// Mock Prisma
const mockPrisma = new PrismaClient();

// Mock des dépendances
jest.mock('@prisma/client');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('AuthController', () => {
  let req, res;

  beforeEach(() => {
    req = createTestRequest();
    res = createTestResponse();

    // Reset des mocks
    jest.clearAllMocks();
  });

  describe('POST /register', () => {
    it('devrait créer un nouvel utilisateur avec succès', async () => {
      // Arrange
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        eglise_locale_id: 'church-123'
      };

      req.body = userData;

      // Mock Prisma
      mockPrisma.user.findFirst.mockResolvedValue(null); // Utilisateur n'existe pas
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-123',
        username: userData.username,
        email: userData.email,
        role: 'MANAGER',
        pseudo: 'Test User',
        profession: 'Test',
        genre: 'HOMME',
        tranche_age: '25-35',
        ville_residence: 'Test City',
        origine: 'Test Country',
        situation_matrimoniale: 'Célibataire',
        niveau_education: 'Universitaire',
        qualification: 'EN_INTEGRATION',
        eglise_locale_id: 'church-123'
      });

      // Mock bcrypt
      bcrypt.hash.mockResolvedValue('hashed-password');
      bcrypt.genSalt.mockResolvedValue('salt');

      // Act
      await authController.register(req, res);

      // Assert
      expectSuccessResponse(res, 201);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          username: userData.username,
          email: userData.email,
          password: 'hashed-password'
        })
      });
    });

    it('devrait retourner une erreur si l\'utilisateur existe déjà', async () => {
      // Arrange
      req.body = {
        username: 'existinguser',
        email: 'existing@example.com',
        password: 'password123'
      };

      // Mock Prisma - utilisateur existe déjà
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'existing-user',
        username: 'existinguser'
      });

      // Act
      await authController.register(req, res);

      // Assert
      expectErrorResponse(res, 400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('existe déjà')
        })
      );
    });
  });

  describe('POST /login', () => {
    it('devrait connecter un utilisateur avec succès', async () => {
      // Arrange
      req.body = {
        username: 'testuser',
        password: 'password123'
      };

      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        password: 'hashed-password',
        role: 'user'
      };

      // Mock Prisma
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      // Mock bcrypt
      bcrypt.compare.mockResolvedValue(true);

      // Mock JWT
      jwt.sign.mockReturnValue('mock-jwt-token');

      // Act
      await authController.login(req, res);

      // Assert
      expectSuccessResponse(res, 200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            token: 'mock-jwt-token',
            user: expect.objectContaining({
              id: mockUser.id,
              username: mockUser.username
            })
          })
        })
      );
    });

    it('devrait retourner une erreur si le mot de passe est incorrect', async () => {
      // Arrange
      req.body = {
        username: 'testuser',
        password: 'wrongpassword'
      };

      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        password: 'hashed-password'
      };

      // Mock Prisma
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      // Mock bcrypt - mot de passe incorrect
      bcrypt.compare.mockResolvedValue(false);

      // Act
      await authController.login(req, res);

      // Assert
      expectErrorResponse(res, 401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('mot de passe')
        })
      );
    });
  });

  describe('GET /me', () => {
    it('devrait retourner les informations de l\'utilisateur connecté', async () => {
      // Arrange
      req.user = { id: 'user-123' };

      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user'
      };

      // Mock Prisma
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      // Act
      await authController.getMe(req, res);

      // Assert
      expectSuccessResponse(res, 200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: mockUser
        })
      );
    });

    it('devrait retourner une erreur si l\'utilisateur n\'est pas trouvé', async () => {
      // Arrange
      req.user = { id: 'user-123' };

      // Mock Prisma - utilisateur non trouvé
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act
      await authController.getMe(req, res);

      // Assert
      expectErrorResponse(res, 404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('non trouvé')
        })
      );
    });
  });
});
