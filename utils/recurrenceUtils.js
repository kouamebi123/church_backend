/**
 * Utilitaires pour gérer les événements récurrents
 */

/**
 * Génère les occurrences d'un événement récurrent dans une période donnée
 * @param {Object} event - L'événement récurrent
 * @param {Date} rangeStart - Début de la période
 * @param {Date} rangeEnd - Fin de la période
 * @returns {Array} Liste des occurrences
 */
function generateRecurrenceOccurrences(event, rangeStart, rangeEnd) {
  if (!event.is_recurring || !event.recurrence_type) {
    // Vérifier si l'événement simple est dans la période
    const eventStart = new Date(event.start_date);
    if (eventStart >= rangeStart && eventStart <= rangeEnd) {
      return [event];
    }
    return [];
  }

  const occurrences = [];
  const startDate = new Date(event.start_date);
  const endDate = event.end_date ? new Date(event.end_date) : null;
  const recurrenceEndDate = event.recurrence_end_date ? new Date(event.recurrence_end_date) : null;
  const interval = event.recurrence_interval || 1;

  // Déterminer la date limite (la plus proche entre recurrence_end_date et rangeEnd)
  let maxDate = new Date(rangeEnd);
  if (recurrenceEndDate && recurrenceEndDate < maxDate) {
    maxDate = recurrenceEndDate;
  }

  // Limiter le nombre d'occurrences pour éviter les boucles infinies
  const maxOccurrences = 730;
  let occurrenceCount = 0;

  // Commencer à partir de la date de début de l'événement
  let currentDate = new Date(startDate);

  while (currentDate <= maxDate && occurrenceCount < maxOccurrences) {
    // Vérifier si cette occurrence est dans la période demandée
    if (currentDate >= rangeStart && currentDate <= rangeEnd) {
      // Créer une copie de l'événement avec la nouvelle date
      const occurrence = { ...event };
      
      // Calculer la durée de l'événement original
      const duration = endDate ? endDate.getTime() - startDate.getTime() : 0;
      
      // Créer la date de début de l'occurrence avec la même heure
      const occurrenceStart = new Date(currentDate);
      occurrenceStart.setHours(startDate.getHours(), startDate.getMinutes(), startDate.getSeconds(), startDate.getMilliseconds());
      
      occurrence.start_date = occurrenceStart;
      
      if (duration > 0) {
        const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);
        occurrence.end_date = occurrenceEnd;
      }
      
      // Ajouter un identifiant unique pour cette occurrence
      occurrence.occurrence_id = `${event.id}_${occurrenceStart.toISOString()}`;
      occurrence.is_occurrence = true;
      occurrence.original_event_id = event.id;
      
      occurrences.push(occurrence);
    }

    occurrenceCount++;

    // Calculer la prochaine occurrence selon le type de récurrence
    switch (event.recurrence_type) {
      case 'DAILY':
        currentDate.setDate(currentDate.getDate() + interval);
        break;

      case 'WEEKLY':
        if (event.recurrence_days) {
          // Pour les événements hebdomadaires avec jours spécifiques
          const days = event.recurrence_days.split(',').map(d => parseInt(d));
          const nextOccurrence = getNextWeeklyOccurrence(currentDate, days, interval);
          if (!nextOccurrence) break;
          currentDate = nextOccurrence;
        } else {
          // Répétition simple hebdomadaire (même jour chaque semaine)
          currentDate.setDate(currentDate.getDate() + (7 * interval));
        }
        break;

      case 'MONTHLY':
        currentDate.setMonth(currentDate.getMonth() + interval);
        break;

      case 'YEARLY':
        currentDate.setFullYear(currentDate.getFullYear() + interval);
        break;

      default:
        return occurrences.length > 0 ? occurrences : [];
    }

    // Vérifier si on a dépassé la date limite
    if (currentDate > maxDate) {
      break;
    }
  }

  return occurrences;
}

/**
 * Calcule la prochaine occurrence pour un événement hebdomadaire avec jours spécifiques
 * @param {Date} currentDate - Date actuelle
 * @param {Array<number>} days - Jours de la semaine (0=dimanche, 1=lundi, etc.)
 * @param {number} interval - Intervalle en semaines
 * @param {Date} startDate - Date de début de l'événement original
 * @returns {Date|null} Prochaine occurrence
 */
function getNextWeeklyOccurrence(currentDate, days, interval, startDate) {
  if (!days || days.length === 0) {
    return null;
  }

  const current = new Date(currentDate);
  const currentDay = current.getDay();
  
  // Trier les jours
  const sortedDays = [...days].sort((a, b) => a - b);
  
  // Trouver le prochain jour dans la semaine actuelle
  const nextDayInWeek = sortedDays.find(day => day > currentDay);
  
  if (nextDayInWeek !== undefined) {
    // Il y a un jour plus tard dans la semaine actuelle
    const daysToAdd = nextDayInWeek - currentDay;
    current.setDate(current.getDate() + daysToAdd);
    return current;
  } else {
    // Passer à la semaine suivante (ou selon l'intervalle)
    const firstDay = sortedDays[0];
    const daysUntilNextWeek = (7 - currentDay) + firstDay + ((interval - 1) * 7);
    current.setDate(current.getDate() + daysUntilNextWeek);
    return current;
  }
}

/**
 * Expanse tous les événements récurrents d'une liste dans une période donnée
 * @param {Array} events - Liste d'événements
 * @param {Date} rangeStart - Début de la période
 * @param {Date} rangeEnd - Fin de la période
 * @returns {Array} Liste d'événements avec occurrences expansées
 */
function expandRecurringEvents(events, rangeStart, rangeEnd) {
  const expandedEvents = [];
  
  for (const event of events) {
    if (event.is_recurring) {
      const occurrences = generateRecurrenceOccurrences(event, rangeStart, rangeEnd);
      expandedEvents.push(...occurrences);
    } else {
      expandedEvents.push(event);
    }
  }
  
  // Trier par date de début
  return expandedEvents.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
}

module.exports = {
  generateRecurrenceOccurrences,
  getNextWeeklyOccurrence,
  expandRecurringEvents
};
