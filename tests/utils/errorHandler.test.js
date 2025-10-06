/**
 * Tests pour le gestionnaire d'erreurs
 */

const errorHandler = require('../../utils/errorHandler');

describe('ErrorHandler', () => {
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

  describe('handleError', () => {
    test('devrait gérer une erreur Prisma', () => {
      const prismaError = {
        code: 'P2002',
        meta: {
          target: ['email']
        }
      };

      errorHandler.handleError(prismaError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Cette adresse email est déjà utilisée'
      });
    });

    test('devrait gérer une erreur de validation Prisma', () => {
      const validationError = {
        code: 'P2003',
        meta: {
          field_name: 'eglise_locale_id'
        }
      };

      errorHandler.handleError(validationError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Référence invalide pour eglise_locale_id'
      });
    });

    test('devrait gérer une erreur de connexion Prisma', () => {
      const connectionError = {
        code: 'P1001'
      };

      errorHandler.handleError(connectionError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Erreur de connexion à la base de données'
      });
    });

    test('devrait gérer une erreur JWT', () => {
      const jwtError = {
        name: 'JsonWebTokenError',
        message: 'invalid token'
      };

      errorHandler.handleError(jwtError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token invalide'
      });
    });

    test('devrait gérer une erreur JWT expirée', () => {
      const jwtError = {
        name: 'TokenExpiredError',
        message: 'jwt expired'
      };

      errorHandler.handleError(jwtError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token expiré'
      });
    });

    test('devrait gérer une erreur de validation', () => {
      const validationError = {
        name: 'ValidationError',
        message: 'Données invalides',
        details: ['Le champ email est requis']
      };

      errorHandler.handleError(validationError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Données invalides',
        details: ['Le champ email est requis']
      });
    });

    test('devrait gérer une erreur générique', () => {
      const genericError = new Error('Erreur générique');

      errorHandler.handleError(genericError, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Erreur interne du serveur'
      });
    });
  });

  describe('notFound', () => {
    test('devrait retourner une erreur 404', () => {
      errorHandler.notFound(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Ressource non trouvée'
      });
    });
  });

  describe('asyncHandler', () => {
    test('devrait exécuter une fonction async sans erreur', async () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const wrappedFn = errorHandler.asyncHandler(asyncFn);

      await wrappedFn(mockReq, mockRes, mockNext);

      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('devrait capturer une erreur et la passer à next', async () => {
      const error = new Error('Test error');
      const asyncFn = jest.fn().mockRejectedValue(error);
      const wrappedFn = errorHandler.asyncHandler(asyncFn);

      await wrappedFn(mockReq, mockRes, mockNext);

      expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
