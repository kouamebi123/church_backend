const { Resend } = require('resend');
const logger = require('./logger');

class ResendEmailService {
  constructor() {
    this.resend = null;
    this.initializeResend();
  }

  async initializeResend() {
    try {
      // Vérifier que la clé API Resend est présente
      if (!process.env.RESEND_API_KEY) {
        logger.warn('⚠️ Clé API Resend manquante, service email désactivé');
        this.resend = null;
        return;
      }

      this.resend = new Resend(process.env.RESEND_API_KEY);
      
      // Tester la connexion
      const testResult = await this.resend.domains.list();
      logger.info('✅ Service Resend initialisé avec succès');
    } catch (error) {
      logger.error('❌ Erreur lors de l\'initialisation de Resend:', error);
      this.resend = null;
    }
  }

  async sendPasswordResetEmail(email, resetLink, username) {
    if (!this.resend) {
      logger.error('❌ Service Resend non initialisé');
      throw new Error('Service email non disponible');
    }

    try {
      const result = await this.resend.emails.send({
        from: 'Multitudes ZNO <onboarding@resend.dev>',
        to: [email],
        subject: '🔐 Réinitialisation de votre mot de passe',
        html: ResendEmailService.generatePasswordResetHTML(resetLink, username),
        text: ResendEmailService.generatePasswordResetText(resetLink, username)
      });

      logger.info('✅ Email de réinitialisation envoyé avec succès via Resend', { 
        email, 
        messageId: result.data?.id 
      });
      
      return result;
    } catch (error) {
      logger.error('❌ Erreur lors de l\'envoi de l\'email via Resend:', error);
      throw error;
    }
  }

  static generatePasswordResetHTML(resetLink, username) {
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
            background: linear-gradient(135deg, #3a0066 0%, #7a1bb8 100%);
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(75, 0, 130, 0.4);
          }
          .footer { 
            text-align: center; 
            margin-top: 30px; 
            padding-top: 20px; 
            border-top: 1px solid #eee; 
            color: #666; 
            font-size: 14px; 
          }
          .warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🏛️ Multitudes ZNO</h1>
          <p>Réinitialisation de mot de passe</p>
        </div>
        
        <div class="content">
          <p>Bonjour <strong>${username}</strong>,</p>
          
          <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Multitudes ZNO.</p>
          
          <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
          
          <div style="text-align: center;">
            <a href="${resetLink}" class="button">🔐 Réinitialiser mon mot de passe</a>
          </div>
          
          <div class="warning">
            <strong>⚠️ Important :</strong> Ce lien est valide pendant 1 heure seulement. Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
          </div>
          
          <p>Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :</p>
          <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace;">
            ${resetLink}
          </p>
        </div>
        
        <div class="footer">
          <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
          <p>© 2024 Multitudes ZNO - Tous droits réservés</p>
        </div>
      </body>
      </html>
    `;
  }

  static generatePasswordResetText(resetLink, username) {
    return `
🏛️ Multitudes ZNO
Réinitialisation de mot de passe

Bonjour ${username},

Vous avez demandé la réinitialisation de votre mot de passe pour votre compte Multitudes ZNO.

Pour créer un nouveau mot de passe, cliquez sur le lien suivant :
${resetLink}

⚠️ Important : Ce lien est valide pendant 1 heure seulement.

Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.

---
Cet email a été envoyé automatiquement, merci de ne pas y répondre.
© 2024 Multitudes ZNO - Tous droits réservés
    `;
  }

  static generateMessageNotificationHTML(recipient, sender, message, messageUrl) {
    const appName = process.env.APP_NAME || 'Système de Gestion d\'Église';
    const appUrl = process.env.FRONTEND_URL || 'https://multitudeszno.up.railway.app';
    
    return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nouveau message reçu</title>
        <style>
            body {
                font-family: 'Open Sans', 'Helvetica', 'Arial', sans-serif;
                line-height: 1.6;
                color: #212529;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
                background-color: #F8F9FA;
            }
            .container {
                background-color: #FFFFFF;
                border-radius: 12px;
                padding: 32px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                border: 1px solid #E9ECEF;
            }
            .header {
                text-align: center;
                border-bottom: 3px solid #4B0082;
                padding-bottom: 24px;
                margin-bottom: 32px;
            }
            .logo {
                font-size: 28px;
                font-weight: 600;
                color: #4B0082;
                margin-bottom: 8px;
            }
            .subtitle {
                color: #6C757D;
                font-size: 16px;
                margin: 0;
            }
            .message-card {
                background: linear-gradient(135deg, #F8F9FA 0%, #FFFFFF 100%);
                border: 1px solid #E9ECEF;
                border-radius: 8px;
                padding: 24px;
                margin: 24px 0;
            }
            .sender-info {
                display: flex;
                align-items: center;
                margin-bottom: 16px;
            }
            .sender-avatar {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: linear-gradient(135deg, #4B0082 0%, #8A2BE2 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 18px;
                margin-right: 16px;
            }
            .sender-details h3 {
                margin: 0;
                color: #212529;
                font-size: 18px;
            }
            .sender-details p {
                margin: 4px 0 0 0;
                color: #6C757D;
                font-size: 14px;
            }
            .message-content {
                background: #FFFFFF;
                border: 1px solid #E9ECEF;
                border-radius: 8px;
                padding: 20px;
                margin: 16px 0;
                font-size: 16px;
                line-height: 1.6;
                color: #212529;
            }
            .cta-button {
                display: inline-block;
                background: linear-gradient(135deg, #4B0082 0%, #8A2BE2 100%);
                color: white !important;
                text-decoration: none !important;
                padding: 12px 24px;
                border-radius: 6px;
                font-weight: 600;
                margin: 20px 0;
                transition: all 0.3s ease;
            }
            .cta-button:hover {
                background: linear-gradient(135deg, #3a0066 0%, #7a1bb8 100%);
                transform: translateY(-1px);
            }
            .footer {
                text-align: center;
                margin-top: 32px;
                padding-top: 24px;
                border-top: 1px solid #E9ECEF;
                color: #6C757D;
                font-size: 14px;
            }
            .timestamp {
                color: #6C757D;
                font-size: 12px;
                margin-top: 16px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🏛️ ${appName}</div>
                <p class="subtitle">Nouveau message reçu</p>
            </div>
            
            <div class="message-card">
                <div class="sender-info">
                    <div class="sender-avatar">
                        ${(sender.pseudo || sender.username || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div class="sender-details">
                        <h3>${sender.pseudo || sender.username || 'Utilisateur'}</h3>
                        <p>Vous a envoyé un message</p>
                    </div>
                </div>
                
                <div class="message-content">
                    ${message.content || message.message || 'Nouveau message reçu'}
                </div>
                
                <div style="text-align: center;">
                    <a href="${messageUrl || appUrl}" class="cta-button">
                        📨 Voir le message
                    </a>
                </div>
                
                <div class="timestamp">
                    Reçu le ${new Date().toLocaleString('fr-FR')}
                </div>
            </div>
            
            <div class="footer">
                <p>Cet email a été envoyé automatiquement par ${appName}</p>
                <p>Si vous ne souhaitez plus recevoir ces notifications, contactez votre administrateur.</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  static generateMessageNotificationText(recipient, sender, message, messageUrl) {
    const appName = process.env.APP_NAME || 'Système de Gestion d\'Église';
    const appUrl = process.env.FRONTEND_URL || 'https://multitudeszno.up.railway.app';
    
    return `
🏛️ ${appName}
Nouveau message reçu

Bonjour ${recipient.username || recipient.pseudo || 'Utilisateur'},

${sender.pseudo || sender.username || 'Un utilisateur'} vous a envoyé un message :

${message.content || message.message || 'Nouveau message reçu'}

Pour voir le message complet, cliquez sur le lien suivant :
${messageUrl || appUrl}

---
Reçu le ${new Date().toLocaleString('fr-FR')}

Cet email a été envoyé automatiquement par ${appName}.
Si vous ne souhaitez plus recevoir ces notifications, contactez votre administrateur.
    `;
  }

}

module.exports = ResendEmailService;
