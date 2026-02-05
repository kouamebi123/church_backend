/**
 * Génère la règle RRULE pour un événement récurrent
 * @param {Object} event - Événement récurrent
 * @returns {string|null} RRULE au format iCalendar
 */
const buildRRule = (event) => {
  if (!event.is_recurring || !event.recurrence_type) {
    return null;
  }

  const parts = [];

  // Fréquence
  const freqMap = {
    'DAILY': 'DAILY',
    'WEEKLY': 'WEEKLY',
    'MONTHLY': 'MONTHLY',
    'YEARLY': 'YEARLY'
  };
  const freq = freqMap[event.recurrence_type];
  if (!freq) return null;

  parts.push(`FREQ=${freq}`);

  // Intervalle
  const interval = event.recurrence_interval || 1;
  if (interval > 1) {
    parts.push(`INTERVAL=${interval}`);
  }

  // Jours de la semaine (pour WEEKLY)
  if (event.recurrence_type === 'WEEKLY' && event.recurrence_days) {
    const dayMap = {
      '0': 'SU', // Dimanche
      '1': 'MO', // Lundi
      '2': 'TU', // Mardi
      '3': 'WE', // Mercredi
      '4': 'TH', // Jeudi
      '5': 'FR', // Vendredi
      '6': 'SA'  // Samedi
    };

    const days = event.recurrence_days
      .split(',')
      .map(d => dayMap[d.trim()])
      .filter(Boolean);

    if (days.length > 0) {
      parts.push(`BYDAY=${days.join(',')}`);
    }
  }

  // Date de fin de récurrence
  if (event.recurrence_end_date) {
    const endDate = new Date(event.recurrence_end_date);
    if (!Number.isNaN(endDate.valueOf())) {
      // UNTIL doit être en UTC et se terminer par Z
      parts.push(`UNTIL=${formatDateToICS(endDate)}`);
    }
  }

  return `RRULE:${parts.join(';')}`;
};

const escapeText = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
};

const formatDateToICS = (date) => {
  if (!(date instanceof Date)) {
    return '';
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
};

/**
 * Formate une date en heure locale pour un TZ donné (ex: Europe/Paris) au format ICS (sans Z)
 * en utilisant Intl.DateTimeFormat pour respecter correctement les règles d'heure d'été/hiver.
 * @param {Date} date - Date source (souvent en UTC dans la base)
 * @param {string} timeZone - Identifiant de fuseau IANA (ex: 'Europe/Paris')
 * @returns {string} Chaîne formatée YYYYMMDDTHHMMSS
 */
const formatDateToICSLTZ = (date, timeZone) => {
  if (!(date instanceof Date)) {
    return '';
  }

  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = dtf.formatToParts(date).reduce((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});

  const year = parts.year;
  const month = parts.month;
  const day = parts.day;
  const hour = parts.hour;
  const minute = parts.minute;
  const second = parts.second;

  return `${year}${month}${day}T${hour}${minute}${second}`;
};

/**
 * Bloc VTIMEZONE pour Europe/Paris (CET/CEST)
 */
const buildVTimezoneEuropeParis = () => `BEGIN:VTIMEZONE\nTZID:Europe/Paris\nX-LIC-LOCATION:Europe/Paris\nBEGIN:DAYLIGHT\nTZOFFSETFROM:+0100\nTZOFFSETTO:+0200\nTZNAME:CEST\nDTSTART:19700329T020000\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\nEND:DAYLIGHT\nBEGIN:STANDARD\nTZOFFSETFROM:+0200\nTZOFFSETTO:+0100\nTZNAME:CET\nDTSTART:19701025T030000\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\nEND:STANDARD\nEND:VTIMEZONE`;

/**
 * Construit le contenu ICS pour une liste d'événements du calendrier.
 * @param {Array} events - Événements issus de Prisma.
 * @returns {string} Contenu ICS.
 */
exports.buildICSContent = (events = []) => {
  const nowStamp = formatDateToICS(new Date());

  const lines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//ACER Church Platform//FR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-TIMEZONE:Europe/Paris',
    buildVTimezoneEuropeParis()
  ];

  events.forEach((event) => {
    if (!event || !event.start_date) {
      return;
    }

    const startDate = new Date(event.start_date);
    if (Number.isNaN(startDate.valueOf())) {
      return;
    }

    const endDate = event.end_date ? new Date(event.end_date) : null;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${escapeText(event.id)}@acer.church`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`SUMMARY:${escapeText(event.title || 'Événement')}`);
    // Émettre en heure locale Europe/Paris avec TZID et sans suffixe Z pour conserver l'heure choisie (ex: 19:30)
    lines.push(`DTSTART;TZID=Europe/Paris:${formatDateToICSLTZ(startDate, 'Europe/Paris')}`);

    if (endDate && !Number.isNaN(endDate.valueOf())) {
      lines.push(`DTEND;TZID=Europe/Paris:${formatDateToICSLTZ(endDate, 'Europe/Paris')}`);
    }

    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }

    if (event.location) {
      lines.push(`LOCATION:${escapeText(event.location)}`);
    }

    if (event.share_link) {
      lines.push(`URL:${escapeText(event.share_link)}`);
    }

    // Ajouter la règle de récurrence si l'événement est récurrent
    const rrule = buildRRule(event);
    if (rrule) {
      lines.push(rrule);
    }

    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');

    if (event.alert_offset_minutes !== null && event.alert_offset_minutes !== undefined) {
      const safeMinutes = Math.max(0, Number(event.alert_offset_minutes) || 0);
      lines.push('BEGIN:VALARM');
      lines.push(`TRIGGER:-PT${safeMinutes}M`);
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:${escapeText(event.title || 'Rappel événement')}`);
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');

  return `${lines.join('\r\n')}\r\n`;
};

