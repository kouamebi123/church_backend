const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const ResendEmailService = require('../utils/resendEmailService');

class EmailService {
  constructor() {
    this.transporter = null;
    this.resendService = new ResendEmailService();
    this.initializeTransporter();
  }

  /**
   * Initialise le transporteur email
   */
  initializeTransporter() {
    try {
      // Vérifier si les paramètres SMTP sont configurés
      if (!process.env.SMTP_HOST || (!process.env.SMTP_USER && !process.env.EMAIL_USER)) {
        logger.warn('SMTP non configuré, mode fallback activé');
        this.transporter = null;
        return;
      }

      // Configuration du transporteur email
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // true pour 465, false pour autres ports
        auth: {
          user: process.env.SMTP_USER || process.env.EMAIL_USER,
          pass: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Vérifier la configuration seulement si les variables sont présentes
      if (process.env.SMTP_HOST && (process.env.SMTP_USER || process.env.EMAIL_USER)) {
        this.transporter.verify((error, success) => {
          if (error) {
            logger.error('EmailService - Erreur de configuration SMTP:', error);
          } else {
            logger.info('EmailService - Serveur SMTP configuré avec succès');
          }
        });
      } else {
        logger.warn('EmailService - Variables SMTP manquantes, mode fallback activé');
      }

    } catch (error) {
      logger.error('EmailService - Erreur lors de l\'initialisation:', error);
    }
  }

  /**
   * Envoie une notification de message reçu
   * @param {Object} recipient - Destinataire du message
   * @param {Object} sender - Expéditeur du message
   * @param {Object} message - Contenu du message
   * @param {string} messageUrl - URL pour voir le message
   */
  async sendMessageNotification(recipient, sender, message, messageUrl) {
    try {
      // Essayer d'abord Resend (recommandé pour Railway)
      if (this.resendService && this.resendService.resend) {
        try {
          const result = await this.resendService.resend.emails.send({
            from: 'Church Management <onboarding@resend.dev>',
            to: [recipient.email],
            subject: `Nouveau message de ${sender.pseudo || sender.username}`,
            html: ResendEmailService.generateMessageNotificationHTML(recipient, sender, message, messageUrl),
            text: ResendEmailService.generateMessageNotificationText(recipient, sender, message, messageUrl)
          });

          logger.info('EmailService - Notification de message envoyée via Resend:', {
            to: recipient.email,
            from: sender.email,
            messageId: result.data?.id
          });

          return result;
        } catch (resendError) {
          logger.warn('⚠️ Resend a échoué pour la messagerie, tentative avec SMTP...', resendError.message);
        }
      }

      // Fallback vers SMTP si Resend n'est pas disponible
      if (!this.transporter) {
        logger.warn('EmailService - Aucun service email disponible (ni Resend ni SMTP)');
        return { messageId: 'no-transporter', accepted: [recipient.email] };
      }

      const emailData = {
        from: `"Système de Gestion d'Église" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
        to: recipient.email,
        subject: `Nouveau message de ${sender.pseudo || sender.username}`,
        html: this.generateMessageNotificationHTML(recipient, sender, message, messageUrl),
        text: this.generateMessageNotificationText(recipient, sender, message, messageUrl)
      };

      const result = await this.transporter.sendMail(emailData);
      logger.info('EmailService - Notification de message envoyée via SMTP:', {
        to: recipient.email,
        from: sender.email,
        messageId: result.messageId
      });

      return result;
    } catch (error) {
      logger.error('EmailService - Erreur lors de l\'envoi de notification:', error);
      throw error;
    }
  }

  /**
   * Génère le HTML pour la notification de message
   */
  generateMessageNotificationHTML(recipient, sender, message, messageUrl) {
    const appName = process.env.APP_NAME || 'Système de Gestion d\'Église';
    const appUrl = process.env.FRONTEND_URL || 'http://localhost';
    
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
                border-left: 4px solid #4B0082;
                padding: 24px;
                margin: 24px 0;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            }
            .sender-info {
                display: flex;
                align-items: center;
                margin-bottom: 15px;
            }
            .sender-avatar {
                width: 56px;
                height: 56px;
                border-radius: 50%;
                background: linear-gradient(135deg, #4B0082 0%, #8A2BE2 100%);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                font-size: 20px;
                margin-right: 16px;
                box-shadow: 0 2px 8px rgba(75, 0, 130, 0.3);
            }
            .sender-details h3 {
                margin: 0;
                color: #4B0082;
                font-size: 18px;
                font-weight: 600;
            }
            .sender-details p {
                margin: 4px 0 0 0;
                color: #6C757D;
                font-size: 14px;
            }
            .message-content {
                background-color: #FFFFFF;
                padding: 20px;
                border-radius: 8px;
                border: 1px solid #E9ECEF;
                margin: 16px 0;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            }
            .message-subject {
                font-weight: 600;
                color: #212529;
                margin-bottom: 12px;
                font-size: 18px;
            }
            .message-text {
                color: #495057;
                line-height: 1.6;
                white-space: pre-wrap;
                font-size: 15px;
            }
            .cta-button {
                display: inline-block;
                background: linear-gradient(135deg, #4B0082 0%, #8A2BE2 100%);
                color: white !important;
                padding: 14px 32px;
                text-decoration: none !important;
                border-radius: 8px;
                font-weight: 600;
                margin: 24px 0;
                text-align: center;
                box-shadow: 0 4px 12px rgba(75, 0, 130, 0.3);
                transition: all 0.3s ease;
                border: none;
            }
            .cta-button:hover {
                background: linear-gradient(135deg, #2D004D 0%, #6A1B9A 100%) !important;
                color: white !important;
                transform: translateY(-2px);
                box-shadow: 0 6px 16px rgba(75, 0, 130, 0.4);
                text-decoration: none !important;
            }
            .cta-button:visited {
                color: white !important;
                text-decoration: none !important;
            }
            .cta-button:link {
                color: white !important;
                text-decoration: none !important;
            }
            .footer {
                text-align: center;
                margin-top: 32px;
                padding-top: 24px;
                border-top: 1px solid #E9ECEF;
                color: #6C757D;
                font-size: 13px;
            }
            .urgent {
                background: linear-gradient(135deg, #FFF3CD 0%, #FFEAA7 100%);
                border-left-color: #FFC107;
                box-shadow: 0 2px 8px rgba(255, 193, 7, 0.2);
            }
            .urgent .message-subject::before {
                content: "🚨 ";
            }
            .message-meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 16px;
                padding-top: 16px;
                border-top: 1px solid #E9ECEF;
                font-size: 13px;
                color: #6C757D;
            }
            .message-date {
                font-weight: 500;
            }
            .message-urgent-badge {
                background: #FFC107;
                color: #212529;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">${appName}</div>
                <p class="subtitle">Vous avez reçu un nouveau message</p>
            </div>
            
            <div class="message-card ${message.is_urgent ? 'urgent' : ''}">
                <div class="sender-info">
                    <div class="sender-avatar">
                        ${(sender.pseudo || sender.username).charAt(0).toUpperCase()}
                    </div>
                    <div class="sender-details">
                        <h3>${sender.pseudo || sender.username}</h3>
                        <p>${sender.eglise_locale?.nom || 'Église non spécifiée'}</p>
                    </div>
                </div>
                
                <div class="message-content">
                    <div class="message-subject">${message.subject}</div>
                    <div class="message-text">${message.content}</div>
                    
                    <div class="message-meta">
                        <span class="message-date">${new Date(message.created_at).toLocaleString('fr-FR', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}</span>
                        ${message.is_urgent ? '<span class="message-urgent-badge">Urgent</span>' : ''}
                    </div>
                </div>
            </div>
            
            <div style="text-align: center;">
                <a href="${messageUrl}" class="cta-button">
                    Accéder à l'application
                </a>
            </div>
            
            <div class="footer">
                <p>Cet email a été envoyé automatiquement par le système de gestion d'église.</p>
                <p>Si vous ne souhaitez plus recevoir ces notifications, vous pouvez les désactiver dans vos préférences.</p>
                <p>© ${new Date().getFullYear()} ${appName} - Tous droits réservés</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Génère le texte brut pour la notification de message
   */
  generateMessageNotificationText(recipient, sender, message, messageUrl) {
    return `
Nouveau message reçu

De: ${sender.pseudo || sender.username}
Église: ${sender.eglise_locale?.nom || 'Église non spécifiée'}
Sujet: ${message.subject}

Contenu:
${message.content}

${message.is_urgent ? '🚨 MESSAGE URGENT 🚨' : ''}

Pour voir le message complet, cliquez sur le lien suivant:
${messageUrl}

---
Cet email a été envoyé automatiquement par le système de gestion d'église.
Si vous ne souhaitez plus recevoir ces notifications, contactez votre administrateur.
    `.trim();
  }

  /**
   * Envoie un email de test
   */
  async sendTestEmail(to) {
    try {
      if (!this.transporter) {
        logger.warn('EmailService - Transporteur non configuré, test email non envoyé');
        return { messageId: 'no-transporter', accepted: [to] };
      }

      const testMessage = {
        from: `"Système de Gestion d'Église" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
        to: to,
        subject: 'Test de configuration email',
        html: `
          <h2>Test de configuration email</h2>
          <p>Si vous recevez cet email, la configuration email fonctionne correctement.</p>
          <p>Date: ${new Date().toLocaleString('fr-FR')}</p>
        `,
        text: 'Test de configuration email - Si vous recevez cet email, la configuration email fonctionne correctement.'
      };

      const result = await this.transporter.sendMail(testMessage);
      logger.info('EmailService - Email de test envoyé:', { to, messageId: result.messageId });
      return result;
    } catch (error) {
      logger.error('EmailService - Erreur lors de l\'envoi de l\'email de test:', error);
      throw error;
    }
  }

  /**
   * Envoie une notification de message de contact aux administrateurs
   */
  async sendContactNotification(adminEmail, contactData) {
    try {
      logger.info('EmailService - Tentative d\'envoi de notification de contact:', {
        to: adminEmail,
        contact_id: contactData.contact_id || 'N/A',
        from: contactData.email,
        subject: contactData.subject,
        hasResend: !!this.resendService?.resend,
        hasTransporter: !!this.transporter
      });

      // Essayer d'abord Resend (recommandé pour Railway)
      if (this.resendService && this.resendService.resend) {
        try {
          // Utiliser l'expéditeur du formulaire comme expéditeur de l'email
          const fromEmail = `${contactData.name} <${contactData.email}>`;
          
          const result = await this.resendService.resend.emails.send({
            from: fromEmail,
            to: [adminEmail],
            subject: `Nouveau message de contact: ${contactData.subject}`,
            html: ResendEmailService.generateContactNotificationHTML(contactData),
            text: ResendEmailService.generateContactNotificationText(contactData)
          });

          logger.info('EmailService - Notification de contact envoyée via Resend:', {
            to: adminEmail,
            contact_id: contactData.contact_id || 'N/A',
            from: contactData.email,
            messageId: result.data?.id
          });

          return result;
        } catch (resendError) {
          logger.error('EmailService - Erreur Resend lors de l\'envoi de notification de contact:', {
            error: resendError.message,
            stack: resendError.stack,
            to: adminEmail
          });
          // Continuer avec SMTP en cas d'erreur Resend
        }
      } else {
        logger.warn('EmailService - Resend non disponible pour l\'envoi de notification de contact');
      }

      // Fallback sur SMTP si Resend n'est pas disponible ou a échoué
      if (!this.transporter) {
        logger.error('EmailService - Aucun transporteur disponible (ni Resend ni SMTP) pour l\'envoi de notification de contact:', {
          to: adminEmail,
          contact_id: contactData.contact_id || 'N/A',
          from: contactData.email
        });
        throw new Error('Aucun service email disponible (ni Resend ni SMTP)');
      }

      // Utiliser l'expéditeur du formulaire comme expéditeur de l'email
      const fromEmail = `${contactData.name} <${contactData.email}>`;
      
      const contactMessage = {
        from: fromEmail,
        to: adminEmail,
        subject: `Nouveau message de contact: ${contactData.subject}`,
        html: ResendEmailService.generateContactNotificationHTML(contactData),
        text: ResendEmailService.generateContactNotificationText(contactData)
      };

      const result = await this.transporter.sendMail(contactMessage);
      logger.info('EmailService - Notification de contact envoyée via SMTP:', {
        to: adminEmail,
        contact_id: contactData.contact_id || 'N/A',
        from: contactData.email,
        messageId: result.messageId
      });

      return result;
    } catch (error) {
      logger.error('EmailService - Erreur lors de l\'envoi de la notification de contact:', {
        error: error.message,
        stack: error.stack,
        to: adminEmail,
        contact_id: contactData.contact_id || 'N/A',
        from: contactData.email
      });
      throw error;
    }
  }
}

// Export d'une instance singleton
module.exports = new EmailService();
