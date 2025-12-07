# Create Settings Page and Theme System

I will implement a robust theming system that supports Default, Dark, and Noel themes, with user preferences and an owner-controlled default fallback.

## 1. Dependencies
- Install `next-themes` to manage theme switching and hydration.

## 2. Data Model Updates
- **`src/lib/types.ts`**:
  - Add `themePreference?: 'default' | 'dark' | 'noel'` to `ManagedUser`.
  - Add `defaultTheme?: 'default' | 'dark' | 'noel'` to `AppSettings`.

## 3. Theme Configuration
- **`src/app/globals.css`**: Define the `.noel` theme class with festive colors (red/green/white palette).
- **`src/components/theme-provider.tsx`**: Create a client-side provider component using `next-themes`.
- **`src/app/layout.tsx`**: Wrap the entire application in the `ThemeProvider`.

## 4. Theme Synchronization Logic
- **`src/components/theme-sync.tsx`**: Create a component that:
  - Fetches the current user's profile and the global app settings.
  - Determines the effective theme:
    - If User Pref is `dark` or `noel` -> Apply it.
    - If User Pref is `default` (or undefined) -> Check Owner Default.
      - If Owner Default is `dark` or `noel` -> Apply it.
      - If Owner Default is `default` -> Apply `light` (System default).
  - Syncs this effective theme to `next-themes` to apply the CSS.
- **`src/app/(app)/layout.tsx`**: Insert `ThemeSync` here so it runs for the logged-in app.

## 5. Settings Page Implementation
- **`src/app/(app)/settings/page.tsx`**:
  - **User Section**: "Theme Preference" (Default, Dark, Noel). Updates `ManagedUser`.
  - **Owner Section** (Visible only to 'Chủ nhà hàng'): "Global Default Theme" (Default, Dark, Noel). Updates `AppSettings`.
  - Use `dataStore` methods for Firestore updates.

## 6. Navigation
- **`src/components/sidebar.tsx`**: Add a "Settings" (Cài đặt) link to the sidebar for easy access.
