# ⚡ NexusGaming Platform — Complete Setup Guide

## Overview

NexusGaming is a production-ready, full-stack gaming platform with:

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL
- **Auth**: JWT with email verification
- **Deployment**: Docker + Nginx + VPS

---

## Project Structure

```
nexus-gaming/
├── frontend/                 # Next.js 15 frontend
│   ├── src/
│   │   ├── app/              # Next.js app router pages
│   │   │   ├── page.tsx      # Homepage
│   │   │   ├── login/        # Login page
│   │   │   ├── register/     # Registration page
│   │   │   ├── dashboard/    # User dashboard
│   │   │   │   ├── page.tsx  # Dashboard overview
│   │   │   │   ├── deposits/ # Deposit management
│   │   │   │   ├── cashouts/ # Cashout requests
│   │   │   │   ├── games/    # Games library
│   │   │   │   ├── bonuses/  # Bonus center
│   │   │   │   ├── support/  # Support tickets
│   │   │   │   └── profile/  # User profile
│   │   │   ├── admin/        # Admin dashboard
│   │   │   │   ├── page.tsx  # Admin overview
│   │   │   │   ├── users/    # User management
│   │   │   │   ├── deposits/ # Deposit management
│   │   │   │   ├── cashouts/ # Cashout management
│   │   │   │   ├── games/    # Games management
│   │   │   │   ├── bonuses/  # Bonus management
│   │   │   │   ├── banners/  # Banner/slider CMS
│   │   │   │   ├── support/  # Support tickets
│   │   │   │   ├── reports/  # Analytics & reports
│   │   │   │   └── settings/ # Platform settings
│   │   │   ├── games/        # Public games page
│   │   │   ├── bonuses/      # Public bonuses page
│   │   │   ├── cashout-rules/# Cashout rules
│   │   │   ├── about/        # About page
│   │   │   └── contact/      # Contact page
│   │   ├── components/       # Reusable components
│   │   ├── lib/              # API client & utilities
│   │   ├── store/            # Zustand state stores
│   │   ├── types/            # TypeScript types
│   │   └── styles/           # Global CSS
│   └── public/               # Static assets
│
├── backend/                  # Express API
│   ├── src/
│   │   ├── server.ts         # Entry point
│   │   ├── routes/           # API route definitions
│   │   ├── controllers/      # Business logic
│   │   ├── middleware/        # Auth, validation, errors
│   │   ├── services/         # Email, notifications
│   │   └── utils/            # Logger, helpers
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema
│   │   └── seed.ts           # Database seeder
│   └── Dockerfile
│
├── docker/
│   └── nginx/                # Nginx configuration
├── docker-compose.yml        # Production compose
└── README.md
```

---

## Quick Start (Development)

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- npm or yarn

### 1. Clone and setup

```bash
git clone <repo-url> nexus-gaming
cd nexus-gaming
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your database and SMTP credentials
npm install
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts
npm run dev
```

Backend runs on: http://localhost:5000

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local (set NEXT_PUBLIC_API_URL=http://localhost:5000/api)
npm install
npm run dev
```

Frontend runs on: http://localhost:3000

### Default Accounts (after seed)

| Role  | Email                     | Password       |
|-------|---------------------------|----------------|
| Admin | admin@nexusgaming.com     | Admin@123456   |
| User  | player@nexusgaming.com    | User@123456    |

---

## Production Deployment (Docker)

### 1. Prepare your VPS

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y
```

### 2. Configure environment

```bash
cd nexus-gaming
cp .env.example .env

# Edit .env with production values:
nano .env
```

**Production .env:**
```env
DB_PASSWORD=YourStrongPassword123!
JWT_SECRET=your_64_char_random_secret_here
JWT_REFRESH_SECRET=your_other_64_char_secret
FRONTEND_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
NEXT_PUBLIC_TELEGRAM_URL=https://t.me/yourchannel
NEXT_PUBLIC_FACEBOOK_URL=https://m.me/yourpage
WEBHOOK_SECRET=random_webhook_secret
```

### 3. Build and launch

```bash
# Build and start all services
docker compose up -d --build

# Run database migrations
docker compose exec backend npx prisma migrate deploy

# Seed the database
docker compose exec backend npx ts-node prisma/seed.ts

# View logs
docker compose logs -f
```

### 4. SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot -y

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Copy certs
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem docker/nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem docker/nginx/ssl/

# Uncomment HTTPS block in docker/nginx/conf.d/default.conf
# Restart nginx
docker compose restart nginx
```

---

## API Documentation

### Base URL
```
https://yourdomain.com/api
```

### Authentication

All protected endpoints require:
```
Authorization: Bearer <jwt_token>
```

### Endpoints

#### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/register | Create account |
| POST | /auth/login | Login |
| GET | /auth/me | Get current user |
| POST | /auth/verify-email/:token | Verify email |
| POST | /auth/forgot-password | Request password reset |
| POST | /auth/reset-password/:token | Reset password |
| POST | /auth/logout | Logout |

#### Deposits (requires auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /deposits | List user deposits |
| POST | /deposits | Create deposit |
| GET | /deposits/:id | Get deposit detail |
| GET | /deposits/payment-methods | Available methods |

#### Withdrawals (requires auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /withdrawals | List user withdrawals |
| POST | /withdrawals | Create withdrawal |
| GET | /withdrawals/:id | Get withdrawal detail |

#### Games (requires auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /games | List games |
| GET | /games/:id | Game details |
| POST | /games/:id/download | Download game |

#### Support (requires auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /support | List tickets |
| POST | /support | Create ticket |
| GET | /support/:id | Ticket detail |
| POST | /support/:id/reply | Reply to ticket |

#### Admin (requires admin role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /admin/stats | Dashboard stats |
| GET | /admin/users | List users |
| PATCH | /admin/users/:id/ban | Ban user |
| GET | /admin/deposits | All deposits |
| PATCH | /admin/deposits/:id/approve | Approve deposit |
| PATCH | /admin/deposits/:id/reject | Reject deposit |
| GET | /admin/withdrawals | All withdrawals |
| PATCH | /admin/withdrawals/:id/approve | Approve withdrawal |
| PATCH | /admin/withdrawals/:id/reject | Reject withdrawal |
| PATCH | /admin/withdrawals/:id/paid | Mark as paid |

#### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /webhooks/payment | Generic payment webhook |
| POST | /webhooks/crypto | Crypto payment webhook |

---

## Payment Integration

### Crypto (NOWPayments)
1. Sign up at https://nowpayments.io
2. Get API key from dashboard
3. Add to `.env`: `NOWPAYMENTS_API_KEY=your_key`
4. Configure IPN URL: `https://yourdomain.com/api/webhooks/crypto`

### Custom Payment Gateway
Update `backend/src/routes/webhooks.ts` with your gateway's webhook format.

---

## Security Checklist

- [ ] Change default admin password immediately
- [ ] Use strong JWT secrets (64+ random chars)
- [ ] Enable HTTPS in production
- [ ] Configure SMTP for email verification
- [ ] Set up webhook signatures
- [ ] Review and update CORS origins
- [ ] Enable IP whitelisting for admin (in settings)
- [ ] Set up database backups
- [ ] Monitor activity logs regularly
- [ ] Keep dependencies updated

---

## Environment Variables Reference

### Backend
| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | ✅ |
| JWT_SECRET | JWT signing secret (32+ chars) | ✅ |
| JWT_REFRESH_SECRET | Refresh token secret | ✅ |
| FRONTEND_URL | Frontend URL (CORS) | ✅ |
| SMTP_HOST | Email SMTP host | ✅ |
| SMTP_USER | Email username | ✅ |
| SMTP_PASS | Email password | ✅ |
| WEBHOOK_SECRET | Webhook signature secret | ⚠️ |
| NOWPAYMENTS_API_KEY | NOWPayments API key | ⚠️ |

### Frontend
| Variable | Description |
|----------|-------------|
| NEXT_PUBLIC_API_URL | Backend API URL |
| NEXT_PUBLIC_TELEGRAM_URL | Telegram support link |
| NEXT_PUBLIC_FACEBOOK_URL | Facebook Messenger link |

---

## Useful Commands

```bash
# View all running containers
docker compose ps

# View backend logs
docker compose logs backend -f

# Restart a service
docker compose restart frontend

# Enter backend container
docker compose exec backend sh

# Database backup
docker compose exec postgres pg_dump -U nexususer nexusgaming > backup.sql

# Update and redeploy
git pull
docker compose up -d --build
```

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend Framework | Next.js 15 (App Router) |
| UI Library | React 18 + TypeScript |
| Styling | Tailwind CSS v3 |
| Animations | Framer Motion + GSAP |
| State Management | Zustand |
| Forms | React Hook Form + Zod |
| Backend | Node.js + Express + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL 16 |
| Authentication | JWT (access + refresh) |
| Email | Nodemailer |
| File Storage | Local (Docker volume) |
| Reverse Proxy | Nginx |
| Containerization | Docker + Docker Compose |
| Logging | Winston |

---

## Support

For technical support:
- Open a GitHub issue
- Contact via Telegram: @NexusGaming
- Email: support@nexusgaming.com

---

© 2024 NexusGaming. All rights reserved.
