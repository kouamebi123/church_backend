const { handleError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

/**
 * Construit un objet Date couvrant tout le mois demandé.
 * @param {number|string} monthIndex - Index du mois (1-12).
 * @param {number|string} yearValue - Année sur quatre chiffres.
 */
const buildMonthRange = (monthIndex, yearValue) => {
  if (!monthIndex || !yearValue) {
    return null;
  }

  const month = Number(monthIndex) - 1; // JS months start at 0
  const year = Number(yearValue);

  if (Number.isNaN(month) || Number.isNaN(year) || month < 0 || month > 11) {
    return null;
  }

  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  return { start, end };
};

const buildYearRange = (yearValue) => {
  if (yearValue === undefined || yearValue === null) {
    return null;
  }

  const year = Number(yearValue);

  if (Number.isNaN(year)) {
    return null;
  }

  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  return { start, end };
};

const normalizeBoolean = (value, defaultValue = true) => {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
  }

  return Boolean(value);
};

/**
 * Récupère les événements publics.
 */
exports.getPublicEvents = async (req, res) => {
  try {
    const { prisma } = req;
    const {
      church_id: churchId,
      churchId: churchIdAlt,
      month,
      year,
      view
    } = req.query;

    const where = {
      is_public: true
    };

    const effectiveChurchId = churchId || churchIdAlt || null;
    if (effectiveChurchId) {
      where.church_id = effectiveChurchId;
    }

    const resolvedYear = year || new Date().getFullYear();
    const monthRange = buildMonthRange(month, resolvedYear);
    const yearRange = buildYearRange(resolvedYear);

    let selectedRange = null;
    if (view === 'year' && yearRange) {
      selectedRange = yearRange;
    } else if (monthRange) {
      selectedRange = monthRange;
    } else if (yearRange) {
      selectedRange = yearRange;
    }

    if (selectedRange) {
      where.start_date = {
        gte: selectedRange.start,
        lte: selectedRange.end
      };
    }

    const events = await prisma.calendarEvent.findMany({
      where,
      orderBy: {
        start_date: 'asc'
      }
    });

    res.status(200).json({
      success: true,
      data: events
    });
  } catch (error) {
    logger.error('Calendar - getPublicEvents - Erreur complète', error);
    const { status, message } = handleError(error, 'la récupération des événements publics');
    res.status(status).json({ success: false, message });
  }
};

/**
 * Récupère les événements publics pour un mois donné (alias dédié).
 */
exports.getPublicEventsByMonth = async (req, res) => {
  try {
    const { prisma } = req;
    const { church_id: churchId, churchId: churchIdAlt, month, year } = req.query;

    const monthRange = buildMonthRange(month, year);
    if (!monthRange) {
      return res.status(400).json({
        success: false,
        message: 'Période invalide pour les événements publics.'
      });
    }

    const where = {
      is_public: true,
      start_date: {
        gte: monthRange.start,
        lte: monthRange.end
      }
    };

    const effectiveChurchId = churchId || churchIdAlt || null;
    if (effectiveChurchId) {
      where.church_id = effectiveChurchId;
    }

    const events = await prisma.calendarEvent.findMany({
      where,
      orderBy: {
        start_date: 'asc'
      }
    });

    res.status(200).json({ success: true, data: events });
  } catch (error) {
    logger.error('Calendar - getPublicEventsByMonth - Erreur complète', error);
    const { status, message } = handleError(error, 'la récupération des événements publics du mois');
    res.status(status).json({ success: false, message });
  }
};

/**
 * Récupère un événement public par identifiant.
 */
exports.getPublicEventById = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    const event = await prisma.calendarEvent.findUnique({ where: { id } });

    if (!event || !event.is_public) {
      return res.status(404).json({
        success: false,
        message: "Événement introuvable"
      });
    }

    res.status(200).json({ success: true, data: event });
  } catch (error) {
    logger.error('Calendar - getPublicEventById - Erreur complète', error);
    const { status, message } = handleError(error, "la récupération de l'événement public");
    res.status(status).json({ success: false, message });
  }
};

/**
 * Récupère les événements (dashboard/admin).
 */
exports.getEvents = async (req, res) => {
  try {
    const { prisma } = req;
    const {
      church_id: churchId,
      churchId: churchIdAlt,
      month,
      year,
      view,
      isPublic
    } = req.query;
    const effectiveChurchId = churchId || churchIdAlt || req.user?.eglise_locale || null;

    if (!effectiveChurchId) {
      return res.status(400).json({
        success: false,
        message: "L'identifiant de l'église est requis pour récupérer les événements"
      });
    }

    const where = {
      church_id: effectiveChurchId
    };

    if (typeof isPublic !== 'undefined') {
      where.is_public = normalizeBoolean(isPublic, true);
    }

    const resolvedYear = year || new Date().getFullYear();
    const monthRange = buildMonthRange(month, resolvedYear);
    const yearRange = buildYearRange(resolvedYear);

    let selectedRange = null;
    if (view === 'year' && yearRange) {
      selectedRange = yearRange;
    } else if (monthRange) {
      selectedRange = monthRange;
    } else if (yearRange) {
      selectedRange = yearRange;
    }

    if (selectedRange) {
      where.start_date = {
        gte: selectedRange.start,
        lte: selectedRange.end
      };
    }

    const events = await prisma.calendarEvent.findMany({
      where,
      orderBy: {
        start_date: 'asc'
      }
    });

    res.status(200).json({ success: true, data: events });
  } catch (error) {
    logger.error('Calendar - getEvents - Erreur complète', error);
    const { status, message } = handleError(error, 'la récupération des événements');
    res.status(status).json({ success: false, message });
  }
};

/**
 * Récupère un événement (dashboard/admin).
 */
exports.getEventById = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    const event = await prisma.calendarEvent.findUnique({ where: { id } });

    if (!event) {
      return res.status(404).json({ success: false, message: "Événement introuvable" });
    }

    if (req.user.role === 'ADMIN' && event.church_id !== req.user.eglise_locale) {
      return res.status(403).json({
        success: false,
        message: "Vous ne pouvez accéder qu'aux événements de votre église"
      });
    }

    res.status(200).json({ success: true, data: event });
  } catch (error) {
    logger.error('Calendar - getEventById - Erreur complète', error);
    const { status, message } = handleError(error, "la récupération de l'événement");
    res.status(status).json({ success: false, message });
  }
};

/**
 * Crée un événement.
 */
exports.createEvent = async (req, res) => {
  try {
    const { prisma } = req;
    const {
      title,
      description,
      start_date: startDateInput,
      end_date: endDateInput,
      location,
      event_type: eventType = 'GENERAL',
      is_public: isPublic = true,
      church_id: churchId,
      churchId: churchIdAlt
    } = req.body;

    if (!title || !startDateInput) {
      return res.status(400).json({
        success: false,
        message: 'Le titre et la date de début sont requis'
      });
    }

    const effectiveChurchId = churchId || churchIdAlt || req.user?.eglise_locale;
    if (!effectiveChurchId) {
      return res.status(400).json({
        success: false,
        message: "L'église associée à l'événement est requise"
      });
    }

    if (req.user.role === 'ADMIN' && effectiveChurchId !== req.user.eglise_locale) {
      return res.status(403).json({
        success: false,
        message: "Vous ne pouvez créer des événements que pour votre église"
      });
    }

    const startDate = new Date(startDateInput);
    const endDate = endDateInput ? new Date(endDateInput) : null;

    if (Number.isNaN(startDate.valueOf())) {
      return res.status(400).json({ success: false, message: 'Date de début invalide' });
    }

    if (endDate && Number.isNaN(endDate.valueOf())) {
      return res.status(400).json({ success: false, message: 'Date de fin invalide' });
    }

    if (endDate && endDate < startDate) {
      return res.status(400).json({
        success: false,
        message: 'La date de fin doit être postérieure à la date de début'
      });
    }

    const event = await prisma.calendarEvent.create({
      data: {
        title,
        description: description || null,
        start_date: startDate,
        end_date: endDate,
        location: location || null,
        event_type: eventType,
        is_public: normalizeBoolean(isPublic, true),
        church_id: effectiveChurchId,
        created_by_id: req.user.id
      }
    });

    logger.info('Calendar - createEvent - Événement créé', {
      eventId: event.id,
      churchId: effectiveChurchId,
      userId: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Événement créé avec succès',
      data: event
    });
  } catch (error) {
    logger.error('Calendar - createEvent - Erreur complète', error);
    const { status, message } = handleError(error, "la création de l'événement");
    res.status(status).json({ success: false, message });
  }
};

/**
 * Met à jour un événement.
 */
exports.updateEvent = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;
    const {
      title,
      description,
      start_date: startDateInput,
      end_date: endDateInput,
      location,
      event_type: eventType,
      is_public: isPublic,
      church_id: churchId,
      churchId: churchIdAlt
    } = req.body;

    const existingEvent = await prisma.calendarEvent.findUnique({ where: { id } });

    if (!existingEvent) {
      return res.status(404).json({ success: false, message: "Événement introuvable" });
    }

    if (req.user.role === 'ADMIN' && existingEvent.church_id !== req.user.eglise_locale) {
      return res.status(403).json({
        success: false,
        message: "Vous ne pouvez modifier que les événements de votre église"
      });
    }

    const effectiveChurchId = churchId || churchIdAlt || existingEvent.church_id;
    if (req.user.role === 'ADMIN' && effectiveChurchId !== req.user.eglise_locale) {
      return res.status(403).json({
        success: false,
        message: "Vous ne pouvez pas déplacer un événement vers une autre église"
      });
    }

    const startDate = startDateInput ? new Date(startDateInput) : null;
    const endDate = endDateInput ? new Date(endDateInput) : null;

    if (startDate && Number.isNaN(startDate.valueOf())) {
      return res.status(400).json({ success: false, message: 'Date de début invalide' });
    }

    if (endDate && Number.isNaN(endDate.valueOf())) {
      return res.status(400).json({ success: false, message: 'Date de fin invalide' });
    }

    const nextStartDate = startDate || existingEvent.start_date;
    const nextEndDate = endDateInput !== undefined ? endDate : existingEvent.end_date;

    if (nextEndDate && nextEndDate < nextStartDate) {
      return res.status(400).json({
        success: false,
        message: 'La date de fin doit être postérieure à la date de début'
      });
    }

    const updatedEvent = await prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(startDateInput !== undefined && { start_date: nextStartDate }),
        ...(endDateInput !== undefined && { end_date: nextEndDate }),
        ...(location !== undefined && { location }),
        ...(eventType !== undefined && { event_type: eventType }),
        ...(isPublic !== undefined && { is_public: normalizeBoolean(isPublic, existingEvent.is_public) }),
        ...(effectiveChurchId && { church_id: effectiveChurchId })
      }
    });

    logger.info('Calendar - updateEvent - Événement mis à jour', {
      eventId: updatedEvent.id,
      churchId: updatedEvent.church_id,
      userId: req.user.id
    });

    res.status(200).json({
      success: true,
      message: 'Événement mis à jour avec succès',
      data: updatedEvent
    });
  } catch (error) {
    logger.error('Calendar - updateEvent - Erreur complète', error);
    const { status, message } = handleError(error, "la mise à jour de l'événement");
    res.status(status).json({ success: false, message });
  }
};

/**
 * Supprime un événement.
 */
exports.deleteEvent = async (req, res) => {
  try {
    const { prisma } = req;
    const { id } = req.params;

    const existingEvent = await prisma.calendarEvent.findUnique({ where: { id } });

    if (!existingEvent) {
      return res.status(404).json({ success: false, message: "Événement introuvable" });
    }

    if (req.user.role === 'ADMIN' && existingEvent.church_id !== req.user.eglise_locale) {
      return res.status(403).json({
        success: false,
        message: "Vous ne pouvez supprimer que les événements de votre église"
      });
    }

    await prisma.calendarEvent.delete({ where: { id } });

    logger.info('Calendar - deleteEvent - Événement supprimé', {
      eventId: id,
      churchId: existingEvent.church_id,
      userId: req.user.id
    });

    res.status(200).json({
      success: true,
      message: 'Événement supprimé avec succès'
    });
  } catch (error) {
    logger.error('Calendar - deleteEvent - Erreur complète', error);
    const { status, message } = handleError(error, "la suppression de l'événement");
    res.status(status).json({ success: false, message });
  }
};


