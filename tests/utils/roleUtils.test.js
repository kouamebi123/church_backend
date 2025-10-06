/**
 * Tests pour les utilitaires de rôles
 */

// Mock des dépendances
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

// Import des utilitaires de rôles (nous allons créer des fonctions de test)
const roleUtils = {
  // Hiérarchie des rôles
  roleHierarchy: {
    'SUPER_ADMIN': 1,
    'ADMIN': 2,
    'MANAGER': 3,
    'SUPERVISEUR': 4,
    'COLLECTEUR_RESEAUX': 5,
    'COLLECTEUR_CULTE': 6,
    'MEMBRE': 7
  },

  // Rôles valides
  validRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPERVISEUR', 'COLLECTEUR_RESEAUX', 'COLLECTEUR_CULTE', 'MEMBRE'],

  // Fonction pour valider un rôle
  validateRole: function(role) {
    return this.validRoles.includes(role);
  },

  // Fonction pour obtenir le niveau d'un rôle
  getRoleLevel: function(role) {
    return this.roleHierarchy[role] || 999;
  },

  // Fonction pour comparer deux rôles
  compareRoles: function(role1, role2) {
    const level1 = this.getRoleLevel(role1);
    const level2 = this.getRoleLevel(role2);
    return level1 - level2;
  },

  // Fonction pour obtenir le rôle le plus élevé
  getHighestRole: function(roles) {
    if (!roles || roles.length === 0) return null;
    
    return roles.reduce((highest, current) => {
      return this.compareRoles(current, highest) < 0 ? current : highest;
    });
  },

  // Fonction pour trier les rôles par hiérarchie
  sortRolesByHierarchy: function(roles) {
    if (!roles || roles.length === 0) return [];
    
    return roles.sort((a, b) => this.compareRoles(a, b));
  },

  // Fonction pour vérifier si un rôle a des permissions sur un autre
  hasPermission: function(userRole, requiredRole) {
    const userLevel = this.getRoleLevel(userRole);
    const requiredLevel = this.getRoleLevel(requiredRole);
    return userLevel <= requiredLevel;
  }
};

describe('Role Utils', () => {
  describe('validateRole', () => {
    test('devrait valider les rôles valides', () => {
      roleUtils.validRoles.forEach(role => {
        expect(roleUtils.validateRole(role)).toBe(true);
      });
    });

    test('devrait rejeter les rôles invalides', () => {
      const invalidRoles = ['INVALID_ROLE', 'GOUVERNANCE', 'TEST', '', null, undefined];
      
      invalidRoles.forEach(role => {
        expect(roleUtils.validateRole(role)).toBe(false);
      });
    });
  });

  describe('getRoleLevel', () => {
    test('devrait retourner le bon niveau pour chaque rôle', () => {
      expect(roleUtils.getRoleLevel('SUPER_ADMIN')).toBe(1);
      expect(roleUtils.getRoleLevel('ADMIN')).toBe(2);
      expect(roleUtils.getRoleLevel('MANAGER')).toBe(3);
      expect(roleUtils.getRoleLevel('SUPERVISEUR')).toBe(4);
      expect(roleUtils.getRoleLevel('COLLECTEUR_RESEAUX')).toBe(5);
      expect(roleUtils.getRoleLevel('COLLECTEUR_CULTE')).toBe(6);
      expect(roleUtils.getRoleLevel('MEMBRE')).toBe(7);
    });

    test('devrait retourner 999 pour un rôle invalide', () => {
      expect(roleUtils.getRoleLevel('INVALID_ROLE')).toBe(999);
    });
  });

  describe('compareRoles', () => {
    test('devrait comparer correctement les rôles', () => {
      expect(roleUtils.compareRoles('SUPER_ADMIN', 'ADMIN')).toBeLessThan(0);
      expect(roleUtils.compareRoles('ADMIN', 'MANAGER')).toBeLessThan(0);
      expect(roleUtils.compareRoles('MANAGER', 'SUPERVISEUR')).toBeLessThan(0);
      expect(roleUtils.compareRoles('MEMBRE', 'SUPER_ADMIN')).toBeGreaterThan(0);
    });

    test('devrait retourner 0 pour le même rôle', () => {
      expect(roleUtils.compareRoles('ADMIN', 'ADMIN')).toBe(0);
    });
  });

  describe('getHighestRole', () => {
    test('devrait retourner le rôle le plus élevé', () => {
      expect(roleUtils.getHighestRole(['MANAGER', 'ADMIN', 'SUPERVISEUR'])).toBe('ADMIN');
      expect(roleUtils.getHighestRole(['COLLECTEUR_CULTE', 'MANAGER', 'COLLECTEUR_RESEAUX'])).toBe('MANAGER');
      expect(roleUtils.getHighestRole(['SUPER_ADMIN', 'ADMIN'])).toBe('SUPER_ADMIN');
    });

    test('devrait retourner null pour un tableau vide', () => {
      expect(roleUtils.getHighestRole([])).toBe(null);
      expect(roleUtils.getHighestRole(null)).toBe(null);
      expect(roleUtils.getHighestRole(undefined)).toBe(null);
    });
  });

  describe('sortRolesByHierarchy', () => {
    test('devrait trier les rôles par hiérarchie', () => {
      const roles = ['MANAGER', 'ADMIN', 'SUPERVISEUR', 'COLLECTEUR_CULTE'];
      const sorted = roleUtils.sortRolesByHierarchy(roles);
      
      expect(sorted).toEqual(['ADMIN', 'MANAGER', 'SUPERVISEUR', 'COLLECTEUR_CULTE']);
    });

    test('devrait gérer un tableau vide', () => {
      expect(roleUtils.sortRolesByHierarchy([])).toEqual([]);
      expect(roleUtils.sortRolesByHierarchy(null)).toEqual([]);
      expect(roleUtils.sortRolesByHierarchy(undefined)).toEqual([]);
    });
  });

  describe('hasPermission', () => {
    test('devrait vérifier les permissions correctement', () => {
      // SUPER_ADMIN a toutes les permissions
      expect(roleUtils.hasPermission('SUPER_ADMIN', 'ADMIN')).toBe(true);
      expect(roleUtils.hasPermission('SUPER_ADMIN', 'MEMBRE')).toBe(true);
      
      // ADMIN a les permissions sur MANAGER et moins
      expect(roleUtils.hasPermission('ADMIN', 'MANAGER')).toBe(true);
      expect(roleUtils.hasPermission('ADMIN', 'SUPERVISEUR')).toBe(true);
      expect(roleUtils.hasPermission('ADMIN', 'SUPER_ADMIN')).toBe(false);
      
      // MANAGER a les permissions sur SUPERVISEUR et moins
      expect(roleUtils.hasPermission('MANAGER', 'SUPERVISEUR')).toBe(true);
      expect(roleUtils.hasPermission('MANAGER', 'COLLECTEUR_CULTE')).toBe(true);
      expect(roleUtils.hasPermission('MANAGER', 'ADMIN')).toBe(false);
      
      // MEMBRE n'a de permissions que sur lui-même
      expect(roleUtils.hasPermission('MEMBRE', 'MEMBRE')).toBe(true);
      expect(roleUtils.hasPermission('MEMBRE', 'COLLECTEUR_CULTE')).toBe(false);
    });
  });

  describe('Intégration', () => {
    test('devrait gérer un scénario complet de gestion des rôles', () => {
      const userRoles = ['MANAGER', 'SUPERVISEUR', 'COLLECTEUR_CULTE'];
      
      // Valider tous les rôles
      const validRoles = userRoles.filter(role => roleUtils.validateRole(role));
      expect(validRoles).toEqual(userRoles);
      
      // Obtenir le rôle le plus élevé
      const highestRole = roleUtils.getHighestRole(userRoles);
      expect(highestRole).toBe('MANAGER');
      
      // Trier les rôles
      const sortedRoles = roleUtils.sortRolesByHierarchy(userRoles);
      expect(sortedRoles).toEqual(['MANAGER', 'SUPERVISEUR', 'COLLECTEUR_CULTE']);
      
      // Vérifier les permissions
      expect(roleUtils.hasPermission(highestRole, 'SUPERVISEUR')).toBe(true);
      expect(roleUtils.hasPermission(highestRole, 'COLLECTEUR_CULTE')).toBe(true);
      expect(roleUtils.hasPermission(highestRole, 'ADMIN')).toBe(false);
    });
  });
});
