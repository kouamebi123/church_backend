/**
 * Tests pour les fonctions de validation
 */

const validation = require('../../utils/validation');

describe('Validation Utils', () => {
  describe('validateEmail', () => {
    test('devrait valider un email correct', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'admin@church.org',
        'test+tag@example.com'
      ];

      validEmails.forEach(email => {
        expect(validation.validateEmail(email)).toBe(true);
      });
    });

    test('devrait rejeter un email invalide', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'test@',
        'test.example.com',
        '',
        null,
        undefined
      ];

      invalidEmails.forEach(email => {
        expect(validation.validateEmail(email)).toBe(false);
      });
    });
  });

  describe('validatePassword', () => {
    test('devrait valider un mot de passe fort', () => {
      const strongPasswords = [
        'Password123!',
        'MySecure@Pass2024',
        'Church#Admin99'
      ];

      strongPasswords.forEach(password => {
        expect(validation.validatePassword(password)).toBe(true);
      });
    });

    test('devrait rejeter un mot de passe faible', () => {
      const weakPasswords = [
        '123456',
        'password',
        'PASSWORD',
        'Pass1',
        '',
        null
      ];

      weakPasswords.forEach(password => {
        expect(validation.validatePassword(password)).toBe(false);
      });
    });
  });

  describe('validatePhone', () => {
    test('devrait valider un numéro de téléphone français', () => {
      const validPhones = [
        '0123456789',
        '01 23 45 67 89',
        '+33123456789',
        '06 12 34 56 78'
      ];

      validPhones.forEach(phone => {
        expect(validation.validatePhone(phone)).toBe(true);
      });
    });

    test('devrait rejeter un numéro de téléphone invalide', () => {
      const invalidPhones = [
        '123',
        'abc',
        '01-23-45-67-89',
        '',
        null
      ];

      invalidPhones.forEach(phone => {
        expect(validation.validatePhone(phone)).toBe(false);
      });
    });
  });

  describe('validateRole', () => {
    test('devrait valider les rôles valides', () => {
      const validRoles = [
        'SUPER_ADMIN',
        'ADMIN',
        'MANAGER',
        'SUPERVISEUR',
        'COLLECTEUR_RESEAUX',
        'COLLECTEUR_CULTE',
        'MEMBRE'
      ];

      validRoles.forEach(role => {
        expect(validation.validateRole(role)).toBe(true);
      });
    });

    test('devrait rejeter les rôles invalides', () => {
      const invalidRoles = [
        'INVALID_ROLE',
        'GOUVERNANCE',
        'TEST',
        '',
        null,
        undefined
      ];

      invalidRoles.forEach(role => {
        expect(validation.validateRole(role)).toBe(false);
      });
    });
  });

  describe('validateGenre', () => {
    test('devrait valider les genres valides', () => {
      const validGenres = ['HOMME', 'FEMME', 'ENFANT'];

      validGenres.forEach(genre => {
        expect(validation.validateGenre(genre)).toBe(true);
      });
    });

    test('devrait rejeter les genres invalides', () => {
      const invalidGenres = [
        'MALE',
        'FEMALE',
        'OTHER',
        '',
        null,
        undefined
      ];

      invalidGenres.forEach(genre => {
        expect(validation.validateGenre(genre)).toBe(false);
      });
    });
  });

  describe('sanitizeInput', () => {
    test('devrait nettoyer une chaîne de caractères', () => {
      const input = '<script>alert("xss")</script>Hello World';
      const sanitized = validation.sanitizeInput(input);

      expect(sanitized).toBe('Hello World');
      expect(sanitized).not.toContain('<script>');
    });

    test('devrait gérer les chaînes vides', () => {
      expect(validation.sanitizeInput('')).toBe('');
      expect(validation.sanitizeInput(null)).toBe('');
      expect(validation.sanitizeInput(undefined)).toBe('');
    });
  });

  describe('validateUserData', () => {
    test('devrait valider des données utilisateur complètes', () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123!',
        pseudo: 'Test User',
        profession: 'Test',
        genre: 'HOMME',
        tranche_age: '25-35',
        ville_residence: 'Test City',
        origine: 'Test Country',
        situation_matrimoniale: 'Célibataire',
        niveau_education: 'Universitaire'
      };

      const result = validation.validateUserData(userData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('devrait détecter des données utilisateur invalides', () => {
      const invalidUserData = {
        username: '',
        email: 'invalid-email',
        password: 'weak',
        pseudo: '',
        profession: '',
        genre: 'INVALID',
        tranche_age: '',
        ville_residence: '',
        origine: '',
        situation_matrimoniale: '',
        niveau_education: ''
      };

      const result = validation.validateUserData(invalidUserData);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
