# Seat Reservation Platform

A small public seat reservation platform built for the Senior Engineer technical assessment. It shows three seats, lets authenticated users select one, runs a mock payment flow, and reserves the seat only after successful payment completion.

## Stack

- Next.js App Router with TypeScript
- Prisma with SQLite for local review
- NextAuth credentials login with 90-day JWT sessions
- Mock payment API with success/failure paths
- Vitest coverage for reservation invariants

## Features

- Public seat availability page with exactly three seats: `A1`, `A2`, and `A3`.
- Demo login using seeded credentials.
- Session expiry configured to 90 days.
- Authenticated seat selection and payment intent creation.
- Mock checkout page with successful and failed payment buttons.
- Final reservation happens only after successful payment completion.
- Failed payments keep seats available.
- Already-reserved seats cannot be selected or paid for.
- Repeated payment completion is idempotent.
- Ownership checks prevent one user completing another user's payment.
- Conflict response when a seat is reserved before payment completion.

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
npm install
```

### Environment

Copy the example environment file:

```bash
cp .env.example .env
```

For local development the defaults are:

```bash
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
```

Use a long random value for `NEXTAUTH_SECRET` outside local demo use.

### Database

Create the local SQLite database and seed demo data:

```bash
npm run db:migrate
npm run db:seed
```

The seed creates:

- User: `demo@example.com`
- Password: `password123`
- Seats: `A1`, `A2`, `A3`

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` - start the development server.
- `npm run build` - generate Prisma client and build the app.
- `npm run start` - start a production server after build.
- `npm run lint` - run ESLint.
- `npm test` - reset a test SQLite database and run Vitest.
- `npm run db:migrate` - run Prisma migrations locally.
- `npm run db:seed` - seed the demo user and three seats.
- `npm run db:studio` - inspect the database with Prisma Studio.

## Architecture Notes

The core workflow is intentionally explicit:

1. A logged-in user selects an available seat.
2. The app creates a `PENDING` payment for that user and seat.
3. The mock checkout completes as success or failure.
4. On success, the server re-checks the payment owner and seat state inside a database transaction.
5. The seat is updated from `AVAILABLE` to `RESERVED` with a conditional update.
6. A reservation record is created and the payment is marked `SUCCEEDED`.

The most important invariant lives in `src/lib/reservations.ts`: a seat is never reserved during selection or payment creation. It is reserved only when payment completion succeeds.

## Failure Handling

- Unauthenticated payment API calls return `401`.
- Invalid request payloads return `422`.
- Missing payments or seats return `404`.
- Payment ownership violations return `403`.
- Seat availability races return `409`.
- Failed mock payments mark the payment failed and leave the seat available.
- Repeated successful completion returns the existing reservation result without duplicating records.

## Trade-Offs

- SQLite keeps setup fast for reviewers. Production should use Postgres or another database with stronger operational tooling for concurrency, backups, and observability.
- Mock payment completion is synchronous. A real integration should use hosted checkout, signed webhooks, idempotency keys from the payment provider, and refund/void handling if inventory conflicts after charge.
- The app does not hold seats while a user is on the payment page. That avoids abandoned hold cleanup, but a user can lose the seat if another payment completes first.
- Credentials auth is used for assessment speed. Production should add rate limiting, email verification, password reset, stronger password policy, and possibly a managed identity provider.
- Tests focus on business invariants rather than exhaustive UI behavior because payment/reservation correctness is the highest-risk part of this workflow.

## Verification Checklist

1. Visit the home page while logged out and confirm all three seats render.
2. Select an available seat and confirm the app sends you to login.
3. Log in with `demo@example.com` / `password123`.
4. Select a seat and proceed to payment.
5. Click `Mock failed payment` and confirm the seat remains available.
6. Create a new payment for the same seat.
7. Click `Mock successful payment` and confirm the seat becomes reserved.
8. Refresh the home page and confirm reservation state persists.
9. Try selecting the reserved seat and confirm it is disabled.
10. Run `npm test`, `npm run lint`, and `npm run build`.
