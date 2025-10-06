const authMiddleware = require('../../middlewares/auth');
const jwt = require('jsonwebtoken');
const { createTestRequest, createTestResponse } = require('../utils/testHelpers');

// Mock JWT
jest.mock('jsonwebtoken');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = createTestRequest();
    res = createTestResponse();
    next = jest.fn();

    // Reset des mocks
    jest.clearAllMocks();
  });

  describe('Protect Route', () => {
    it('devrait passer au middleware suivant si le token est valide', () => {
      // Arrange
      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        role: 'user'
      };

      req.headers = {
        authorization: 'Bearer valid-token'
      };

      // Mock JWT verify
      jwt.verify.mockReturnValue(mockUser);

      // Act
      authMiddleware.protect(req, res, next);

      // Assert
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', process.env.JWT_SECRET);
      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('devrait retourner 401 si aucun token n\'est fourni', () => {
      // Arrange
      req.headers = {};

      // Act
      authMiddleware.protect(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Accès non autorisé, token manquant'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('devrait retourner 401 si le token est invalide', () => {
      // Arrange
      req.headers = {
        authorization: 'Bearer invalid-token'
      };

      // Mock JWT verify - token invalide
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act
      authMiddleware.protect(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Accès non autorisé, token invalide'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Authorize Roles', () => {
    it('devrait passer au middleware suivant si l\'utilisateur a le bon rôle', () => {
      // Arrange
      req.user = { role: 'admin' };

      // Act
      authMiddleware.authorize('admin')(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('devrait passer au middleware suivant si l\'utilisateur a un des rôles autorisés', () => {
      // Arrange
      req.user = { role: 'manager' };

      // Act
      authMiddleware.authorize('admin', 'manager')(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('devrait retourner 403 si l\'utilisateur n\'a pas le bon rôle', () => {
      // Arrange
      req.user = { role: 'user' };

      // Act
      authMiddleware.authorize('admin')(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Accès refusé : permissions insuffisantes pour cette action'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('devrait retourner 401 si aucun utilisateur n\'est connecté', () => {
      // Arrange
      req.user = null;

      // Act
      authMiddleware.authorize('admin')(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Utilisateur non authentifié'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
