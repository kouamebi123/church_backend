/**
 * Tests pour le système de logging
 */

const logger = require('../../utils/logger');

describe('Logger', () => {
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

  describe('info', () => {
    test('devrait logger un message info', () => {
      const message = 'Test info message';
      logger.info(message);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });

    test('devrait logger un objet info', () => {
      const data = { userId: 123, action: 'login' };
      logger.info('User action', data);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('User action')
      );
    });
  });

  describe('error', () => {
    test('devrait logger un message d\'erreur', () => {
      const message = 'Test error message';
      logger.error(message);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]')
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });

    test('devrait logger une erreur avec stack trace', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', error);

      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]')
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error occurred')
      );
    });
  });

  describe('warn', () => {
    test('devrait logger un message d\'avertissement', () => {
      const message = 'Test warning message';
      logger.warn(message);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]')
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });
  });

  describe('debug', () => {
    test('devrait logger un message de debug', () => {
      const message = 'Test debug message';
      logger.debug(message);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining(message)
      );
    });
  });

  describe('formatMessage', () => {
    test('devrait formater un message avec timestamp', () => {
      const level = 'INFO';
      const message = 'Test message';
      const formatted = logger.formatMessage(level, message);

      expect(formatted).toContain('[INFO]');
      expect(formatted).toContain('Test message');
      expect(formatted).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    });
  });
});
