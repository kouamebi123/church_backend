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
    'METHOD:PUBLISH'
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
    lines.push(`DTSTART:${formatDateToICS(startDate)}`);

    if (endDate && !Number.isNaN(endDate.valueOf())) {
      lines.push(`DTEND:${formatDateToICS(endDate)}`);
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

