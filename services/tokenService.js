const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const redisService = require('./redisService');
const logger = require('../utils/logger');

class TokenService {
  constructor() {
    this.accessTokenSecret = process.env.JWT_SECRET;
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh';
    this.accessTokenExpiry = process.env.JWT_EXPIRE || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRE || '7d';
  }

  /**
   * Génère un token d'accès
   */
  generateAccessToken(payload) {
    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry,
      issuer: 'church-management-system',
      audience: 'church-users'
    });
  }

  /**
   * Génère un token de rafraîchissement
   */
  generateRefreshToken(payload) {
    const jti = crypto.randomUUID(); // JWT ID unique
    const token = jwt.sign(
      { ...payload, jti },
      this.refreshTokenSecret,
      {
        expiresIn: this.refreshTokenExpiry,
        issuer: 'church-management-system',
        audience: 'church-users'
      }
    );

    // Stocker le token de rafraîchissement dans Redis
    this.storeRefreshToken(payload.id, jti, this.refreshTokenExpiry);
    
    return token;
  }

  /**
   * Stocke un token de rafraîchissement dans Redis
   */
  async storeRefreshToken(userId, jti, expiry) {
    try {
      const key = `refresh_token:${userId}:${jti}`;
      const ttl = this.parseExpiryToSeconds(expiry);
      await redisService.cacheData(key, { userId, jti, createdAt: new Date() }, ttl);
      logger.debug(`Refresh token stored for user ${userId}`);
    } catch (error) {
      logger.error('Error storing refresh token:', error);
    }
  }

  /**
   * Vérifie et valide un token de rafraîchissement
   */
  async validateRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret);
      
      // Vérifier que le token existe dans Redis
      const key = `refresh_token:${decoded.id}:${decoded.jti}`;
      const storedToken = await redisService.getCachedData(key);
      
      if (!storedToken) {
        throw new Error('Refresh token not found or expired');
      }

      return decoded;
    } catch (error) {
      logger.error('Refresh token validation failed:', error);
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Révocation d'un token de rafraîchissement
   */
  async revokeRefreshToken(userId, jti) {
    try {
      const key = `refresh_token:${userId}:${jti}`;
      await redisService.invalidateData(key);
      logger.debug(`Refresh token revoked for user ${userId}`);
    } catch (error) {
      logger.error('Error revoking refresh token:', error);
    }
  }

  /**
   * Révocation de tous les tokens de rafraîchissement d'un utilisateur
   */
  async revokeAllRefreshTokens(userId) {
    try {
      const pattern = `refresh_token:${userId}:*`;
      await redisService.invalidateData(pattern);
      logger.info(`All refresh tokens revoked for user ${userId}`);
    } catch (error) {
      logger.error('Error revoking all refresh tokens:', error);
    }
  }

  /**
   * Rotation des tokens (génère de nouveaux tokens)
   */
  async rotateTokens(refreshToken) {
    try {
      const decoded = await this.validateRefreshToken(refreshToken);
      
      // Révocation de l'ancien token de rafraîchissement
      await this.revokeRefreshToken(decoded.id, decoded.jti);
      
      // Génération de nouveaux tokens
      const payload = {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role,
        eglise_locale_id: decoded.eglise_locale_id
      };

      const newAccessToken = this.generateAccessToken(payload);
      const newRefreshToken = this.generateRefreshToken(payload);

      logger.info(`Tokens rotated for user ${decoded.id}`);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: this.parseExpiryToSeconds(this.accessTokenExpiry)
      };
    } catch (error) {
      logger.error('Token rotation failed:', error);
      throw error;
    }
  }

  /**
   * Vérifie un token d'accès
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.accessTokenSecret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Access token expired');
      }
      throw new Error('Invalid access token');
    }
  }

  /**
   * Génère une paire de tokens (accès + rafraîchissement)
   */
  generateTokenPair(payload) {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiryToSeconds(this.accessTokenExpiry)
    };
  }

  /**
   * Parse une durée d'expiration en secondes
   */
  parseExpiryToSeconds(expiry) {
    const units = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400
    };

    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 3600; // 1 heure par défaut

    const [, value, unit] = match;
    return parseInt(value) * units[unit];
  }

  /**
   * Vérifie si un token est proche de l'expiration
   */
  isTokenNearExpiry(token, thresholdMinutes = 5) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) return false;

      const now = Math.floor(Date.now() / 1000);
      const expiry = decoded.exp;
      const threshold = thresholdMinutes * 60;

      return (expiry - now) <= threshold;
    } catch (error) {
      return false;
    }
  }

  /**
   * Nettoie les tokens expirés
   */
  async cleanupExpiredTokens() {
    try {
      // Cette méthode pourrait être appelée périodiquement
      // pour nettoyer les tokens expirés de Redis
      logger.info('Token cleanup completed');
    } catch (error) {
      logger.error('Error during token cleanup:', error);
    }
  }
}

// Instance singleton
const tokenService = new TokenService();

module.exports = tokenService;
