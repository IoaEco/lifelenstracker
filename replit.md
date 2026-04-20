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
- Track management: create named tracks with icons, title, and description
- Smart camera: semi-transparent ghost overlay of the previous photo for alignment, rule-of-thirds grid, accelerometer tilt indicator (native only)
- Before/after slider comparison in track detail view
- Local-first persistence with AsyncStorage (metadata) + expo-file-system (photos)

**Key files:**
- `artifacts/lifelens/context/TrackContext.tsx` — data model and persistence (Track, TrackPhoto)
- `artifacts/lifelens/app/(tabs)/index.tsx` — home screen (tracks list)
- `artifacts/lifelens/app/track/[id].tsx` — track detail + before/after slider
- `artifacts/lifelens/app/camera.tsx` — smart camera screen with overlay + sensors
- `artifacts/lifelens/components/NewTrackModal.tsx` — track creation modal
- `artifacts/lifelens/constants/colors.ts` — dark/light palette with electric cyan accent

**Design:** Dark photography aesthetic, electric cyan (#00D4FF) primary, Inter font family, supports both light and dark mode via `useColors()` hook.

**Packages installed:** expo-camera@~17.0.10, expo-sensors@~15.0.8, expo-file-system@~19.0.21, plus Expo SDK 54 pre-installed packages.
