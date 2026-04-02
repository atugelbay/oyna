# OYNA Client App

Mobile-first player portal for OYNA gaming centers.

## Structure

```
client/
├── backend/    NestJS API (port 3002, prefix /client-api)
└── frontend/   Next.js 15 mobile-first app (port 3003)
```

## Setup

### Backend

```bash
cd client/backend
npm install
npx prisma generate   # generate Prisma client (do NOT run migrate — CRM backend owns migrations)
npm run start:dev
```

Swagger docs available at: http://localhost:3002/client-api/docs

### Frontend

```bash
cd client/frontend
npm install
npm run dev
```

App available at: http://localhost:3003

## Notes

- Backend connects to the **same PostgreSQL database** as the CRM backend
- Client backend NEVER runs `prisma migrate` — only the CRM backend manages migrations
- Players registered here (role=USER) are immediately visible in the CRM's players list
- JWT secrets are **separate** from CRM backend secrets
- OTP code in MVP mode: `1234`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /client-api/auth/register | Register new player |
| POST | /client-api/auth/request-otp | Request OTP |
| POST | /client-api/auth/login | Login with OTP |
| POST | /client-api/auth/refresh | Refresh tokens |
| GET | /client-api/profile/me | Get profile |
| PATCH | /client-api/profile/me | Update profile |
| GET | /client-api/balance | Get balance |
| GET | /client-api/balance/transactions | Transaction history |
| GET | /client-api/sessions | My game sessions |
| GET | /client-api/promos | Active promotions |
