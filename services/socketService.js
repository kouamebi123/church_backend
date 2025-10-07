const { Server } = require('socket.io');
let createAdapter;
let pubClient;
let subClient;
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // Map pour stocker les utilisateurs connectés
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: [
          'http://localhost:3000', // Développement direct
          'http://localhost', // Production via nginx
          'http://localhost:80',
          'http://localhost:8080', // Port Swagger UI
          'https://multitudeszno.up.railway.app', // Railway frontend
          'https://churchbackend-production.up.railway.app' // Railway backend  
        ],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Activer l'adaptateur Redis si Redis est disponible (pour le scaling multi-processus)
    try {
      const redisService = require('./redisService');
      if (redisService && redisService.isConnected) {
        const { createAdapter: _createAdapter } = require('@socket.io/redis-adapter');
        const { createClient } = require('redis');

        createAdapter = _createAdapter;
        pubClient = createClient({
          socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379
          },
          password: process.env.REDIS_PASSWORD || undefined
        });
        subClient = pubClient.duplicate();

        Promise.all([pubClient.connect(), subClient.connect()])
          .then(() => {
            this.io.adapter(createAdapter(pubClient, subClient));
            logger.info('🔄 Socket.IO Redis adapter activé');
          })
          .catch((err) => {
            logger.warn('Impossible d\'activer le Redis adapter Socket.IO : ' + err.message);
          });
      }
    } catch (e) {
      logger.warn('Adaptateur Redis Socket.IO non disponible: ' + e.message);
    }

    this.setupMiddleware();
    this.setupEventHandlers();
    
    logger.info('🔌 Socket.IO initialisé avec succès');
  }

  setupMiddleware() {
    // Middleware d'authentification pour Socket.IO
    this.io.use((socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Token d\'authentification manquant'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        socket.userRole = decoded.role;
        socket.userPseudo = decoded.pseudo;
        
        next();
      } catch (error) {
        logger.error('❌ Erreur d\'authentification Socket.IO:', error);
        next(new Error('Token invalide'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      const userId = socket.userId;
      const userPseudo = socket.userPseudo;
      
      logger.info(`🔌 Utilisateur connecté via Socket.IO: ${userPseudo} (${userId})`);
      
      // Stocker l'utilisateur connecté
      this.connectedUsers.set(userId, {
        socketId: socket.id,
        pseudo: userPseudo,
        role: socket.userRole,
        connectedAt: new Date()
      });

      // Rejoindre une room pour l'utilisateur (pour recevoir ses messages)
      socket.join(`user_${userId}`);

      // Événement pour rejoindre une conversation
      socket.on('join_conversation', (data) => {
        const { conversationId } = data;
        socket.join(`conversation_${conversationId}`);
        logger.info(`👥 ${userPseudo} a rejoint la conversation ${conversationId}`);
      });

      // Événement pour quitter une conversation
      socket.on('leave_conversation', (data) => {
        const { conversationId } = data;
        socket.leave(`conversation_${conversationId}`);
        logger.info(`👋 ${userPseudo} a quitté la conversation ${conversationId}`);
      });

      // Événement pour indiquer qu'un utilisateur tape
      socket.on('typing_start', (data) => {
        const { conversationId, recipientId } = data;
        socket.to(`user_${recipientId}`).emit('user_typing', {
          userId,
          userPseudo,
          conversationId,
          isTyping: true
        });
      });

      socket.on('typing_stop', (data) => {
        const { conversationId, recipientId } = data;
        socket.to(`user_${recipientId}`).emit('user_typing', {
          userId,
          userPseudo,
          conversationId,
          isTyping: false
        });
      });

      // Gestion de la déconnexion
      socket.on('disconnect', (reason) => {
        logger.info(`🔌 Utilisateur déconnecté: ${userPseudo} (${userId}) - Raison: ${reason}`);
        this.connectedUsers.delete(userId);
      });

      // Événement de ping/pong pour maintenir la connexion
      socket.on('ping', () => {
        socket.emit('pong');
      });
    });
  }

  // Méthode pour envoyer un message en temps réel
  sendMessageToUser(recipientId, messageData) {
    const recipient = this.connectedUsers.get(recipientId);
    
    if (recipient) {
      this.io.to(`user_${recipientId}`).emit('new_message', {
        ...messageData,
        timestamp: new Date().toISOString()
      });
      
      logger.info(`📨 Message envoyé en temps réel à ${recipient.pseudo} (${recipientId})`);
      return true;
    } else {
      logger.info(`📨 Utilisateur ${recipientId} non connecté, message stocké en base`);
      return false;
    }
  }

  // Méthode pour envoyer une notification de message lu
  sendMessageReadNotification(senderId, messageId) {
    const sender = this.connectedUsers.get(senderId);
    
    if (sender) {
      this.io.to(`user_${senderId}`).emit('message_read', {
        messageId,
        timestamp: new Date().toISOString()
      });
      
      logger.info(`✅ Notification de lecture envoyée à ${sender.pseudo} (${senderId})`);
    }
  }

  // Méthode pour envoyer une notification d'accusé de réception
  sendMessageAcknowledgedNotification(senderId, messageId) {
    const sender = this.connectedUsers.get(senderId);
    
    if (sender) {
      this.io.to(`user_${senderId}`).emit('message_acknowledged', {
        messageId,
        timestamp: new Date().toISOString()
      });
      
      logger.info(`✅ Notification d'accusé de réception envoyée à ${sender.pseudo} (${senderId})`);
    }
  }

  // Méthode pour notifier les changements de statut de lecture
  sendReadStatusUpdate(senderId, messageId, readStatus) {
    const sender = this.connectedUsers.get(senderId);
    
    if (sender) {
      this.io.to(`user_${senderId}`).emit('read_status_updated', {
        messageId,
        readStatus,
        timestamp: new Date().toISOString()
      });
      
      logger.info(`📖 Statut de lecture mis à jour pour ${sender.pseudo} (${senderId})`);
    }
  }

  // Méthode pour mettre à jour les statistiques des messages
  updateMessageStats(userId, stats) {
    const user = this.connectedUsers.get(userId);
    
    if (user) {
      this.io.to(`user_${userId}`).emit('message_stats_updated', {
        stats,
        timestamp: new Date().toISOString()
      });
      
      logger.info(`📊 Statistiques de messages mises à jour pour ${user.pseudo} (${userId})`);
    }
  }

  // Méthode pour obtenir la liste des utilisateurs connectés
  getConnectedUsers() {
    return Array.from(this.connectedUsers.values());
  }

  // Méthode pour vérifier si un utilisateur est connecté
  isUserConnected(userId) {
    return this.connectedUsers.has(userId);
  }

  // Méthode pour envoyer une notification générale
  sendNotificationToUser(userId, notification) {
    const user = this.connectedUsers.get(userId);
    
    if (user) {
      this.io.to(`user_${userId}`).emit('notification', {
        ...notification,
        timestamp: new Date().toISOString()
      });
      
      logger.info(`🔔 Notification envoyée à ${user.pseudo} (${userId})`);
    }
  }

  // Méthode pour envoyer une notification à tous les utilisateurs d'un rôle
  sendNotificationToRole(role, notification) {
    const usersWithRole = Array.from(this.connectedUsers.values())
      .filter(user => user.role === role);
    
    usersWithRole.forEach(user => {
      this.io.to(`user_${user.socketId}`).emit('notification', {
        ...notification,
        timestamp: new Date().toISOString()
      });
    });
    
    logger.info(`🔔 Notification envoyée à ${usersWithRole.length} utilisateurs avec le rôle ${role}`);
  }
}

module.exports = new SocketService();
