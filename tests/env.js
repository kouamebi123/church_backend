// Variables d'environnement pour les tests
process.env.NODE_ENV = 'test';
process.env.PORT = 5002;
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.DATABASE_URL = 'postgresql://test_user:test_password@localhost:5432/church_test';
process.env.LOG_LEVEL = 'error'; // Réduire les logs pendant les tests

// Désactiver les logs pendant les tests
process.env.DISABLE_LOGS = 'true';
