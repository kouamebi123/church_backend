# Variables d'environnement Railway Backend

## À configurer dans Railway Dashboard → Backend Service → Variables

```
# Base de données PostgreSQL (fournie automatiquement par Railway)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Cache Redis (fourni automatiquement par Railway)
REDIS_URL=${{Redis.REDIS_URL}}

# JWT Secret (générez-en un nouveau sécurisé)
JWT_SECRET=votre_secret_jwt_minimum_32_caracteres_CHANGEZ_MOI

# Email SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=emmanuel.bikouame@gmail.com
SMTP_PASS=cjab vlqn gnzy iswg
EMAIL_USER=emmanuel.bikouame@gmail.com
EMAIL_PASSWORD=cjab vlqn gnzy iswg

# Application
APP_NAME=Système de Gestion d'Église
FRONTEND_URL=https://multitudeszno.up.railway.app
APP_BACKEND_URL=https://churchbackend-production.up.railway.app
NODE_ENV=production
USE_POSTGRES=true
PORT=5001

# Super Admin
SUPER_ADMIN_EMAIL=emmanuel.bikouame@gmail.com
SUPER_ADMIN_USERNAME=Emmanuel KOUAME
SUPER_ADMIN_PASSWORD=SuperAdmin2024
SUPER_ADMIN_PSEUDO=manu99
SUPER_ADMIN_PHONE=0775778652

# Église temporaire
TEMP_CHURCH_NAME=Église Principale
TEMP_CHURCH_ADDRESS=Adresse de votre église
TEMP_CHURCH_CITY=Votre ville
TEMP_CHURCH_COUNTRY=France
```

## Important

- `${{Postgres.DATABASE_URL}}` et `${{Redis.REDIS_URL}}` sont automatiquement injectés par Railway
- `FRONTEND_URL` doit pointer vers votre frontend Railway
- `APP_BACKEND_URL` doit pointer vers votre backend Railway
- Changez `JWT_SECRET` en production avec une valeur forte
