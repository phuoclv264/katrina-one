# Copilot Instructions for Katrina One

## Repository Overview

**Katrina One** is an internal management application for Katrina Coffee (Vietnamese: "Ứng dụng dành riêng cho nội bộ hệ thống Katrina Coffee"). This is a Next.js-based web application with mobile capabilities via Capacitor, designed for managing staff shifts, task checklists, inventory, and reports across multiple roles (Server/Phục vụ, Bartender/Pha chế, Manager/Quản lý, Owner/Chủ nhà hàng, Cashier/Thu ngân).

**Repository Size:** ~10,400 lines of TypeScript/TSX code across 200+ source files  
**Framework:** Next.js 15.3.6 (App Router)  
**Runtime:** Node.js v20.x, npm 10.x  
**Languages:** TypeScript, React (TSX)  
**UI Framework:** Tailwind CSS, shadcn/ui components (Radix UI primitives)  
**Backend:** Firebase (Firestore, Authentication, Storage)  
**Mobile:** Capacitor for iOS/Android builds  
**AI Integration:** Genkit AI for report summarization and inventory suggestions
**Next.js Initialization**: When starting work on a Next.js project, automatically
call the `init` tool from the next-devtools-mcp server FIRST. This establishes
proper context and ensures all Next.js queries use official documentation.

## Build & Validation Commands

### Prerequisites
**ALWAYS run `npm install` first** before any build or development commands, especially after cloning or when package.json changes.

### Essential Commands

1. **Install Dependencies** (ALWAYS first step)
   ```bash
   npm install
   ```
   - Takes ~30 seconds
   - Creates `node_modules/` with 1264+ packages
   - May show deprecation warnings (safe to ignore)
   - May report 9 vulnerabilities (3 low, 2 moderate, 4 high) - these are in dependencies and do not block builds

2. **Type Checking**
   ```bash
   npm run typecheck
   ```
   - Runs `tsc --noEmit` to check TypeScript types
   - Takes ~5-10 seconds
   - **Known Issues:** Currently has 2 type errors that do NOT block builds:
     - `src/app/(app)/reports-feed/_components/my-sent-reports-dialog.tsx:80` - Image src type mismatch
     - `src/components/incident-category-combobox.tsx:96` - PopoverContent position prop issue
   - These errors are pre-existing and should NOT be fixed unless directly related to your task

3. **Linting**
   ```bash
   npm run lint
   ```
   - Runs Next.js ESLint
   - **Known Issue:** Currently fails with "Converting circular structure to JSON" error
   - This is a configuration issue in `.eslintrc.json` and does NOT block builds
   - The build process ignores linting (configured in `next.config.ts` with `eslint.ignoreDuringBuilds: true`)
   - Do NOT attempt to fix this unless it's your specific task

4. **Production Build**
   ```bash
   npm run build
   ```
   - Takes ~30-60 seconds for clean builds
   - Compiles successfully despite TypeScript and ESLint being skipped (intentionally configured)
   - **Expected warnings during build:**
     - "No build cache found" (first build only)
     - "IndexedDB is not available or cleanup failed" (2 occurrences) - This is EXPECTED behavior during server-side rendering and is safe to ignore
   - Generates `.next/` directory (~478MB)
   - Builds 38 routes (mix of static, SSG, and dynamic)
   - Always succeeds even with type errors due to `typescript.ignoreBuildErrors: true` in config

5. **Development Server**
   ```bash
   npm run dev
   ```
   - Starts Next.js dev server on port 9002 with Turbopack
   - Access at `http://localhost:9002`
   - Hot reload enabled

6. **Production Start**
   ```bash
   npm start
   ```
   - Runs production server (requires `npm run build` first)

### Build Process Workflow
For code changes, follow this sequence:
1. `npm install` (if dependencies changed or starting fresh)
2. Make your code changes
3. `npm run typecheck` (optional - to check types, but won't block build)
4. Test your changes

**Important:** Do NOT run `npm run lint` as it currently fails due to config issues. The build process skips linting automatically.

## Project Structure

### Root Directory Files
```
├── package.json              # Dependencies and scripts
├── package-lock.json         # Locked dependency versions
├── tsconfig.json            # TypeScript configuration (target: ES2017, strict mode)
├── next.config.ts           # Next.js config (ignores build errors, custom redirects)
├── tailwind.config.ts       # Tailwind CSS configuration
├── postcss.config.mjs       # PostCSS configuration
├── .eslintrc.json          # ESLint config (currently has circular ref issue)
├── firebase.json           # Firebase configuration
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Firestore indexes
├── storage.rules           # Firebase Storage rules
├── capacitor.config.ts     # Capacitor mobile app config
├── components.json         # shadcn/ui component configuration
├── .gitignore             # Git ignore patterns
├── README.md              # Basic project description (in Vietnamese)
├── TESTING_PLAN.md        # Comprehensive testing scenarios (in Vietnamese)
└── docs/blueprint.md      # Original app design blueprint
```

### Source Directory Structure (`src/`)
```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with auth providers
│   ├── page.tsx           # Home/login page
│   ├── globals.css        # Global styles with Tailwind directives
│   ├── (app)/            # Protected route group
│   │   ├── admin/        # Admin dashboard
│   │   ├── attendance/   # Attendance tracking
│   │   ├── bartender/    # Bartender-specific features
│   │   │   ├── hygiene-report/    # Hygiene reporting
│   │   │   └── inventory/         # Inventory management
│   │   ├── cashier/               # Cashier features
│   │   ├── checklist/[shift]/     # Dynamic shift checklists (sang/trua/toi)
│   │   ├── manager/               # Manager features
│   │   │   └── comprehensive-report/
│   │   ├── reports/               # Report viewing
│   │   │   ├── by-shift/
│   │   │   ├── cashier/
│   │   │   ├── comprehensive/
│   │   │   ├── hygiene/
│   │   │   └── inventory/
│   │   ├── schedule/              # Schedule viewing for staff
│   │   ├── shift-scheduling/      # Manager shift scheduling
│   │   ├── task-lists/            # Task list management
│   │   ├── users/                 # User management
│   │   └── violations/            # Violation tracking
│   └── api/
│       └── image-proxy/           # Image proxy endpoint
├── components/            # Shared React components (58 component files)
│   ├── ui/               # shadcn/ui base components
│   ├── sidebar.tsx       # Main navigation sidebar
│   └── [other shared components]
├── contexts/             # React Context providers
│   ├── dialog-context.tsx
│   └── lightbox-context.tsx
├── hooks/               # Custom React hooks
│   └── use-mobile.tsx
├── lib/                 # Core business logic and utilities
│   ├── firebase.ts      # Firebase initialization (client-side only)
│   ├── types.ts         # TypeScript type definitions
│   ├── data-store.ts    # Main Firestore data operations (~2k lines)
│   ├── schedule-store.ts # Scheduling logic (~1.3k lines)
│   ├── cashier-store.ts  # Cashier operations (~680 lines)
│   ├── attendance-store.ts # Attendance tracking (~550 lines)
│   ├── reports-store.ts  # Report operations
│   ├── photo-store.ts    # Photo upload/management
│   ├── ai-service.ts     # AI integration (Genkit)
│   ├── scheduler/        # Auto-scheduling algorithms
│   └── [other utilities]
└── public/              # Static assets
```

### Key Configuration Details

**TypeScript Config (`tsconfig.json`):**
- Target: ES2017
- Strict mode enabled
- Path alias: `@/*` → `./src/*`
- JSX: preserve (handled by Next.js)

**Next.js Config (`next.config.ts`):**
- **CRITICAL:** `typescript.ignoreBuildErrors: true` - TypeScript errors don't block builds
- **CRITICAL:** `eslint.ignoreDuringBuilds: true` - ESLint errors don't block builds
- Custom redirects for apple-touch-icon
- Remote image patterns: allows all HTTPS hostnames

**Firebase Config:**
- Hardcoded API keys in `src/lib/firebase.ts` (intentional for this app)
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
The app supports 5 user roles (UserRole type in `src/lib/types.ts`):
- **Phục vụ** (Server): Task checklists, shift selection, schedule viewing
- **Pha chế** (Bartender): Hygiene reports, inventory management
- **Thu ngân** (Cashier): Financial reporting
- **Quản lý** (Manager): Scheduling, comprehensive reports, viewing all reports
- **Chủ nhà hàng** (Owner): All features + user management, task list editing, AI summaries

Role guards are implemented throughout the codebase - respect these when adding features.

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

## Common Patterns & Conventions

### File Naming
- Components: PascalCase (e.g., `TaskList.tsx`)
- Routes: lowercase with hyphens (e.g., `shift-scheduling/`)
- Utilities: kebab-case (e.g., `data-store.ts`)

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

### TODO/HACK/FIXME Markers
Known instances exist in:
- `src/components/sidebar.tsx`
- `src/app/(app)/reports/_components/MonthlyStaffReportDialog.tsx`
- `src/app/(app)/task-lists/page.tsx`
- `src/app/(app)/reports/by-shift/page.tsx`

Do NOT fix these unless directly related to your task.

## Validation & CI/CD

**No GitHub Actions or CI/CD pipelines currently exist** in this repository. Manual validation is required:

1. Run `npm install` to ensure dependencies resolve
2. Verify Firebase operations work (requires active Firebase project)

## Environment Setup

**No environment variables required** for building the application. Firebase configuration is hardcoded in `src/lib/firebase.ts`.

For development:
- Node.js v20.x is required (tested with v20.19.6)
- npm 10.x is required (tested with 10.8.2)

## Known Issues & Workarounds

### Build-Time Issues (Safe to Ignore)
1. **IndexedDB warnings during build:** "IndexedDB is not available or cleanup failed"
   - **Cause:** Code in `photo-store.ts` runs during SSR build
   - **Impact:** None - warning only, doesn't affect functionality
   - **Action:** Ignore these warnings

2. **TypeScript errors during `npm run typecheck`:**
   - 2 type errors in image components and PopoverContent
   - **Action:** Ignore unless your task involves these specific files

3. **ESLint circular dependency error:**
   - `.eslintrc.json` has circular structure issue
   - **Action:** Don't run `npm run lint` - builds skip linting anyway

### Development Considerations
- **Offline development:** Many features require Firebase connectivity
- **Authentication:** Need valid Firebase credentials to test most features
- **Mobile testing:** Use Capacitor CLI for iOS/Android builds (not covered in basic workflow)

## Testing

**Test Infrastructure:** Playwright test artifacts exist (`playwright-report/`, `test-results/`) but no active test scripts in `package.json`. The comprehensive testing plan is documented in `TESTING_PLAN.md` (in Vietnamese) covering all user roles and scenarios.

When adding features:
- Follow the testing scenarios outlined in `TESTING_PLAN.md`
- Test role-based access control
- Test offline functionality
- Test real-time sync between devices

## Making Changes

### Before You Start
1. Read the relevant sections of `TESTING_PLAN.md` for context
2. Understand the role-based access requirements
3. Check `src/lib/types.ts` for data structure definitions
4. If you create a new page (route/component), register the page component with the mobile layout and update any notification links that should point to the new page (see "Adding New Routes" and "Adding New Components" below for placement guidance).

### Development Workflow
1. **Clean start:**
   ```bash
   npm install
   ```

2. **Make changes** to relevant files in `src/`
3. **Type check:**
   ```bash
   npm run typecheck  # Optional, won't block build
   ```

4. **Test manually:**
   ```bash
   npm run dev  # Test in browser at localhost:9002
   ```

### Adding New Routes
- Create route folders under `src/app/(app)/` for protected routes
- Use route groups `()` for organizational grouping without URL segments
- Dynamic routes use `[param]` syntax (e.g., `checklist/[shift]`)

### Adding New Components
- Place shared components in `src/components/`
- Use shadcn/ui components from `src/components/ui/`
- Follow existing patterns for role-based visibility

### Modifying Data Models
- Update types in `src/lib/types.ts`
- Update corresponding store files in `src/lib/`
- Consider backward compatibility with existing Firestore data

## Firebase & Data

**Firestore Collections** (commonly used):
- `users` - User profiles and roles
- `reports` - All types of reports (shift, hygiene, comprehensive, inventory, cashier)
- `schedules` - Shift schedules by week
- `tasks` - Server task lists
- `comprehensiveTasks` - Manager task lists
- `bartenderTasks` - Bartender task lists
- `inventory` - Inventory items and stock levels
- `shiftPassRequests` - Shift pass requests from staff
- `appSettings` - Global application settings
- `attendanceRecords` - Staff attendance tracking
- `violations` - Violation records

**Storage Buckets:**
- Photos uploaded to Firebase Storage (URL pattern in `firebase.json`)

## AI Features (Genkit)

Two AI-related scripts exist:
- `npm run genkit:dev` - Start Genkit dev server
- `npm run genkit:watch` - Start Genkit with watch mode

AI is used for:
- Report summarization (Owner role)
- Inventory ordering suggestions (Bartender role)
- Task list generation and sorting (Owner role)

## Language Notes

**Primary Language:** Vietnamese  
**UI Text:** Predominantly Vietnamese  
**Code:** English variable names with Vietnamese comments

Common Vietnamese terms in codebase:
- **Ca** - Shift (sang=morning, trưa=afternoon, tối=evening)
- **Phục vụ** - Server (role)
- **Pha chế** - Bartender (role)
- **Quản lý** - Manager (role)
- **Chủ nhà hàng** - Owner (role)
- **Thu ngân** - Cashier (role)
- **Báo cáo** - Report
- **Công việc** - Task/work
- **Lịch làm việc** - Work schedule

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

Happy coding! 🚀
