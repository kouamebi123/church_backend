/**
 * Tests simples pour le gestionnaire d'erreurs
 */

const errorHandler = require('../../utils/errorHandler');

describe('ErrorHandler - Tests Simples', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleError - Fonction principale', () => {
    test('devrait exister et être une fonction', () => {
      expect(typeof errorHandler.handleError).toBe('function');
    });

    test('devrait gérer une erreur Prisma P2002 (contrainte unique)', () => {
      const prismaError = {
        code: 'P2002',
        meta: {
          target: ['email']
        }
      };

      errorHandler.handleError(prismaError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalled();
    });

    test('devrait gérer une erreur Prisma P2003 (clé étrangère)', () => {
      const prismaError = {
        code: 'P2003',
        meta: {
          field_name: 'eglise_locale_id'
        }
      };

      errorHandler.handleError(prismaError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalled();
    });

    test('devrait gérer une erreur JWT', () => {
      const jwtError = {
        name: 'JsonWebTokenError',
        message: 'invalid token'
      };

      errorHandler.handleError(jwtError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalled();
    });

    test('devrait gérer une erreur JWT expirée', () => {
      const jwtError = {
        name: 'TokenExpiredError',
        message: 'jwt expired'
      };

      errorHandler.handleError(jwtError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalled();
    });

    test('devrait gérer une erreur générique', () => {
      const genericError = new Error('Erreur générique');

      errorHandler.handleError(genericError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalled();
    });
  });

  describe('Fonctions utilitaires', () => {
    test('devrait avoir une fonction handlePrismaError', () => {
      expect(typeof errorHandler.handlePrismaError).toBe('function');
    });

    test('devrait avoir une fonction handleJWTError', () => {
      expect(typeof errorHandler.handleJWTError).toBe('function');
    });

    test('devrait avoir une fonction handleValidationError', () => {
      expect(typeof errorHandler.handleValidationError).toBe('function');
    });

    test('devrait avoir une fonction logError', () => {
      expect(typeof errorHandler.logError).toBe('function');
    });
  });

  describe('Codes d\'erreur Prisma', () => {
    test('devrait avoir les codes d\'erreur Prisma définis', () => {
      expect(errorHandler.PRISMA_ERROR_CODES).toBeDefined();
      expect(errorHandler.PRISMA_ERROR_CODES.P2002).toBe('CONSTRAINT_VIOLATION');
      expect(errorHandler.PRISMA_ERROR_CODES.P2003).toBe('FOREIGN_KEY_CONSTRAINT');
      expect(errorHandler.PRISMA_ERROR_CODES.P2025).toBe('RECORD_NOT_FOUND');
    });
  });
});
