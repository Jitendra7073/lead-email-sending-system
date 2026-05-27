This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Production Setup

This project uses BullMQ for background email processing, so production needs three pieces:

1. Vercel for the web app and API routes.
2. A hosted Redis/Valkey service for BullMQ.
3. An always-on worker host for `pnpm worker`.

### Environment Variables

Set these in Vercel and in the worker host:

- `REDIS_URL` - your Redis/Valkey connection string
- `APP_URL` - your deployed Vercel URL
- `BULLMQ_PROCESS_INTERVAL_MS` - repeat interval in milliseconds
- `BULLMQ_WORKER_CONCURRENCY` - worker concurrency, usually `1`
- `BULLMQ_AUTO_SCHEDULE_ON_START` - `true` on the worker host

### Worker Command

Run the BullMQ worker on a separate always-on host with:

```bash
pnpm worker
```

Do not run the worker as a Vercel serverless function. Vercel is fine for the app and API routes, but the worker must stay online continuously to process email jobs over time.
