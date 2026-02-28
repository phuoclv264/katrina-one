# Copilot Instructions for Katrina One

## Repository Overview

**Katrina One** is an internal management application for Katrina Coffee (Vietnamese: "Ứng dụng dành riêng cho nội bộ hệ thống Katrina Coffee"). This is a Next.js-based web application with mobile capabilities via Capacitor, designed for managing staff shifts, task checklists, inventory, and reports across multiple roles (Server/Phục vụ, Bartender/Pha chế, Manager/Quản lý, Owner/Chủ nhà hàng, Cashier/Thu ngân).

**Repository Size:** ~91,500 lines of TypeScript/TSX code across 293 source files  
**Framework:** Next.js 16.1.0 (App Router with Turbopack)  
**Runtime:** Node.js v20.x or v24.x, npm 10.x or 11.x  
**Languages:** TypeScript, React 19 (TSX)  
**UI Framework:** Tailwind CSS 3, shadcn/ui components (Radix UI primitives)  
**Backend:** Firebase (Firestore, Authentication, Storage)  
**Mobile:** Capacitor for iOS/Android builds  
**AI Integration:** Genkit AI for report summarization and inventory suggestions

## Build & Validation Commands

### Prerequisites
**ALWAYS run `npm install` first** before any build or development commands, especially after cloning or when package.json changes.

The project uses `.npmrc` with `legacy-peer-deps=true` to handle peer dependency conflicts.

### Essential Commands

1. **Install Dependencies** (ALWAYS first step)
   ```bash
   npm install
   ```
   - Takes ~25-30 seconds
   - Creates `node_modules/` with ~1030 packages
   - May show deprecation warnings (safe to ignore)
   - May report vulnerabilities (18 as of last check) — these are in transitive dependencies and do not block builds

2. **Type Checking**
   ```bash
   npm run typecheck
   ```
   - Runs `tsc --noEmit` to check TypeScript types
   - Takes ~5-10 seconds
   - Currently passes with 0 errors
   - Build does NOT depend on this — `typescript.ignoreBuildErrors: true` in `next.config.ts`

3. **Linting**
   ```bash
   npm run lint
   ```
   - Runs Next.js ESLint via `next lint`
   - **Known Issue:** Currently fails with `Invalid project directory provided` error under Next.js 16
   - **Workaround:** Do NOT run `npm run lint` — it is broken
   - Note: `next build` does not run ESLint by default in Next.js 16, so the broken lint command does not affect builds

4. **Production Build**
   ```bash
   npm run build
   ```
   - Takes ~25-60 seconds for clean builds
   - **KNOWN BUILD FAILURE:** The build currently **fails** due to a prerendering error:
     ```
     useSearchParams() should be wrapped in a suspense boundary at page "/admin/recruitment"
     ```
     - **Root cause:** `src/app/(app)/admin/recruitment/page.tsx` calls `useSearchParams()` directly without a `<Suspense>` wrapper, which Next.js 16 requires for static generation
     - **Workaround:** To test builds, you can temporarily wrap the recruitment page's `useSearchParams()` in a Suspense boundary, or skip prerendering that route
   - TypeScript errors are skipped due to `typescript.ignoreBuildErrors: true` in config
   - **Expected warnings (if build succeeds):**
     - "No build cache found" (first build only)
     - "IndexedDB is not available or cleanup failed" — expected during SSR, safe to ignore

5. **Development Server**
   ```bash
   npm run dev
   ```
   - Starts Next.js dev server on port 9002 with Turbopack
   - Access at `http://localhost:9002`
   - Hot reload enabled
   - The dev server works even when `npm run build` fails — use this for testing

6. **Production Start**
   ```bash
   npm start
   ```
   - Runs production server (requires successful `npm run build` first)

### Build Process Workflow
For code changes, follow this sequence:
1. `npm install` (if dependencies changed or starting fresh)
2. Make your code changes
3. `npm run typecheck` to check types (currently passes, not required for build)
4. `npm run dev` to test in browser at `http://localhost:9002`

**Important:** Do NOT run `npm run lint` — it currently fails. Do NOT rely on `npm run build` succeeding — there is a known prerendering failure (see above). Use `npm run dev` for development testing.

## Project Structure

### Root Directory Files
```
├── package.json              # Dependencies and scripts
├── package-lock.json         # Locked dependency versions
├── .npmrc                   # npm config (legacy-peer-deps=true)
├── tsconfig.json            # TypeScript configuration (target: ES2017, strict mode)
├── next.config.ts           # Next.js config (ignores TS build errors, custom redirects)
├── tailwind.config.ts       # Tailwind CSS configuration
├── postcss.config.mjs       # PostCSS configuration
├── .eslintrc.json          # ESLint config (extends next/core-web-vitals, next/typescript)
├── firebase.json           # Firebase configuration
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Firestore indexes
├── storage.rules           # Firebase Storage rules
├── capacitor.config.ts     # Capacitor mobile app config (app ID: com.katrinaone.app)
├── components.json         # shadcn/ui component configuration
├── .gitignore             # Git ignore patterns
├── README.md              # Project description and setup instructions
├── TESTING_PLAN.md        # Comprehensive testing scenarios (in Vietnamese)
├── TESTING_PLAN_PASS_SHIFT.md # Shift-passing/swap logic testing plan (in Vietnamese)
├── DEV_HTTPS.md           # Guide for running HTTPS dev server with mkcert
└── docs/blueprint.md      # Original app design blueprint
```

### Source Directory Structure (`src/`)
```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout (DialogProvider, ProToastProvider)
│   ├── page.tsx           # Home/login page
│   ├── globals.css        # Global styles with Tailwind directives
│   ├── (app)/            # Protected route group (SPA shell with sidebar)
│   │   ├── layout.tsx    # Dashboard layout (SidebarProvider, AppNavigationProvider)
│   │   ├── _components/  # Shared app-level components
│   │   ├── admin/        # Admin/Owner dashboard
│   │   │   ├── events/          # Events management
│   │   │   └── recruitment/     # Job application management (has build issue)
│   │   ├── attendance/          # Attendance tracking
│   │   ├── bartender/           # Bartender-specific features
│   │   │   ├── hygiene-report/  # Hygiene reporting
│   │   │   └── inventory/       # Inventory management
│   │   ├── bartender-tasks/     # Bartender task lists
│   │   ├── cashier/             # Cashier features
│   │   ├── checklist/[shift]/   # Dynamic shift checklists (sang/trua/toi)
│   │   ├── comprehensive-checklist/ # Manager comprehensive checklist
│   │   ├── daily-assignments/   # Daily task assignments
│   │   ├── financial-report/    # Financial reporting
│   │   ├── inventory-management/# Inventory management
│   │   ├── inventory-history/   # Inventory history
│   │   ├── manager/             # Manager features
│   │   ├── monthly-tasks/       # Monthly task management
│   │   ├── monthly-task-reports/# Monthly task reports
│   │   ├── product-management/  # Product management
│   │   ├── reports/             # Report viewing (by-shift, cashier, comprehensive, hygiene, inventory)
│   │   ├── reports-feed/        # Reports feed/timeline
│   │   ├── rules/               # House rules viewing
│   │   │   └── manage/          # House rules management
│   │   ├── schedule/            # Schedule viewing for staff
│   │   ├── shift-scheduling/    # Manager shift scheduling
│   │   ├── shifts/              # Shift selection/management
│   │   ├── task-lists/          # Task list management
│   │   ├── users/               # User management
│   │   └── violations/          # Violation tracking
│   ├── api/
│   │   └── image-proxy/         # Image proxy endpoint
│   └── recruitment/             # Public recruitment form page
├── components/            # Shared React components (~35 component files + ui/)
│   ├── ui/               # shadcn/ui base components (41 files)
│   ├── mobile-layout.tsx # SPA shell with virtual routing (key file for navigation)
│   ├── sidebar.tsx       # Main navigation sidebar
│   ├── bottom-nav.tsx    # Mobile bottom navigation tabs
│   ├── views/            # Role-specific dashboard views
│   └── [other shared components]
├── contexts/             # React Context providers
│   ├── dialog-context.tsx
│   └── lightbox-context.tsx
├── hooks/               # Custom React hooks
│   └── use-mobile.tsx
├── lib/                 # Core business logic and utilities
│   ├── firebase.ts      # Firebase initialization (client-side only)
│   ├── types.ts         # TypeScript type definitions (~1,424 lines, 96 types)
│   ├── data-store.ts    # Main Firestore data facade (~2,654 lines)
│   ├── schedule-store.ts # Scheduling logic (~1,873 lines, 44 exports)
│   ├── cashier-store.ts  # Cashier operations (~792 lines)
│   ├── attendance-store.ts # Attendance tracking (~599 lines)
│   ├── reports-store.ts  # Report operations
│   ├── photo-store.ts    # Photo upload/management
│   ├── ai-service.ts     # AI integration (Genkit)
│   ├── user-access-links.ts # Role-based route access rules (ACCESS_RULES array)
│   ├── navigation.ts     # Role-to-home-path mapping
│   ├── scheduler/        # Auto-scheduling algorithms
│   └── [other utilities: shift-utils, schedule-utils, notification-utils, etc.]
└── public/              # Static assets
```

### Key Configuration Details

**TypeScript Config (`tsconfig.json`):**
- Target: ES2017
- Strict mode enabled
- Path alias: `@/*` → `./src/*`
- JSX: react-jsx

**Next.js Config (`next.config.ts`):**
- **CRITICAL:** `typescript.ignoreBuildErrors: true` — TypeScript errors don't block builds
- Turbopack file system cache enabled for dev and build
- Custom redirects for apple-touch-icon
- Remote image patterns: allows all HTTPS hostnames
- Note: `next build` does not run ESLint by default in Next.js 16

**Firebase Config:**
- Hardcoded API keys in `src/lib/firebase.ts` (intentional for this client-side app)
- Client-side only initialization (check for `typeof window !== 'undefined'`)
- Uses persistent local cache with unlimited size
- Auto-detects long polling for better connectivity

**shadcn/ui Config (`components.json`):**
- Style: default
- Base color: neutral
- CSS variables enabled
- RSC (React Server Components) enabled
- Icon library: Lucide React

## Architecture & Key Patterns

### Role-Based Access Control
The app supports 5 user roles (`UserRole` type in `src/lib/types.ts`):
- **Phục vụ** (Server): Task checklists, shift selection, schedule viewing
- **Pha chế** (Bartender): Hygiene reports, inventory management
- **Thu ngân** (Cashier): Financial reporting
- **Quản lý** (Manager): Scheduling, comprehensive reports, viewing all reports
- **Chủ nhà hàng** (Owner): All features + user management, task list editing, AI summaries

Role guards are implemented via `ACCESS_RULES` in `src/lib/user-access-links.ts`. Each rule declares required roles, check-in requirements, and shift restrictions. The function `getUserAccessLinks()` dynamically resolves which routes a user can access based on their active roles and check-in status.

### Navigation Architecture
The app uses a **client-side SPA navigation pattern** via `src/components/mobile-layout.tsx`:
- **Virtual routing** using URL hashes (`#tab=<id>` for tabs, `#page=<href>` for pages)
- **Dynamic imports** load page components only when navigated to
- `renderVirtualRoute()` maps href strings to component imports
- **New pages must be registered** in `mobile-layout.tsx`'s dynamic import map AND in `ACCESS_RULES` in `user-access-links.ts`
- `sidebar.tsx` and `bottom-nav.tsx` consume the access rules to render navigation

### Data Flow
1. **Firebase Authentication** → User login/registration
2. **Firestore** → All data storage (reports, schedules, tasks, users, inventory)
3. **IndexedDB** (via `idb-keyval-store.ts`) → Local offline storage for photos and data
4. **Firebase Storage** → Uploaded photo storage
5. **AI Service** (Genkit) → Report summarization, inventory suggestions

### Offline Support
The app has extensive offline capabilities:
- Data cached in IndexedDB for offline access
- Photos stored locally before upload
- Sync detection and conflict resolution
- "Có thay đổi chưa gửi" (Has unsent changes) status indicators

### State Management
- React Context for global state (auth, dialogs, lightbox)
- Direct Firestore subscriptions for real-time updates
- Local state with React hooks
- `data-store.ts` acts as a facade that aggregates all store modules

## Common Patterns & Conventions

### File Naming
- Components: PascalCase (e.g., `TaskList.tsx`) or kebab-case (e.g., `task-reporting-view.tsx`)
- Routes: lowercase with hyphens (e.g., `shift-scheduling/`)
- Utilities: kebab-case (e.g., `data-store.ts`)
- Route-local components: `_components/` directory within the route folder

### Imports
- Use path alias `@/` for src imports: `import { Button } from '@/components/ui/button'`
- UI components from `@/components/ui/`
- Business logic from `@/lib/`
- Types from `@/lib/types`

### Styling
- Use Tailwind CSS utility classes
- Follow existing shadcn/ui component patterns
- Responsive design with mobile-first approach
- Primary color scheme defined in `tailwind.config.ts` and `globals.css`

### Comments
- Vietnamese comments are common throughout the codebase
- Add comments for complex business logic
- Document role-based restrictions

## Validation & CI/CD

**No GitHub Actions or CI/CD pipelines currently exist** in this repository. Manual validation is required:

1. `npm install` — ensure dependencies resolve
2. `npm run typecheck` — verify TypeScript types
3. `npm run dev` — test changes in the browser at `http://localhost:9002`

## Environment Setup

**No environment variables required** for building the application. Firebase configuration is hardcoded in `src/lib/firebase.ts`.

For development:
- Node.js v20.x or v24.x (tested with both)
- npm 10.x or 11.x

## Known Issues & Workarounds

### 1. Build Failure — useSearchParams Suspense Boundary (CRITICAL)
- **Error:** `useSearchParams() should be wrapped in a suspense boundary at page "/admin/recruitment"`
- **File:** `src/app/(app)/admin/recruitment/page.tsx` (in the main page component where `useSearchParams` is called)
- **Cause:** Next.js 16 requires `useSearchParams()` to be wrapped in `<Suspense>` for static prerendering
- **Impact:** `npm run build` fails — cannot produce a production build
- **Workaround:** Use `npm run dev` for development testing. If a production build is needed, wrap the component using `useSearchParams()` in a `<Suspense>` boundary or add `export const dynamic = 'force-dynamic'` to the page

### 2. Lint Command Broken
- **Error:** `Invalid project directory provided, no such directory: .../lint`
- **Cause:** `next lint` CLI parsing issue in Next.js 16
- **Impact:** `npm run lint` fails — cannot run ESLint
- **Workaround:** Do NOT run `npm run lint`. It is not required for development or builds

### 3. IndexedDB Warnings During Build/SSR
- **Warning:** "IndexedDB is not available or cleanup failed"
- **Cause:** Code in `photo-store.ts` runs during server-side rendering
- **Impact:** None — warning only, does not affect functionality
- **Action:** Ignore these warnings

### Development Considerations
- **Offline development:** Many features require Firebase connectivity
- **Authentication:** Need valid Firebase credentials to test most features
- **Mobile testing:** Use Capacitor CLI for iOS/Android builds (not covered in basic workflow)

## Testing

**No automated test infrastructure exists.** There are no test files (*.test.ts, *.spec.ts) in the repository and no test scripts in `package.json`. Playwright report artifacts exist from previous manual runs but are not currently active.

Testing plans are documented in Vietnamese:
- `TESTING_PLAN.md` — comprehensive testing scenarios covering all user roles
- `TESTING_PLAN_PASS_SHIFT.md` — shift-passing/swap logic testing (public pass, direct pass, swap request)

When adding features:
- Follow the testing scenarios outlined in `TESTING_PLAN.md`
- Test role-based access control
- Test offline functionality
- Test real-time sync between devices
- Use `npm run dev` and test in browser at `http://localhost:9002`

## Making Changes

### Before You Start
1. Read the relevant sections of `TESTING_PLAN.md` for context
2. Understand the role-based access requirements (see `src/lib/user-access-links.ts`)
3. Check `src/lib/types.ts` for data structure definitions (96 exported types)
4. If you create a new page, you must:
   - Create the route folder under `src/app/(app)/`
   - Register the component in `src/components/mobile-layout.tsx` dynamic imports
   - Add access rules in `src/lib/user-access-links.ts`
   - Update `src/components/bottom-nav.tsx` or `src/components/sidebar.tsx` if adding navigation items

### Development Workflow
1. **Clean start:**
   ```bash
   npm install
   ```
2. **Make changes** to relevant files in `src/`
3. **Type check:**
   ```bash
   npm run typecheck
   ```
4. **Test in browser:**
   ```bash
   npm run dev  # Test at http://localhost:9002
   ```

### Adding New Routes
- Create route folders under `src/app/(app)/` for protected routes
- Use route groups `()` for organizational grouping without URL segments
- Dynamic routes use `[param]` syntax (e.g., `checklist/[shift]`)
- **Always** register new pages in `mobile-layout.tsx` and `user-access-links.ts`

### Adding New Components
- Place shared components in `src/components/`
- Use shadcn/ui components from `src/components/ui/` (41 base components available)
- Route-specific components go in `_components/` within the route folder
- Follow existing patterns for role-based visibility

### Modifying Data Models
- Update types in `src/lib/types.ts`
- Update corresponding store files in `src/lib/`
- Consider backward compatibility with existing Firestore data

## Firebase & Data

**Firestore Collections** (commonly used):
- `users` — User profiles and roles
- `reports` — All types of reports (shift, hygiene, comprehensive, inventory, cashier)
- `schedules` — Shift schedules by week
- `tasks` — Server task lists
- `comprehensiveTasks` — Manager task lists
- `bartenderTasks` — Bartender task lists
- `inventory` — Inventory items and stock levels
- `shiftPassRequests` — Shift pass requests from staff
- `appSettings` — Global application settings
- `attendanceRecords` — Staff attendance tracking
- `violations` — Violation records

**Storage Buckets:**
- Photos uploaded to Firebase Storage (URL pattern in `firebase.json`)

## AI Features (Genkit)

Two AI-related scripts exist:
- `npm run genkit:dev` — Start Genkit dev server
- `npm run genkit:watch` — Start Genkit with watch mode

AI is used for:
- Report summarization (Owner role)
- Inventory ordering suggestions (Bartender role)
- Task list generation and sorting (Owner role)

## Language Notes

**Primary Language:** Vietnamese  
**UI Text:** Predominantly Vietnamese  
**Code:** English variable names with Vietnamese comments

Common Vietnamese terms in codebase:
- **Ca** — Shift (sang=morning, trưa=afternoon, tối=evening)
- **Phục vụ** — Server (role)
- **Pha chế** — Bartender (role)
- **Quản lý** — Manager (role)
- **Chủ nhà hàng** — Owner (role)
- **Thu ngân** — Cashier (role)
- **Báo cáo** — Report
- **Công việc** — Task/work
- **Lịch làm việc** — Work schedule

## Trust These Instructions

These instructions are based on thorough exploration and validated testing of the codebase. **Trust this information first** and only perform additional searches if:
1. Information here is incomplete for your specific task
2. You encounter errors not documented here
3. You need to understand implementation details of specific features

When in doubt, refer to:
1. This document first
2. `TESTING_PLAN.md` for feature behavior
3. `src/lib/types.ts` for data structures
4. Relevant store files in `src/lib/` for business logic
