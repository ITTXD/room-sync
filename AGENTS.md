<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## RoomSync Architecture & Cloudflare Deployment Guide

### 1. Database (Supabase PostgreSQL)
- **Supabase Ref**: `uurrkegtfnkncwcfsiwz` (Region: Tokyo `ap-northeast-1`)
- **Connection**:
  - `DATABASE_URL`: Transaction pooler (`aws-0-ap-northeast-1.pooler.supabase.com:6543`)
  - `DIRECT_URL`: Session pooler (`aws-0-ap-northeast-1.pooler.supabase.com:5432`)
- **Setup Script**: `npm run db:setup` (generates Prisma, pushes schema, and seeds default rooms & accounts)

### 2. Cloudflare Edge Deployment
- **Live URL**: `https://room-sync.roomsync.workers.dev`
- **Cloudflare Worker**: `room-sync`
- **Hyperdrive ID**: `f67a7f0e06104f0e83bcfa8863a3325f` (connected to port 5432)
- **Build Command**:
  ```bash
  npm run build:worker
  ```
  *(Uses `next build --webpack` to properly bundle `@prisma/adapter-pg`)*
- **Deploy Command**:
  ```bash
  CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '\"')" npx wrangler deploy
  ```

### 3. Serverless DB Lifecycle Rules
- In [`src/lib/db.ts`](src/lib/db.ts), always keep `pg.Pool` with `max: 1, maxUses: 1, idleTimeoutMillis: 1000` to prevent frozen sockets across worker invocations.

### 4. Test Accounts
- **Admin**: `admin@roomsync.io` / `Admin1234!`
- **Member**: `member@roomsync.io` / `Member1234!`

