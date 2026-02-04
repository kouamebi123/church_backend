/**
 * Test pour événement hebdomadaire "tous les mardis"
 */
const { expandRecurringEvents } = require('../utils/recurrenceUtils');

// Événement "tous les mardis" créé le 10 février 2026
const testEventWeekly = {
  id: 'test-event-weekly',
  title: 'Réunion tous les mardis',
  start_date: new Date('2026-02-10T10:00:00Z'), // Mardi 10 février 2026
  end_date: new Date('2026-02-10T11:00:00Z'),
  is_recurring: true,
  recurrence_type: 'WEEKLY',
  recurrence_interval: 1,
  recurrence_days: '2', // 2 = Mardi (0=dimanche, 1=lundi, 2=mardi, etc.)
  recurrence_end_date: null
};

// Période de test : du 1er mars au 31 mars 2026
const rangeStart = new Date('2026-03-01T00:00:00Z');
const rangeEnd = new Date('2026-03-31T23:59:59Z');

console.log('🧪 Test événement WEEKLY "tous les mardis"\n');
console.log('📅 Événement de base :');
console.log(`   - Titre: ${testEventWeekly.title}`);
console.log(`   - Date de début: ${testEventWeekly.start_date.toISOString()}`);
console.log(`   - Jour: ${testEventWeekly.start_date.toLocaleDateString('fr-FR', { weekday: 'long' })}`);
console.log(`   - Type de récurrence: ${testEventWeekly.recurrence_type}`);
console.log(`   - Intervalle: ${testEventWeekly.recurrence_interval} semaine(s)`);
console.log(`   - Jours: ${testEventWeekly.recurrence_days} (2=Mardi)`);
console.log('\n📆 Période demandée (Mars 2026) :');
console.log(`   - Du: ${rangeStart.toISOString()}`);
console.log(`   - Au: ${rangeEnd.toISOString()}`);

const occurrences = expandRecurringEvents([testEventWeekly], rangeStart, rangeEnd);

console.log(`\n✅ Nombre d'occurrences trouvées: ${occurrences.length}\n`);
console.log('🗓️  Tous les mardis de mars 2026:');

occurrences.forEach((occ, index) => {
  const date = new Date(occ.start_date);
  console.log(`${index + 1}. ${date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`);
});

// Vérification : Mars 2026 a 5 mardis (3, 10, 17, 24, 31)
const expectedTuesdays = [
  new Date('2026-03-03T10:00:00Z'),
  new Date('2026-03-10T10:00:00Z'),
  new Date('2026-03-17T10:00:00Z'),
  new Date('2026-03-24T10:00:00Z'),
  new Date('2026-03-31T10:00:00Z')
];

console.log(`\n📊 Résultat attendu: ${expectedTuesdays.length} mardis en mars 2026`);
console.log(`📊 Résultat obtenu: ${occurrences.length} occurrences`);

if (occurrences.length === expectedTuesdays.length) {
  console.log('\n✅ TEST RÉUSSI! Le bon nombre d\'occurrences a été généré.');
} else {
  console.log('\n❌ TEST ÉCHOUÉ! Nombre d\'occurrences incorrect.');
}
