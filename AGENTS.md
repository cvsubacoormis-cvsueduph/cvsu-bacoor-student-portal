# AGENTS.md

## Setup

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev     # http://localhost:3000
```

Requires `.env` with: `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, Redis vars (`REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`).

## Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Lint | `npm run lint` |
| Run **all** tests | `npx vitest run` |
| Run **single** test file | `npx vitest run tests/upload-grades-security.test.ts` |
| Prisma Studio | `npx prisma studio` |
| Seed | `npx prisma db seed` |

There is no `npm test` script defined. Use `npx vitest run` directly. Adding one requires reading `vitest.config.ts` for test include patterns.

## Architecture

- **App Router** (`app/`): Next.js 15 App Router with `(dashboard)` route group containing all authenticated pages.
- **Server Actions** (`actions/`): Server-side mutations (grades, students, curriculum, etc.), invoked directly from client components via `"use server"`.
- **API Routes** (`app/api/`): REST endpoints for upload processing, preview, rate limiting, etc.
- **`lib/prisma.ts`**: Singleton `PrismaClient` — import as `import prisma from "@/lib/prisma"`.
- **`lib/redis.ts`**: Upstash Redis client — import as `import { redis } from "@/lib/redis"`.
- **`middleware.ts`**: Clerk middleware that checks `routeAccessMap` from `lib/settings.ts` for role-based routing. Public routes `/sign-in` and `/sign-up` bypass auth.

## Auth & Roles

Clerk stores role in `publicMetadata.role`. Roles: `admin`, `superuser`, `faculty`, `registrar`, `student`, `csg`.

Role-based page access is defined in two places that must stay in sync:
1. `middleware.ts` via `routeAccessMap` in `lib/settings.ts:5`
2. Individual pages/server actions performing their own `currentUser()` checks

The dashboard layout (`app/(dashboard)/layout.tsx:16`) also does DB-level approval checks for students and enforces `CourseAccessSchedule` time-window gating.

## Testing

- **Framework**: Vitest with `environment: "node"`, `globals: true`
- **Test files**: `tests/**/*.test.ts`
- **Setup file**: `tests/setup.ts` — mocks Clerk, Prisma, Redis, ioredis, `rate-limiter-flexible`, `xlsx`, `fast-fuzzy`, `pg`
- **Auth mocks**: `tests/__mocks__/clerk.ts` — call `setAuthAdmin()`, `setAuthFaculty()`, `setAuthStudent()`, etc. **before importing the route handler** (dynamic `import()` in a `beforeEach`). The mock must be set before the module is imported because Clerk auth runs at module-eval time.
- **Rate limiter mock**: `tests/__mocks__/rate-limiter.ts` — `rateLimiterConsume.mockResolvedValue(undefined)` to allow; `.mockRejectedValue({ msBeforeNext: 1000 })` to trigger 429.
- Tests do **NOT** hit a real database — Prisma is fully mocked. If you add a new model to `prisma/schema.prisma`, add its mock in `tests/setup.ts`.

## Database

- **Provider**: PostgreSQL via Prisma ORM
- **Neon DB branches**: CI (`neon_workflow.yml`) auto-creates a Neon branch per PR for preview environments.
- **Enums** in `schema.prisma` use custom naming (`Courses`, `Major`, `AcademicYear`, `Semester`, `Status`, `yearLevels`, `UserSex`, `Role`).
- After schema changes: `npx prisma generate` then `npx prisma db push` (or `npx prisma migrate dev`).

## Rate Limiting

Dual-layer: Redis-based (`rate-limiter-flexible` in `lib/rate-limit-redis.ts`) with PostgreSQL fallback (`lib/rate-limit-postgres.ts`). Both must work; test both paths. The cron endpoint `/api/cron/rate-limit-clean` runs daily via `vercel.json` cron to clean up PG rate limit entries.

## Key Conventions

- **ESLint**: `no-unused-vars`, `no-explicit-any`, and `no-empty-object-type` are **disabled** — don't add unused imports unless they cause runtime issues.
- **Build ignores ESLint**: `next.config.ts` sets `eslint.ignoreDuringBuilds: true`. Lint errors won't block `npm run build`, but run `npm run lint` separately to catch issues.
- **Import alias**: `@/*` maps to project root (configured in both `tsconfig.json` and `vitest.config.ts`).
- **Date/time**: Student access scheduling uses `Asia/Manila` timezone. The dashboard layout converts UTC to Manila time manually. Be careful with timezone logic when touching access scheduling.
- **SweetAlert2** and **sonner** are both used for toasts (sonner for server-side toasts via `<Toaster>`, SweetAlert2 for confirmation dialogs).
- **Composite unique keys**: Grade uniqueness is `[studentNumber, courseCode, academicYear, semester]`. SubjectOffering is `[curriculumId, academicYear, semester]`. AcademicTerm is `[academicYear, semester]`.
