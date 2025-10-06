// Utilitaires pour les tests
const jwt = require('jsonwebtoken');

/**
 * Crée un utilisateur de test avec un token JWT.
 * @param role
 * @param eglise_locale
 * @example
 */
const createTestUser = (role = 'user', eglise_locale = null) => {
  const user = {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    role,
    eglise_locale
  };

  const token = jwt.sign(user, process.env.JWT_SECRET);

  return { user, token };
};

/**
 * Crée une requête de test.
 * @param data
 * @param user
 * @example
 */
const createTestRequest = (data = {}, user = null) => {
  const req = {
    body: data,
    params: {},
    query: {},
    user,
    file: null
  };

  return req;
};

/**
 * Crée une réponse de test.
 * @example
 */
const createTestResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis()
  };

  return res;
};

/**
 * Crée un groupe de test.
 * @param overrides
 * @example
 */
const createTestGroup = (overrides = {}) => ({
  id: 'test-group-id',
  nom: 'Groupe Test',
  network: 'test-network-id',
  responsable1: 'test-responsable1-id',
  responsable2: 'test-responsable2-id',
  members: ['test-member1-id', 'test-member2-id'],
  membersHistory: [],
  ...overrides
});

/**
 * Crée une église de test.
 * @param overrides
 * @example
 */
const createTestChurch = (overrides = {}) => ({
  id: 'test-church-id',
  nom: 'Église Test',
  adresse: '123 Rue Test',
  ville: 'Ville Test',
  latitude: 48.8566,
  longitude: 2.3522,
  population: 1000,
  type: 'eglise',
  ...overrides
});

/**
 * Crée un réseau de test.
 * @param overrides
 * @example
 */
const createTestNetwork = (overrides = {}) => ({
  id: 'test-network-id',
  nom: 'Réseau Test',
  church: 'test-church-id',
  responsable1: 'test-responsable1-id',
  responsable2: 'test-responsable2-id',
  ...overrides
});

/**
 * Crée un service de test.
 * @param overrides
 * @example
 */
const createTestService = (overrides = {}) => ({
  id: 'test-service-id',
  date: new Date(),
  total_adultes: 50,
  total_enfants: 20,
  eglise: 'test-church-id',
  collecteur_culte: 'test-collecteur-id',
  superviseur: 'test-superviseur-id',
  ...overrides
});

/**
 * Vérifie qu'une réponse a le bon statut et format.
 * @param res
 * @param statusCode
 * @example
 */
const expectSuccessResponse = (res, statusCode = 200) => {
  expect(res.status).toHaveBeenCalledWith(statusCode);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      success: true,
      data: expect.any(Object)
    })
  );
};

/**
 * Vérifie qu'une réponse d'erreur a le bon format.
 * @param res
 * @param statusCode
 * @example
 */
const expectErrorResponse = (res, statusCode = 400) => {
  expect(res.status).toHaveBeenCalledWith(statusCode);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      success: false,
      message: expect.any(String)
    })
  );
};

/**
 * Mock Prisma avec des données de test.
 * @param prisma
 * @param data
 * @example
 */
const mockPrismaWithData = (prisma, data) => {
  Object.keys(data).forEach(model => {
    if (prisma[model]) {
      Object.keys(data[model]).forEach(method => {
        if (prisma[model][method]) {
          prisma[model][method].mockResolvedValue(data[model][method]);
        }
      });
    }
  });
};

module.exports = {
  createTestUser,
  createTestRequest,
  createTestResponse,
  createTestGroup,
  createTestChurch,
  createTestNetwork,
  createTestService,
  expectSuccessResponse,
  expectErrorResponse,
  mockPrismaWithData
};
