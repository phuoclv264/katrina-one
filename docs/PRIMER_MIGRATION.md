## Primer Migration - Initial Changes

What I changed in this PR (initial incremental migration):

- Added dependencies to `package.json`: `@primer/react`, `@primer/css`.
- Imported `@primer/css` and added `src/styles/primer-theme.css` for token overrides.
- Wrapped the app with Primer's `BaseStyles` in `src/app/layout.tsx`.
- Added a minimal `PrimerButtonAdapter` in `src/components/primer/Button.tsx`.
- Switched the shared `Button` implementation (`src/components/ui/button.tsx`) to render via the Primer adapter while preserving existing `variant`/`size` API and classes.
 - Added a minimal `PrimerButtonAdapter` in `src/components/primer/Button.tsx`.
 - Switched the shared `Button` implementation (`src/components/ui/button.tsx`) to render via the Primer adapter while preserving existing `variant`/`size` API and classes.
 - Added `PrimerCard` and `PrimerDialogWrapper` adapters and updated `src/components/ui/card.tsx` and `src/components/ui/dialog.tsx` to use them.
 - Added `PrimerCard` and `PrimerDialogWrapper` adapters and updated `src/components/ui/card.tsx` and `src/components/ui/dialog.tsx` to use them.
 - Added `PrimerAlertDialogWrapper` and wired it into `src/components/ui/alert-dialog.tsx`.
 - Added `PrimerToast` and `PrimerToastContainer` wrappers and wired them into `src/components/ui/pro-toast.tsx` to allow gradual style updates.

How to test locally:

1. Install dependencies:
```bash
npm install
```
2. Run the dev server:
```bash
npm run dev
```
3. Visit pages that use buttons (e.g., shift scheduling dialog) and verify visuals and keyboard/aria behavior.

Notes & rationale:
- This change is intentionally minimal and reversible. The `Button` API is unchanged for consumers.
- Primer's styles are introduced via `BaseStyles` and token overrides only; Tailwind remains active.
- Next steps: migrate `Card`, `Dialog`, `Toast` via adapters and add accessibility tests.
