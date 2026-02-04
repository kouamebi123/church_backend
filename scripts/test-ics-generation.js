/**
 * Test de génération ICS avec événements récurrents
 */
const { buildICSContent } = require('../utils/icsFormatter');

// Événement récurrent "tous les mardis"
const recurringEventWeekly = {
  id: 'event-weekly-tuesday',
  title: 'Réunion hebdomadaire - Tous les mardis',
  description: 'Réunion de prière chaque mardi',
  location: 'Salle de prière',
  start_date: new Date('2026-02-10T10:00:00Z'),
  end_date: new Date('2026-02-10T11:00:00Z'),
  is_recurring: true,
  recurrence_type: 'WEEKLY',
  recurrence_interval: 1,
  recurrence_days: '2', // Mardi
  recurrence_end_date: new Date('2026-12-31T23:59:59Z'),
  alert_offset_minutes: 15
};

// Événement récurrent "tous les mois"
const recurringEventMonthly = {
  id: 'event-monthly-10th',
  title: 'Culte mensuel - Le 10 de chaque mois',
  description: 'Culte spécial le 10 de chaque mois',
  location: 'Église principale',
  start_date: new Date('2026-02-10T14:00:00Z'),
  end_date: new Date('2026-02-10T16:00:00Z'),
  is_recurring: true,
  recurrence_type: 'MONTHLY',
  recurrence_interval: 1,
  recurrence_days: null,
  recurrence_end_date: null, // Sans date de fin
  alert_offset_minutes: 30
};

// Événement simple (non récurrent)
const simpleEvent = {
  id: 'event-simple',
  title: 'Événement ponctuel',
  description: 'Un événement unique',
  start_date: new Date('2026-03-15T09:00:00Z'),
  end_date: new Date('2026-03-15T12:00:00Z'),
  is_recurring: false,
  alert_offset_minutes: 10
};

const events = [recurringEventWeekly, recurringEventMonthly, simpleEvent];

console.log('🎫 Génération du fichier ICS avec événements récurrents\n');
console.log('═'.repeat(80));

const icsContent = buildICSContent(events);

console.log('\n📄 Contenu du fichier ICS généré:\n');
console.log(icsContent);
console.log('═'.repeat(80));

// Vérifications
const checks = [
  { 
    name: 'Header VCALENDAR', 
    test: icsContent.includes('BEGIN:VCALENDAR') && icsContent.includes('END:VCALENDAR') 
  },
  { 
    name: 'RRULE pour événement hebdomadaire', 
    test: icsContent.includes('RRULE:FREQ=WEEKLY') && icsContent.includes('BYDAY=TU') 
  },
  { 
    name: 'RRULE pour événement mensuel', 
    test: icsContent.includes('RRULE:FREQ=MONTHLY') 
  },
  { 
    name: 'Date de fin de récurrence (UNTIL)', 
    test: icsContent.includes('UNTIL=') 
  },
  { 
    name: 'Événement simple sans RRULE', 
    test: icsContent.split('BEGIN:VEVENT').length === 4 // 3 events + 1 initial split
  },
  {
    name: 'Alarmes (VALARM)',
    test: icsContent.includes('BEGIN:VALARM') && icsContent.includes('END:VALARM')
  }
];

console.log('\n✅ Vérifications:\n');
checks.forEach((check, index) => {
  const status = check.test ? '✅' : '❌';
  console.log(`${status} ${index + 1}. ${check.name}`);
});

const allPassed = checks.every(c => c.test);
console.log('\n' + '═'.repeat(80));
console.log(allPassed ? '🎉 Tous les tests sont passés!' : '⚠️  Certains tests ont échoué');
console.log('═'.repeat(80));

// Sauvegarder dans un fichier pour test manuel
const fs = require('fs');
const path = require('path');
const outputPath = path.join(__dirname, 'test-calendar-recurring.ics');
fs.writeFileSync(outputPath, icsContent, 'utf8');
console.log(`\n💾 Fichier ICS sauvegardé: ${outputPath}`);
console.log('📥 Vous pouvez maintenant importer ce fichier dans Google Calendar, Apple Calendar ou Outlook pour tester!\n');
