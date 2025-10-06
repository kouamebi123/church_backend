/**
 * Tests simples pour le système de logging
 */

const logger = require('../../utils/logger');

describe('Logger - Tests Simples', () => {
  let originalConsoleLog;
  let originalConsoleError;
  let originalConsoleWarn;

  beforeEach(() => {
    // Sauvegarder les méthodes originales
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;

    // Mock des méthodes console
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(() => {
    // Restaurer les méthodes originales
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  describe('Méthodes de logging', () => {
    test('devrait avoir une méthode info', () => {
      expect(typeof logger.info).toBe('function');
    });

    test('devrait avoir une méthode error', () => {
      expect(typeof logger.error).toBe('function');
    });

    test('devrait avoir une méthode warn', () => {
      expect(typeof logger.warn).toBe('function');
    });

    test('devrait avoir une méthode debug', () => {
      expect(typeof logger.debug).toBe('function');
    });
  });

  describe('Fonctionnalités de base', () => {
    test('devrait logger un message info sans erreur', () => {
      expect(() => {
        logger.info('Test info message');
      }).not.toThrow();
    });

    test('devrait logger un message d\'erreur sans erreur', () => {
      expect(() => {
        logger.error('Test error message');
      }).not.toThrow();
    });

    test('devrait logger un message d\'avertissement sans erreur', () => {
      expect(() => {
        logger.warn('Test warning message');
      }).not.toThrow();
    });

    test('devrait logger un message de debug sans erreur', () => {
      expect(() => {
        logger.debug('Test debug message');
      }).not.toThrow();
    });
  });

  describe('Formatage des messages', () => {
    test('devrait formater un message avec timestamp', () => {
      const formatted = logger.formatMessage('INFO', 'Test message');
      
      expect(formatted).toContain('[INFO]');
      expect(formatted).toContain('Test message');
      expect(formatted).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('devrait formater un message avec des données', () => {
      const data = { userId: 123, action: 'login' };
      const formatted = logger.formatMessage('INFO', 'User action', data);
      
      expect(formatted).toContain('[INFO]');
      expect(formatted).toContain('User action');
      expect(formatted).toContain('"userId": 123');
    });

    test('devrait formater un message avec contexte', () => {
      const context = { module: 'auth', function: 'login' };
      const formatted = logger.formatMessage('INFO', 'Test message', null, context);
      
      expect(formatted).toContain('[INFO]');
      expect(formatted).toContain('Test message');
      expect(formatted).toContain('"module": "auth"');
    });
  });

  describe('Gestion des erreurs', () => {
    test('devrait gérer les données non sérialisables', () => {
      const circularData = {};
      circularData.self = circularData;
      
      expect(() => {
        logger.formatMessage('INFO', 'Circular data', circularData);
      }).not.toThrow();
    });

    test('devrait gérer les données null/undefined', () => {
      expect(() => {
        logger.formatMessage('INFO', 'Test', null);
        logger.formatMessage('INFO', 'Test', undefined);
      }).not.toThrow();
    });
  });

  describe('Niveaux de log', () => {
    test('devrait supporter tous les niveaux de log', () => {
      const levels = ['info', 'error', 'warn', 'debug'];
      
      levels.forEach(level => {
        expect(() => {
          logger[level]('Test message');
        }).not.toThrow();
      });
    });
  });
});
