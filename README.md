# Email Sending System

A full-stack email campaign management and automation platform built with Next.js. Manage contacts, create multi-step email sequences, schedule sends across timezones, and track replies — all from a single dashboard.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) with React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| UI Components | Radix UI + shadcn/ui |
| Rich Text Editor | TipTap |
| Charts | Recharts |
| Database | PostgreSQL (Supabase or self-hosted) |
| ORM / Query | Raw SQL via `pg` connection pool |
| Queue | BullMQ + Redis/Valkey |
| Email Transport | Nodemailer (SMTP, Gmail OAuth) |
| Email Verification | Apify API |
| Auth | Password-based with JWT (jose) |
| Build Optimization | React Compiler enabled |

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Login page and auth layout
│   ├── (dashboard)/         # All dashboard pages (contacts, campaigns, etc.)
│   └── api/                 # REST API routes
│       ├── auth/            # Login, logout, session check
│       ├── campaigns/       # Campaign CRUD + stats
│       ├── contacts/        # Contact management, import, queue, sync
│       ├── sequences/       # Email sequence builder
│       ├── templates/       # Email template CRUD
│       ├── senders/         # SMTP sender configuration
│       ├── aliases/         # Email alias management
│       ├── email-replies/   # Reply tracking via Gmail
│       ├── countries/       # Country/timezone data
│       ├── queue/           # Queue control endpoints
│       └── status/          # Dashboard stats
├── components/              # React components (UI, dashboard, layout)
├── lib/
│   ├── db/                  # PostgreSQL connection pool + helpers
│   ├── email/               # Sender, reply tracker, dependency manager, Gmail client
│   ├── queue/               # Queue processor, status manager, dependency activator
│   ├── schedule/            # Timezone-aware scheduling calculator
│   ├── services/            # Apify email verification
│   ├── supabase/            # Supabase admin client
│   └── timezone/            # Region config, business hours, weekend rules
scripts/                     # Utility scripts (migrations, workers, diagnostics)
database/migrations/         # SQL migration files
```

---

## Features

### Contact Management
- Import contacts from CSV or manual entry
- Store email, phone, LinkedIn, website, and country data
- Auto-detect timezone from country code
- Email deliverability verification via Apify
- Filter and search with multiple criteria

### Email Campaigns
- Create campaigns targeting contact groups
- Assign template sequences with ordered steps
- Track campaign progress (queued → sending → sent/failed)
- Per-campaign statistics and analytics

### Email Sequences
- Build multi-step email sequences
- Configure delay between steps (days/hours)
- Dependency chains — step N sends only after step N-1 succeeds
- Reusable across multiple campaigns

### Timezone-Aware Scheduling
- Detect recipient timezone from country
- Schedule delivery during business hours
- Skip weekends (configurable per region)
- Handle DST transitions gracefully

### Multi-Sender Support
- Configure multiple SMTP senders
- Daily sending limit per sender with auto-reset
- Round-robin or manual sender assignment
- Email alias support (send from alias, authenticate with main account)

### Reply Tracking
- Gmail API integration to detect replies
- Match replies to sent emails via Message-ID headers
- Dashboard view of engagement metrics

### Queue Processing
- BullMQ-based reliable background processing
- Configurable batch size and retry logic
- Sender daily limit enforcement
- Dependency activation for follow-up emails
- Redis-based distributed locking

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (local or Supabase)
- Redis or Valkey instance (for BullMQ queue)
- pnpm (recommended) or npm

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Key variables to configure:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `DATABASE_SSL` | `true` for Supabase, `false` for local |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `APP_PASSWORD` | Dashboard login password |
| `JWT_SECRET` | Secret for signing session tokens |
| `REDIS_URL` | Redis/Valkey connection string |
| `GMAIL_CLIENT_ID` | Google OAuth client ID (for reply tracking) |
| `GMAIL_CLIENT_SECRET` | Google OAuth secret |

See `.env.example` for the full list with descriptions.

### 3. Set Up the Database

Run the migration scripts to create required tables:

```bash
node scripts/run-migration.js
```

Or apply individual migrations from `database/migrations/` and `migrations/` directories.

### 4. Start Development

```bash
# Terminal 1: Next.js dev server
pnpm dev

# Terminal 2: BullMQ worker (processes email queue)
pnpm worker
```

Open [http://localhost:3000](http://localhost:3000) and log in with your configured `APP_PASSWORD`.

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Next.js development server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm worker` | Start BullMQ email queue worker |
| `pnpm worker:legacy` | Start legacy polling-based worker |
| `pnpm lint` | Run ESLint |

---

## How It Works

### Email Sending Flow

```
1. User creates a Campaign
   └── Selects a template group (sequence of email templates)
   └── Targets contacts (all, by country, by filter)

2. System queues emails
   └── Calculates send time per recipient timezone
   └── Respects business hours and weekends
   └── Creates dependency chain for multi-step sequences

3. BullMQ Worker processes the queue
   └── Picks up due items (scheduled_at <= NOW)
   └── Checks sender daily limits
   └── Sends via Nodemailer (SMTP)
   └── Records Message-ID for reply tracking
   └── Activates dependent follow-up emails on success
   └── Retries on failure (up to max_retries)

4. Reply tracking (optional)
   └── Gmail API polls for replies
   └── Matches via Message-ID / In-Reply-To headers
   └── Updates engagement metrics
```

### Queue Item Lifecycle

```
pending → sending → sent
                  → failed (retries exhausted)
                  → skipped (sender limit reached)
```

### Authentication Flow

The app uses a simple password-based auth system:
1. User submits password at `/login`
2. Server validates against `APP_PASSWORD` env var
3. JWT token issued and stored as HTTP-only cookie
4. API routes check the cookie on each request

---

## Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `contacts` | Contact records with email, timezone, verification status |
| `email_queue` | Queue items with status, scheduled time, dependencies |
| `email_campaigns` | Campaign metadata and status |
| `email_sequences` | Sequence definitions |
| `email_sequence_items` | Individual steps within a sequence |
| `email_templates` | HTML email templates with variables |
| `email_senders` | SMTP credentials and daily limits |
| `email_aliases` | Alias addresses linked to senders |
| `email_replies` | Tracked reply messages |
| `email_verifications` | Deliverability check results |
| `email_settings` | App-level key/value settings |
| `country_timezones` | Timezone and business hours per country |
| `sites` | Website/source data for contacts |
| `template_groups` | Groups of templates for campaigns |
| `template_group_mapping` | Template-to-group ordering |

---

## Template Variables

Email templates support dynamic variables that get replaced at send time:

| Variable | Replaced With |
|----------|--------------|
| `{{sender_name}}` | Sender's display name |
| `{{receiver_email}}` | Recipient's email address |
| `{{website_url}}` | Contact's associated website |
| `{{region}}` | Contact's country/region name |

---

## Production Deployment

### Vercel + Render Trigger Mode

This project can run with the full app on Vercel and only the BullMQ timer on Render.
In that mode, the Render worker does not send SMTP directly. It calls:

```
POST /api/workers/process-due-queue
Authorization: Bearer WORKER_SECRET
```

The Vercel endpoint runs the existing queue processor, sends due emails, updates
queue status, and activates follow-up dependencies. Set the same `WORKER_SECRET`
on both Vercel and the worker host.

If the worker is deployed as a Render Free Web Service instead of a Background
Worker, `scripts/bullmq-worker.ts` also starts a small health server on
`process.env.PORT`. Render can use `/health` for port detection while the same
process continues running the BullMQ trigger.

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Vercel    │────▶│  PostgreSQL  │◀────│  BullMQ     │
│  (App +     │     │  (Supabase)  │     │  Worker     │
│   API)      │     └──────────────┘     │  (Always-on)│
└─────────────┘              ▲            └──────┬──────┘
                             │                   │
                      ┌──────┴──────┐            │
                      │ Redis/Valkey│◀───────────┘
                      └─────────────┘
```

### Deployment Steps

1. **Web App**: Deploy to Vercel. Set all env vars in the Vercel dashboard.
2. **Database**: Use Supabase (managed PostgreSQL) or any PostgreSQL host.
3. **Redis**: Use a managed Redis/Valkey service (e.g., Upstash, AWS ElastiCache).
4. **Worker**: Deploy to an always-on host (e.g., Railway, Render, EC2). Run:
   ```bash
   pnpm worker
   ```

> The worker must run continuously — do NOT deploy it as a serverless function.

### Worker Environment Variables

Set these on the worker host:

```
DATABASE_URL=...
REDIS_URL=...
APP_URL=https://your-vercel-app.vercel.app
WORKER_SECRET=same-secret-as-vercel
BULLMQ_PROCESS_INTERVAL_MS=60000
BULLMQ_WORKER_CONCURRENCY=1
BULLMQ_AUTO_SCHEDULE_ON_START=true
```

---

## Development Tips

- **Adding a new API route**: Create a folder under `src/app/api/` with a `route.ts` file. Use `executeQuery()` from `@/lib/db/postgres` for database access.
- **Adding a dashboard page**: Create a folder under `src/app/(dashboard)/` with a `page.tsx` file. It automatically gets the sidebar layout.
- **UI components**: This project uses shadcn/ui. Add new components with the shadcn CLI or create them in `src/components/ui/`.
- **Database changes**: Write SQL migration files in `database/migrations/` and apply with `node scripts/run-migration.js`.
- **Queue processing logic**: Core logic lives in `src/lib/queue/queue-processor.ts`. The BullMQ worker in `scripts/bullmq-worker.ts` calls the processor on a repeating schedule.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Database connection fails | Check `DATABASE_URL` and `DATABASE_SSL` values |
| Emails not sending | Ensure the BullMQ worker is running (`pnpm worker`) |
| Sender limit reached | Limits reset daily at midnight UTC automatically |
| Queue items stuck in "sending" | Worker may have crashed mid-send; items auto-recover on next run |
| Gmail reply tracking fails | Verify OAuth tokens and `GMAIL_*` env vars |

---

## License

Private project. Not licensed for redistribution.
