const securityLogger = require('../utils/securityLogger');

// Headers de sécurité ultra-stricts
const securityHeaders = (req, res, next) => {
  // Protection XSS
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Protection contre le clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Protection contre le MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Protection contre la fuite de référent
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy (remplace Feature-Policy)
  res.setHeader('Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );

  // Content Security Policy ultra-strict
  const backendUrl = process.env.APP_BACKEND_URL || 'https://church-production-9a34.up.railway.app' || 'http://localhost:5001';
  const frontendUrl = process.env.APP_URL || 'http://localhost:3000';
  const wsBackendUrl = backendUrl.replace('http', 'ws').replace('https', 'wss');
  const wsFrontendUrl = frontendUrl.replace('http', 'ws').replace('https', 'wss');
  
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
    `img-src 'self' data: blob: https: ${backendUrl}`,
    "font-src 'self' https://fonts.gstatic.com https://unpkg.com",
    `connect-src 'self' ${wsBackendUrl} ${wsFrontendUrl} ${backendUrl} ${frontendUrl} https://unpkg.com`,
    "media-src 'self' data: blob: https:",
    "frame-src 'self' https://www.youtube.com https://www.instagram.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests'
  ].join('; '));

  // HSTS (HTTP Strict Transport Security)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Cache Control pour les réponses sensibles
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }

  // Supprimer les headers qui peuvent révéler des informations
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  next();
};

module.exports = securityHeaders;
