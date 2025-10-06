// Fonction utilitaire pour calculer le niveau à partir de la qualification
const getNiveauFromQualification = (qualification) => {
  const qualificationLevels = {
    'RESPONSABLE_EGLISE': 0,    // Niveau 0 = Responsable d'église (SOMMET)
    'RESPONSABLE_RESEAU': 1,    // Niveau 1 = Responsable de réseau
    'QUALIFICATION_12': 2,      // Niveau 2 = Responsable de GR (12)
    'QUALIFICATION_144': 3,     // Niveau 3 = Responsable de GR (144)
    'QUALIFICATION_1728': 4,    // Niveau 4 = Responsable de GR (1728)
    'QUALIFICATION_20738': 5,   // Niveau 5 = Responsable de GR (20738)
    'QUALIFICATION_248832': 6   // Niveau 6 = Responsable de GR (248832)
  };
  
  return qualificationLevels[qualification] || 0;
};

// Fonction utilitaire pour obtenir le nom du niveau
const getNiveauName = (niveau) => {
  const niveauNames = {
    0: 'Responsable d\'église',
    1: 'Responsable de réseau',
    2: 'Responsable de GR (12)',
    3: 'Responsable de GR (144)',
    4: 'Responsable de GR (1728)',
    5: 'Responsable de GR (20738)',
    6: 'Responsable de GR (248832)'
  };
  
  return niveauNames[niveau] || `Niveau ${niveau}`;
};

module.exports = {
  getNiveauFromQualification,
  getNiveauName
};
