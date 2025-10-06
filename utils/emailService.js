const nodemailer = require('nodemailer');
const logger = require('./logger');
const ResendEmailService = require('./resendEmailService');

class EmailService {
  constructor() {
    this.transporter = null;
    this.resendService = new ResendEmailService();
    this.initializeTransporter();
  }

  async initializeTransporter() {
    try {
      // Vérifier que les variables d'environnement sont présentes
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        logger.warn('⚠️ Variables SMTP manquantes, service email désactivé');
        this.transporter = null;
        return;
      }

      // Détecter si on est sur Railway (qui bloque SMTP)
      const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';
      
      if (isRailway) {
        logger.warn('⚠️ Détection Railway - SMTP désactivé (restrictions réseau)');
        logger.warn('📧 Les emails seront loggés au lieu d\'être envoyés');
        this.transporter = null;
        return;
      }
      
      // Configuration pour Gmail (uniquement en développement)
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER, // Votre email Gmail
          pass: process.env.SMTP_PASS // Votre mot de passe d'application Gmail
        },
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 10000, // 10 secondes
        greetingTimeout: 10000, // 10 secondes
        socketTimeout: 10000, // 10 secondes
        pool: true,
        maxConnections: 1,
        maxMessages: 3,
        rateDelta: 20000,
        rateLimit: 5
      });

      // Vérifier la connexion avec timeout
      const verifyPromise = this.transporter.verify();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('SMTP verification timeout')), 15000)
      );
      
      await Promise.race([verifyPromise, timeoutPromise]);
      logger.info('✅ Service email initialisé avec succès');
    } catch (error) {
      logger.error('❌ Erreur lors de l\'initialisation du service email:', error);
      this.transporter = null;
    }
  }

  async sendPasswordResetEmail(email, resetLink, username) {
    // Essayer d'abord Resend (recommandé pour Railway)
    if (this.resendService && this.resendService.resend) {
      try {
        return await this.resendService.sendPasswordResetEmail(email, resetLink, username);
      } catch (error) {
        logger.warn('⚠️ Resend a échoué, tentative avec SMTP...', error.message);
      }
    }

    // Fallback vers SMTP si Resend n'est pas disponible
    if (!this.transporter) {
      logger.error('❌ Aucun service email disponible (ni Resend ni SMTP)');
      throw new Error('Service email non disponible');
    }

    try {
      const mailOptions = {
        from: `"Church Management System" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🔐 Réinitialisation de votre mot de passe',
        html: this.generatePasswordResetHTML(resetLink, username),
        text: this.generatePasswordResetText(resetLink, username)
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info('✅ Email de réinitialisation envoyé avec succès via SMTP', { 
        email, 
        messageId: result.messageId 
      });
      
      return result;
    } catch (error) {
      logger.error('❌ Erreur lors de l\'envoi de l\'email de réinitialisation:', error);
      throw error;
    }
  }

  generatePasswordResetHTML(resetLink, username) {
    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Réinitialisation de mot de passe</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px;
            background-color: #f4f4f4;
          }
          .header { 
            background: linear-gradient(135deg, #4B0082 0%, #8A2BE2 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
            border-radius: 10px 10px 0 0;
            box-shadow: 0 4px 20px rgba(75, 0, 130, 0.3);
          }
          .content { 
            background: #FFFFFF; 
            padding: 30px; 
            border-radius: 0 0 10px 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .button { 
            display: inline-block; 
            background: linear-gradient(135deg, #4B0082 0%, #8A2BE2 100%); 
            color: white !important; 
            padding: 15px 30px; 
            text-decoration: none !important; 
            border-radius: 25px; 
            font-weight: bold; 
            margin: 20px 0;
            box-shadow: 0 4px 15px rgba(75, 0, 130, 0.3);
            transition: all 0.3s ease;
            border: none;
            outline: none;
            cursor: pointer;
          }
          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(75, 0, 130, 0.4);
            color: white !important;
            text-decoration: none !important;
          }
          .button:visited {
            color: white !important;
            text-decoration: none !important;
          }
          .button:active {
            color: white !important;
            text-decoration: none !important;
          }
          .warning { 
            background: #fff3cd; 
            border: 1px solid #ffeaa7; 
            color: #856404; 
            padding: 15px; 
            border-radius: 5px; 
            margin: 20px 0;
            border-left: 4px solid #8A2BE2;
          }
          .footer { 
            text-align: center; 
            margin-top: 30px; 
            color: #666666; 
            font-size: 14px;
            padding: 20px;
            background: #FFFFFF;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
          }
          .link-text {
            word-break: break-all; 
            color: #4B0082; 
            font-weight: 500;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 5px;
            border: 1px solid #e9ecef;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🔐 Réinitialisation de mot de passe</h1>
          <p>Church Management System</p>
        </div>
        
        <div class="content">
          <h2>Bonjour ${username || 'utilisateur'} !</h2>
          
          <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Church Management System.</p>
          
          <p>Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
          
          <div style="text-align: center;">
            <a href="${resetLink}" class="button">🔑 Réinitialiser mon mot de passe</a>
          </div>
          
          <div class="warning">
            <strong>⚠️ Important :</strong>
            <ul>
              <li>Ce lien expirera dans <strong>10 minutes</strong></li>
              <li>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email</li>
              <li>Ne partagez jamais ce lien avec qui que ce soit</li>
            </ul>
          </div>
          
          <p>Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
          <p class="link-text">${resetLink}</p>
          
          <p>Merci de votre confiance !</p>
          
          <p>Cordialement,<br>L'équipe Church Management System</p>
        </div>
        
        <div class="footer">
          <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
          <p>© ${new Date().getFullYear()} Church Management System. Tous droits réservés.</p>
        </div>
      </body>
      </html>
    `;
  }

  generatePasswordResetText(resetLink, username) {
    return `
🔐 Réinitialisation de mot de passe - Church Management System

Bonjour ${username || 'utilisateur'} !

Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Church Management System.

Cliquez sur ce lien pour définir un nouveau mot de passe :
${resetLink}

⚠️ IMPORTANT :
- Ce lien expirera dans 10 minutes
- Si vous n'avez pas demandé cette réinitialisation, ignorez cet email
- Ne partagez jamais ce lien avec qui que ce soit

Merci de votre confiance !

Cordialement,
L'équipe Church Management System

---
Cet email a été envoyé automatiquement, merci de ne pas y répondre.
© ${new Date().getFullYear()} Church Management System. Tous droits réservés.
    `;
  }

  async sendWelcomeEmail(email, username) {
    if (!this.transporter) {
      logger.error('❌ Service email non initialisé');
      throw new Error('Service email non disponible');
    }

    try {
      const mailOptions = {
        from: `"Church Management System" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🎉 Bienvenue dans Church Management System !',
        html: this.generateWelcomeHTML(username),
        text: this.generateWelcomeText(username)
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info('✅ Email de bienvenue envoyé avec succès', { 
        email, 
        messageId: result.messageId 
      });
      
      return result;
    } catch (error) {
      logger.error('❌ Erreur lors de l\'envoi de l\'email de bienvenue:', error);
      throw error;
    }
  }

  generateWelcomeHTML(username) {
    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenue !</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px;
            background-color: #f4f4f4;
          }
          .header { 
            background: linear-gradient(135deg, #4B0082 0%, #8A2BE2 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
            border-radius: 10px 10px 0 0;
            box-shadow: 0 4px 20px rgba(75, 0, 130, 0.3);
          }
          .content { 
            background: #FFFFFF; 
            padding: 30px; 
            border-radius: 0 0 10px 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .button { 
            display: inline-block; 
            background: linear-gradient(135deg, #4B0082 0%, #8A2BE2 100%); 
            color: white !important; 
            padding: 15px 30px; 
            text-decoration: none !important; 
            border-radius: 25px; 
            font-weight: bold; 
            margin: 20px 0;
            box-shadow: 0 4px 15px rgba(75, 0, 130, 0.3);
            transition: all 0.3s ease;
            border: none;
            outline: none;
            cursor: pointer;
          }
          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(75, 0, 130, 0.4);
            color: white !important;
            text-decoration: none !important;
          }
          .button:visited {
            color: white !important;
            text-decoration: none !important;
          }
          .button:active {
            color: white !important;
            text-decoration: none !important;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎉 Bienvenue !</h1>
          <p>Church Management System</p>
        </div>
        
        <div class="content">
          <h2>Bonjour ${username} !</h2>
          
          <p>Nous sommes ravis de vous accueillir dans Church Management System !</p>
          
          <p>Votre compte a été créé avec succès et vous pouvez maintenant :</p>
          <ul>
            <li>✅ Accéder à votre tableau de bord</li>
            <li>✅ Gérer votre profil</li>
            <li>✅ Participer aux activités de votre église</li>
            <li>✅ Consulter les réseaux et services</li>
          </ul>
          
          <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost'}/login" class="button">🚀 Commencer maintenant</a>
          </div>
          
          <p>Si vous avez des questions, n'hésitez pas à contacter l'équipe d'administration.</p>
          
          <p>Bienvenue parmi nous !</p>
          
          <p>Cordialement,<br>L'équipe Church Management System</p>
        </div>
      </body>
      </html>
    `;
  }

  generateWelcomeText(username) {
    return `
🎉 Bienvenue dans Church Management System !

Bonjour ${username} !

Nous sommes ravis de vous accueillir dans Church Management System !

Votre compte a été créé avec succès et vous pouvez maintenant :
✅ Accéder à votre tableau de bord
✅ Gérer votre profil
✅ Participer aux activités de votre église
✅ Consulter les réseaux et services

Commencez dès maintenant : ${process.env.FRONTEND_URL || 'http://localhost'}/login

Si vous avez des questions, n'hésitez pas à contacter l'équipe d'administration.

Bienvenue parmi nous !

Cordialement,
L'équipe Church Management System
    `;
  }
}

// Instance singleton
const emailService = new EmailService();

module.exports = emailService;
