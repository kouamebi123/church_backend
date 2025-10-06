const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const socketService = require('../services/socketService');
const emailService = require('../services/emailService');

const prisma = new PrismaClient();

// Vérifier si l'utilisateur est admin
const isAdmin = (user) => {
  return user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
};

// Envoyer un message
const sendMessage = async (req, res) => {
  try {
    const { subject, content, recipient_ids, is_urgent = false } = req.body;
    const sender_id = req.user.id;

    // Permettre à tous les utilisateurs d'envoyer des messages (système de messagerie bidirectionnel)
    // Les restrictions peuvent être ajoutées plus tard si nécessaire

    // Validation des données
    if (!subject || !content || !recipient_ids || !Array.isArray(recipient_ids) || recipient_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Sujet, contenu et destinataires sont requis'
      });
    }

    // Vérifier que tous les destinataires existent et récupérer leurs infos pour l'email
    const recipients = await prisma.user.findMany({
      where: {
        id: { in: recipient_ids }
      },
      select: { 
        id: true, 
        pseudo: true, 
        username: true,
        email: true,
        email_notifications: true,
        eglise_locale: {
          select: { nom: true }
        }
      }
    });

    if (recipients.length !== recipient_ids.length) {
      return res.status(400).json({
        success: false,
        message: 'Un ou plusieurs destinataires n\'existent pas'
      });
    }

    // Créer le message et les destinataires en transaction
    const result = await prisma.$transaction(async (tx) => {
      // Créer le message
      const message = await tx.message.create({
        data: {
          subject,
          content,
          is_urgent,
          sender_id
        }
      });

      // Créer les destinataires
      const messageRecipients = await Promise.all(
        recipient_ids.map(recipient_id =>
          tx.messageRecipient.create({
            data: {
              message_id: message.id,
              recipient_id
            }
          })
        )
      );

      return { message, recipients: messageRecipients };
    });

    logger.info(`✅ Message envoyé par ${req.user.pseudo} à ${recipients.length} destinataire(s)`, {
      message_id: result.message.id,
      sender_id,
      recipient_count: recipients.length
    });

    // Envoyer les notifications en temps réel via Socket.IO
    const messageData = {
      id: result.message.id,
      subject: result.message.subject,
      content: result.message.content,
      is_urgent: result.message.is_urgent,
      sender: {
        id: req.user.id,
        pseudo: req.user.pseudo,
        role: req.user.role
      },
      recipients: recipients.map(r => ({
        id: r.id,
        pseudo: r.pseudo,
        role: r.role
      })),
      created_at: result.message.created_at
    };

    // Envoyer les notifications en temps réel via Socket.IO
    recipients.forEach(recipient => {
      socketService.sendMessageToUser(recipient.id, messageData);
    });

    // Envoyer les notifications par email (en arrière-plan - asynchrone)
    const sender = {
      id: req.user.id,
      pseudo: req.user.pseudo,
      username: req.user.username,
      email: req.user.email,
      eglise_locale: req.user.eglise_locale
    };

    const appUrl = process.env.APP_URL || 'http://localhost';
    const messageUrl = `${appUrl}/`; // Rediriger vers la page d'accueil

    // Exécuter l'envoi d'emails en arrière-plan sans bloquer la réponse
    setImmediate(async () => {
      try {
        // Envoyer un email à chaque destinataire qui a une adresse email ET qui a activé les notifications
        for (const recipient of recipients) {
          if (recipient.email && recipient.email_notifications) {
            try {
              await emailService.sendMessageNotification(
                recipient,
                sender,
                result.message,
                messageUrl
              );
              logger.info(`📧 Notification email envoyée à ${recipient.email}`);
            } catch (emailError) {
              logger.error(`❌ Erreur envoi email à ${recipient.email}:`, emailError);
              // Ne pas faire échouer l'envoi du message pour une erreur d'email
            }
          } else if (recipient.email && !recipient.email_notifications) {
            logger.info(`📧 Notifications email désactivées pour ${recipient.email}`);
          }
        }
      } catch (error) {
        logger.error('❌ Erreur lors de l\'envoi des notifications email:', error);
        // Ne pas faire échouer l'envoi du message pour une erreur d'email
      }
    });

    res.json({
      success: true,
      message: 'Message envoyé avec succès',
      data: {
        message: result.message,
        recipients: recipients
      }
    });

  } catch (error) {
    logger.error('❌ Erreur lors de l\'envoi du message:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi du message',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

// Récupérer les messages reçus
const getReceivedMessages = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const messages = await prisma.message.findMany({
      where: {
        recipients: {
          some: {
            recipient_id: user_id
          }
        }
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            role: true
          }
        },
        recipients: {
          where: {
            recipient_id: user_id
          },
          include: {
            recipient: {
              select: {
                id: true,
                username: true,
                role: true
              }
            }
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      skip,
      take: parseInt(limit)
    });

    const total = await prisma.message.count({
      where: {
        recipients: {
          some: {
            recipient_id: user_id
          }
        }
      }
    });

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la récupération des messages reçus:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des messages reçus',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

// Récupérer les messages envoyés
const getSentMessages = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const messages = await prisma.message.findMany({
      where: {
        sender_id: user_id
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            role: true
          }
        },
        recipients: {
          include: {
            recipient: {
              select: {
                id: true,
                username: true,
                role: true
              }
            }
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      skip,
      take: parseInt(limit)
    });

    const total = await prisma.message.count({
      where: {
        sender_id: user_id
      }
    });

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la récupération des messages envoyés:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des messages envoyés',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

// Marquer plusieurs messages comme lus en une seule requête
const markMultipleAsRead = async (req, res) => {
  try {
    const { messageIds } = req.body;
    const user_id = req.user.id;

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Liste de messages invalide'
      });
    }

    // Marquer tous les messages comme lus en une seule requête
    const result = await prisma.messageRecipient.updateMany({
      where: {
        message_id: {
          in: messageIds
        },
        recipient_id: user_id,
        is_read: false
      },
      data: {
        is_read: true,
        read_at: new Date()
      }
    });

    logger.info(`✅ ${result.count} messages marqués comme lus par ${req.user.pseudo}`, {
      message_count: result.count,
      user_id
    });

    // Envoyer notification en temps réel pour chaque message
    messageIds.forEach(messageId => {
      socketService.sendMessageReadNotification(user_id, {
        messageId,
        timestamp: new Date().toISOString()
      });
    });

    res.json({
      success: true,
      message: `${result.count} messages marqués comme lus`,
      count: result.count
    });

  } catch (error) {
    logger.error('❌ Erreur lors du marquage multiple:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du marquage des messages'
    });
  }
};

// Marquer un message comme lu
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    // Chercher d'abord par ID de MessageRecipient, puis par ID de Message
    let messageRecipient = await prisma.messageRecipient.findFirst({
      where: {
        id,
        recipient_id: user_id
      }
    });

    // Si pas trouvé par ID de MessageRecipient, chercher par ID de Message
    if (!messageRecipient) {
      messageRecipient = await prisma.messageRecipient.findFirst({
        where: {
          message_id: id,
          recipient_id: user_id
        }
      });
    }

    if (!messageRecipient) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    // Marquer comme lu si ce n'est pas déjà fait
    if (!messageRecipient.is_read) {
      await prisma.messageRecipient.update({
        where: { id: messageRecipient.id },
        data: {
          is_read: true,
          read_at: new Date()
        }
      });

      logger.info(`✅ Message marqué comme lu par ${req.user.pseudo}`, {
        message_recipient_id: messageRecipient.id,
        message_id: messageRecipient.message_id,
        user_id
      });

      // Envoyer notification en temps réel
      socketService.sendMessageReadNotification(user_id, {
        messageId: messageRecipient.message_id,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Message marqué comme lu'
    });

  } catch (error) {
    logger.error('❌ Erreur lors du marquage comme lu:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du marquage du message',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

// Accuser réception d'un message
const acknowledgeMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    // Chercher le MessageRecipient
    const messageRecipient = await prisma.messageRecipient.findFirst({
      where: {
        message_id: id,
        recipient_id: user_id
      }
    });

    if (!messageRecipient) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé'
      });
    }

    // Accuser réception si ce n'est pas déjà fait
    if (!messageRecipient.acknowledged) {
      await prisma.messageRecipient.update({
        where: { id: messageRecipient.id },
        data: {
          acknowledged: true,
          acknowledged_at: new Date()
        }
      });

      logger.info(`✅ Message accusé de réception par ${req.user.pseudo}`, {
        message_recipient_id: messageRecipient.id,
        message_id: id,
        user_id
      });

      // Envoyer notification en temps réel
      socketService.sendMessageAcknowledgedNotification(user_id, {
        messageId: id,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      message: 'Message accusé de réception'
    });

  } catch (error) {
    logger.error('❌ Erreur lors de l\'accusé de réception:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'accusé de réception',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

// Récupérer les statistiques des messages
const getMessageStats = async (req, res) => {
  try {
    const user_id = req.user.id;

    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(CASE WHEN mr.is_read = false THEN 1 END) as unread_count,
        COUNT(CASE WHEN mr.acknowledged = false THEN 1 END) as unacknowledged_count,
        COUNT(CASE WHEN mr.is_read = false AND m.is_urgent = true THEN 1 END) as urgent_unread_count
      FROM message_recipients mr
      JOIN messages m ON mr.message_id = m.id
      WHERE mr.recipient_id = ${user_id}
    `;

    const result = stats[0] || { unread_count: 0, unacknowledged_count: 0, urgent_unread_count: 0 };

    res.json({
      success: true,
      data: {
        unread_count: Number(result.unread_count),
        unacknowledged_count: Number(result.unacknowledged_count),
        urgent_unread_count: Number(result.urgent_unread_count)
      }
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

// Récupérer les utilisateurs pour la messagerie (uniquement de l'église sélectionnée)
const getUsersForMessaging = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { churchId } = req.query; // Récupérer l'ID de l'église sélectionnée

    if (!churchId) {
      return res.status(400).json({
        success: false,
        message: 'ID de l\'église requis'
      });
    }

    const users = await prisma.user.findMany({
      where: {
        id: { not: user_id }, // Exclure l'utilisateur actuel
        eglise_locale_id: churchId // Uniquement de l'église sélectionnée
      },
      select: {
        id: true,
        username: true,
        pseudo: true,
        role: true,
        eglise_locale: {
          select: {
            id: true,
            nom: true
          }
        }
      },
      orderBy: {
        username: 'asc'
      }
    });

    
    res.json({
      success: true,
      data: users
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des utilisateurs',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

// Récupérer les conversations avec le dernier message et les statistiques correctes
const getConversations = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Récupérer les conversations avec le dernier message et les statistiques
    const conversations = await prisma.$queryRaw`
      WITH conversation_partners AS (
        -- Partenaires de conversation (messages reçus)
        SELECT DISTINCT m.sender_id as partner_id
        FROM messages m
        JOIN message_recipients mr ON m.id = mr.message_id
        WHERE mr.recipient_id = ${user_id}
        
        UNION
        
        -- Partenaires de conversation (messages envoyés)
        SELECT DISTINCT mr.recipient_id as partner_id
        FROM messages m
        JOIN message_recipients mr ON m.id = mr.message_id
        WHERE m.sender_id = ${user_id}
      ),
      conversation_stats AS (
        SELECT 
          cp.partner_id,
          COUNT(*) as total_messages,
          COUNT(CASE WHEN mr.recipient_id = ${user_id} AND mr.is_read = false THEN 1 END) as unread_count,
          MAX(m.created_at) as last_message_time
        FROM conversation_partners cp
        JOIN messages m ON (m.sender_id = cp.partner_id AND m.id IN (
          SELECT message_id FROM message_recipients WHERE recipient_id = ${user_id}
        )) OR (m.sender_id = ${user_id} AND m.id IN (
          SELECT message_id FROM message_recipients WHERE recipient_id = cp.partner_id
        ))
        JOIN message_recipients mr ON m.id = mr.message_id
        WHERE cp.partner_id != ${user_id}
        GROUP BY cp.partner_id
      ),
      latest_messages AS (
        SELECT 
          m.id as message_id,
          m.subject,
          m.content,
          m.is_urgent,
          m.created_at,
          m.sender_id,
          s.username as sender_username,
          s.role as sender_role,
          mr.recipient_id,
          r.username as recipient_username,
          r.role as recipient_role,
          mr.is_read,
          mr.read_at,
          mr.acknowledged,
          mr.acknowledged_at,
          CASE 
            WHEN m.sender_id = ${user_id} THEN 'sent'
            ELSE 'received'
          END as message_type,
          CASE 
            WHEN m.sender_id = ${user_id} THEN mr.recipient_id
            ELSE m.sender_id
          END as conversation_partner_id,
          CASE 
            WHEN m.sender_id = ${user_id} THEN r.username
            ELSE s.username
          END as conversation_partner_username,
          CASE 
            WHEN m.sender_id = ${user_id} THEN r.role
            ELSE s.role
          END as conversation_partner_role,
          cs.total_messages,
          cs.unread_count,
          ROW_NUMBER() OVER (
            PARTITION BY CASE 
              WHEN m.sender_id = ${user_id} THEN mr.recipient_id
              ELSE m.sender_id
            END 
            ORDER BY m.created_at DESC
          ) as rn
        FROM messages m
        JOIN message_recipients mr ON m.id = mr.message_id
        JOIN users s ON m.sender_id = s.id
        JOIN users r ON mr.recipient_id = r.id
        JOIN conversation_stats cs ON cs.partner_id = CASE 
          WHEN m.sender_id = ${user_id} THEN mr.recipient_id
          ELSE m.sender_id
        END
        WHERE (mr.recipient_id = ${user_id} OR m.sender_id = ${user_id})
          AND CASE 
            WHEN m.sender_id = ${user_id} THEN mr.recipient_id
            ELSE m.sender_id
          END != ${user_id}
      )
      SELECT 
        conversation_partner_id as id,
        conversation_partner_username as username,
        conversation_partner_role as role,
        message_id,
        subject,
        content,
        is_urgent,
        created_at,
        message_type,
        is_read,
        read_at,
        acknowledged,
        acknowledged_at,
        total_messages,
        unread_count
      FROM latest_messages
      WHERE rn = 1
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit)} OFFSET ${skip}
    `;

    // Compter le total des conversations
    const totalConversations = await prisma.$queryRaw`
      WITH conversation_partners AS (
        SELECT DISTINCT m.sender_id as partner_id
        FROM messages m
        JOIN message_recipients mr ON m.id = mr.message_id
        WHERE mr.recipient_id = ${user_id}
        
        UNION
        
        SELECT DISTINCT mr.recipient_id as partner_id
        FROM messages m
        JOIN message_recipients mr ON m.id = mr.message_id
        WHERE m.sender_id = ${user_id}
      )
      SELECT COUNT(*) as total
      FROM conversation_partners
      WHERE partner_id != ${user_id}
    `;

    const total = Number(totalConversations[0]?.total || 0);

    // Transformer les données pour le frontend
    const transformedConversations = conversations.map(conv => ({
      id: conv.id,
      partner: {
        id: conv.id,
        username: conv.username,
        role: conv.role
      },
      lastMessage: {
        id: conv.message_id,
        subject: conv.subject,
        content: conv.content,
        is_urgent: conv.is_urgent,
        created_at: conv.created_at,
        message_type: conv.message_type,
        is_read: conv.is_read,
        read_at: conv.read_at,
        acknowledged: conv.acknowledged,
        acknowledged_at: conv.acknowledged_at
      },
      stats: {
        total_messages: Number(conv.total_messages),
        unread_count: Number(conv.unread_count)
      }
    }));

    logger.info(`📊 Conversations trouvées: ${transformedConversations.length}`);
    if (transformedConversations.length > 0) {
      logger.info(`📊 Première conversation - Partenaire: ${transformedConversations[0].partner.id}, Username: ${transformedConversations[0].partner.username}`);
    }

    res.json({
      success: true,
      data: {
        conversations: transformedConversations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la récupération des conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des conversations',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

// Récupérer l'historique d'une conversation avec un utilisateur
const getConversationHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    logger.info(`🔍 Récupération de l'historique de conversation entre ${currentUserId} et ${userId}`);

    // Vérifier si l'utilisateur essaie d'ouvrir une conversation avec lui-même
    if (currentUserId === userId) {
      logger.warn(`⚠️ Tentative d'ouverture de conversation avec soi-même: ${currentUserId}`);
      return res.json({
        success: true,
        data: [],
        message: 'Impossible d\'ouvrir une conversation avec soi-même'
      });
    }

    // Récupérer tous les messages entre les deux utilisateurs
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          {
            sender_id: currentUserId,
            recipients: {
              some: {
                recipient_id: userId
              }
            }
          },
          {
            sender_id: userId,
            recipients: {
              some: {
                recipient_id: currentUserId
              }
            }
          }
        ]
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            role: true
          }
        },
        recipients: {
          include: {
            recipient: {
              select: {
                id: true,
                username: true,
                role: true
              }
            }
          }
        }
      },
      orderBy: {
        created_at: 'asc'
      }
    });

    logger.info(`📊 Messages trouvés: ${messages.length}`);

    // Transformer les données pour le frontend
    const transformedMessages = messages.map(msg => ({
      id: msg.id,
      subject: msg.subject,
      content: msg.content,
      is_urgent: msg.is_urgent,
      created_at: msg.created_at,
      sender: msg.sender,
      is_from_current_user: msg.sender_id === currentUserId,
      recipients: msg.recipients.map(recipient => ({
        id: recipient.recipient.id,
        username: recipient.recipient.username,
        role: recipient.recipient.role,
        is_read: recipient.is_read,
        read_at: recipient.read_at,
        acknowledged: recipient.acknowledged,
        acknowledged_at: recipient.acknowledged_at
      }))
    }));

    res.json({
      success: true,
      data: transformedMessages,
      message: 'Historique de conversation récupéré avec succès'
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la récupération de l\'historique de conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'historique de conversation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

// Récupérer les statuts de lecture des messages envoyés
const getMessageReadStatus = async (req, res) => {
  try {
    const { messageId } = req.params;
    const currentUserId = req.user.id;

    // Vérifier que le message appartient à l'utilisateur actuel
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        sender_id: currentUserId
      },
      include: {
        recipients: {
          include: {
            recipient: {
              select: {
                id: true,
                username: true,
                role: true
              }
            }
          }
        }
      }
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message non trouvé ou non autorisé'
      });
    }

    // Transformer les données pour le frontend
    const readStatus = message.recipients.map(recipient => ({
      recipient: {
        id: recipient.recipient.id,
        username: recipient.recipient.username,
        role: recipient.recipient.role
      },
      is_read: recipient.is_read,
      read_at: recipient.read_at,
      acknowledged: recipient.acknowledged,
      acknowledged_at: recipient.acknowledged_at
    }));

    res.json({
      success: true,
      data: {
        messageId: message.id,
        readStatus
      }
    });

  } catch (error) {
    logger.error('❌ Erreur lors de la récupération du statut de lecture:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du statut de lecture',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne du serveur'
    });
  }
};

module.exports = {
  sendMessage,
  getReceivedMessages,
  getSentMessages,
  markAsRead,
  markMultipleAsRead,
  acknowledgeMessage,
  getMessageStats,
  getUsersForMessaging,
  getConversations,
  getConversationHistory,
  getMessageReadStatus
};
