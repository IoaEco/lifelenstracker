# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### LifeLens — `artifacts/lifelens` (Expo mobile app, previewPath: `/`)

A cross-platform mobile app for tracking long-term life changes with photos.

**Core Features:**
- Track management: create named tracks with icons, title, description, and optional per-track measurement (label + unit) for quantitative progress charting
- Per-photo measurement values: capture numeric values at shoot time (review screen), edit later via photo tap, visualized with deltas in compare view and a line chart in MeasurementPanel
- Smart camera: semi-transparent ghost overlay of the previous photo for alignment, rule-of-thirds grid, accelerometer tilt indicator (native only)
- Before/after slider comparison in track detail view
- Local-first persistence with AsyncStorage (metadata) + expo-file-system (photos)
- Optional cloud backup: sign in with Clerk (email + password) to sync tracks and photos across devices via the API server (Postgres metadata + Object Storage for photo bytes), with last-write-wins merge by `updatedAt` and tombstones for deletes.

**Key files:**
- `artifacts/lifelens/context/TrackContext.tsx` — data model, local persistence, and cloud sync orchestration
- `artifacts/lifelens/lib/cloudSync.ts` — authed fetch helpers for `/api/sync/*` and `/api/storage/uploads/request-url`
- `artifacts/lifelens/app/_layout.tsx` — wraps the app in `ClerkProvider` (uses `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`)
- `artifacts/lifelens/app/(tabs)/index.tsx` — home screen with account button
- `artifacts/lifelens/app/account.tsx` — account / sync status / sign-out screen
- `artifacts/lifelens/app/sign-in.tsx`, `sign-up.tsx` — custom Clerk email+password flows
- `artifacts/lifelens/app/track/[id].tsx` — track detail + before/after slider
- `artifacts/lifelens/app/camera.tsx` — smart camera screen with overlay + sensors
- `artifacts/lifelens/components/NewTrackModal.tsx` — track creation modal
- `artifacts/lifelens/constants/colors.ts` — dark/light palette with electric cyan accent

**API server endpoints for sync** (`artifacts/api-server`): `GET /api/sync/snapshot`, `POST /api/sync/push`, `POST /api/storage/uploads/request-url`. All require a Clerk Bearer token; `requireAuth` middleware upserts the Clerk user into `users` and attaches `req.userId`.

**Design:** Dark photography aesthetic, electric cyan (#00D4FF) primary, Inter font family, supports both light and dark mode via `useColors()` hook.

**Packages installed:** expo-camera@~17.0.10, expo-sensors@~15.0.8, expo-file-system@~19.0.21, plus Expo SDK 54 pre-installed packages.
