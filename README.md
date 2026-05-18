# ecom-api

Production-ready e-commerce REST API built with NestJS, PostgreSQL and Stripe.

## Tech stack

- **NestJS** — modular architecture with guards, decorators and pipes
- **PostgreSQL + Prisma 7** — type-safe ORM with driver adapters
- **JWT** — access tokens (15min) + refresh tokens (7 days) stored hashed in DB
- **Stripe** — checkout sessions + webhook signature verification
- **SendGrid** — transactional order confirmation emails
- **Swagger** — auto-generated API documentation at `/api/docs`

## Architecture

```
src/
├── auth/          # JWT strategy, guards, role decorator
├── categories/    # Product categories CRUD
├── orders/        # Order creation with stock check + DB transaction
├── payments/      # Stripe checkout + webhook handler
├── prisma/        # Global PrismaService with pg driver adapter
└── products/      # Product CRUD, admin-only mutations
```

## Key technical decisions

**Transactions for order creation** — stock decrement and order insert run in a single Prisma transaction. If any product is out of stock, the whole operation rolls back.

**Webhook signature verification** — Stripe webhooks are verified using `stripe.webhooks.constructEvent()` with the raw request body before any processing.

**Role-based access control** — custom `RolesGuard` + `@Roles()` decorator. Admin routes are protected independently from auth routes.

**Hashed refresh tokens** — refresh tokens are bcrypt-hashed before storage, so a DB leak doesn't expose valid tokens.

## Getting started

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Run migrations
npx prisma migrate dev

# Start dev server
npm run start:dev
```

## Environment variables

```env
DATABASE_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
FRONTEND_URL=
```

## API Documentation

Available at `http://localhost:3000/api/docs` — full Swagger UI with all endpoints, request bodies and auth.

## Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /auth/register | — | Register |
| POST | /auth/login | — | Login |
| GET | /products | — | List products |
| POST | /products | Admin | Create product |
| PATCH | /products/:id | Admin | Update product |
| DELETE | /products/:id | Admin | Delete product |
| GET | /categories | — | List categories |
| POST | /categories | Admin | Create category |
| POST | /orders | User | Create order |
| GET | /orders | User/Admin | List orders |
| PATCH | /orders/:id/status | Admin | Update order status |
| POST | /payments/checkout/:orderId | User | Create Stripe session |
| POST | /payments/webhook | Stripe | Webhook handler |