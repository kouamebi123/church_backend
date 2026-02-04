/**
 * Test rapide de la logique de récurrence
 */
const { expandRecurringEvents } = require('../utils/recurrenceUtils');

// Événement "tous les mardis" créé le 10 février 2026
const testEvent = {
  id: 'test-event-1',
  title: 'Réunion hebdomadaire',
  start_date: new Date('2026-02-10T10:00:00Z'), // Mardi 10 février 2026
  end_date: new Date('2026-02-10T11:00:00Z'),
  is_recurring: true,
  recurrence_type: 'MONTHLY',
  recurrence_interval: 1,
  recurrence_days: null,
  recurrence_end_date: null
};

// Période de test : tout le mois de mars 2026
const rangeStart = new Date('2026-03-01T00:00:00Z');
const rangeEnd = new Date('2026-03-31T23:59:59Z');

console.log('🧪 Test de génération d\'occurrences récurrentes\n');
console.log('📅 Événement de base :');
console.log(`   - Titre: ${testEvent.title}`);
console.log(`   - Date de début: ${testEvent.start_date.toISOString()}`);
console.log(`   - Type de récurrence: ${testEvent.recurrence_type}`);
console.log(`   - Intervalle: ${testEvent.recurrence_interval}`);
console.log(`   - Jours: ${testEvent.recurrence_days || 'tous les jours du type'}`);
console.log('\n📆 Période demandée :');
console.log(`   - Du: ${rangeStart.toISOString()}`);
console.log(`   - Au: ${rangeEnd.toISOString()}`);

const occurrences = expandRecurringEvents([testEvent], rangeStart, rangeEnd);

console.log(`\n✅ Nombre d'occurrences trouvées: ${occurrences.length}\n`);

occurrences.forEach((occ, index) => {
  console.log(`${index + 1}. ${occ.title}`);
  console.log(`   Date: ${new Date(occ.start_date).toISOString()}`);
  console.log(`   Jour: ${new Date(occ.start_date).toLocaleDateString('fr-FR', { weekday: 'long' })}`);
  console.log(`   Est une occurrence: ${occ.is_occurrence || false}`);
  console.log('');
});

if (occurrences.length === 0) {
  console.log('❌ ERREUR: Aucune occurrence trouvée alors qu\'il devrait y en avoir!');
  console.log('\n🔍 Analyse:');
  console.log(`   - Le 10 mars 2026 est un ${new Date('2026-03-10T10:00:00Z').toLocaleDateString('fr-FR', { weekday: 'long' })}`);
  console.log('   - Un événement mensuel du 10 février devrait apparaître le 10 mars');
} else {
  console.log('✅ Test réussi! Les occurrences sont générées correctement.');
}
