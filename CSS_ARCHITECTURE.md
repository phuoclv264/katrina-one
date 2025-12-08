# CSS Theming Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Theme-Aware Components                │
│                  (Uses Semantic Classes)               │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│           Semantic Utility Classes                      │
│                                                         │
│  .text-status-success    .icon-warning                 │
│  .bg-status-error        .alert-warning                │
│  .progress-bar-fill      .role-pha-che                 │
│  .completion-text-*      .shift-bg-*                   │
│                                                         │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│        CSS Variables (Defined in globals.css)           │
│                                                         │
│  --status-success        --status-warning              │
│  --status-error          --status-*-light              │
│                                                         │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│               Theme Selector (Radix UI)                │
│                                                         │
│  Light    Dark    Noel-1   Noel-2   Noel-3            │
│  :root    .dark   .noel-1  .noel-2  .noel-3           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

```
                    Browser/User Action
                          │
                          ▼
                  ┌────────────────┐
                  │  Theme Sync    │
                  │  Component     │
                  └────────┬───────┘
                           │
                ┌──────────┴──────────┐
                │                     │
                ▼                     ▼
        Check User      Check Global
        Preference      Default Theme
                │                │
                └──────┬─────────┘
                       │
                       ▼
        ┌─────────────────────────┐
        │  Set Theme Class on     │
        │  HTML Element           │
        │  (<html class="dark">)  │
        └────────────┬────────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │  CSS Variables Update   │
        │  (.dark selectors used) │
        └────────────┬────────────┘
                     │
                     ▼
        ┌─────────────────────────┐
        │  Components Rerender    │
        │  with New Colors        │
        └─────────────────────────┘
```

## Color Usage Pattern

```
Component.tsx                 globals.css                 Browser
────────────────             ────────────────            ────────

<div className="              .text-status-success {     Rendered
  text-status-success           color: hsl(var(        with:
                                --status-success));    
                              }                        color: hsl(
                                                        142 70% 45%
<div className="              :root {                 );
  bg-status-warning            --status-warning:
                                38 92% 50%;
                              }

                              .dark {
                                --status-warning:
                                38 92% 50%;
                              }

                              .noel-2 {
                                --status-warning:
                                45 90% 60%;
                              }
```

## Theme Variants

### Light (:root)
```css
:root {
  --status-success: 142 70% 45%;  /* Green */
  --status-warning: 38 92% 50%;   /* Amber */
  --status-error: 0 84% 60%;      /* Red */
}
```

### Dark (.dark)
```css
.dark {
  --status-success: 142 71% 45%;
  --status-warning: 38 92% 50%;
  --status-error: 0 84% 60%;
}
```

### Noel-1 Winter (.noel-1)
```css
.noel-1 {
  --status-success: 142 60% 50%;  /* Winter green */
  --status-warning: 38 100% 50%;  /* Bright orange */
  --status-error: 0 84% 60%;      /* Red */
}
```

### Noel-2 Christmas (.noel-2)
```css
.noel-2 {
  --status-success: 145 63% 42%;  /* Holly green */
  --status-warning: 45 90% 60%;   /* Gold */
  --status-error: 0 84% 60%;      /* Red */
}
```

### Noel-3 Modern (.noel-3)
```css
.noel-3 {
  --status-success: 142 70% 45%;  /* Green */
  --status-warning: 38 92% 50%;   /* Amber */
  --status-error: 348 83% 47%;    /* Crimson */
}
```

---

## File Structure

```
src/
├── app/
│   ├── globals.css ◄─────────────────── All colors defined here
│   │   ├── :root (light theme)
│   │   ├── .dark (dark theme)
│   │   ├── .noel-1 (winter theme)
│   │   ├── .noel-2 (christmas theme)
│   │   ├── .noel-3 (modern theme)
│   │   └── @layer utilities (semantic classes)
│   │
│   ├── (app)/
│   │   ├── monthly-task-reports/
│   │   │   └── page.tsx ◄───────────── Uses semantic classes
│   │   │       ✅ .text-status-success
│   │   │       ✅ .bg-status-warning-light
│   │   │       ✅ .progress-bar-track
│   │   │
│   │   └── attendance/
│   │       └── _components/
│   │           └── attendance-timeline.tsx ◄──── Uses semantic classes
│   │               ✅ .shift-bg-*
│   │               ✅ .role-*
│   │               ✅ .icon-warning
│   │
│   └── layout.tsx (imports globals.css)
│
└── components/
    ├── theme-provider.tsx ◄──────────── Provides Next-Themes
    └── theme-sync.tsx ◄──────────────── Syncs theme changes
```

---

## Variable Naming Convention

### Status Variables
```
--status-{type}: HSL values for foreground
--status-{type}-light: HSL values for light background
```

Types: `success`, `warning`, `error`

### Semantic Class Names
```
.text-status-{type}         ← Text color
.bg-status-{type}           ← Solid background
.bg-status-{type}-light     ← Light background
.icon-{type}                ← Icon color
.alert-{type}               ← Full alert styling
.text-alert-{type}          ← Alert text color
.progress-bar-{part}        ← Progress bar styling
.shift-bg-{number}          ← Shift background colors
.role-{name}                ← Role-specific colors
.completion-text-{status}   ← Completion indicator text
```

---

## How to Add a New Semantic Color

1. **Define variables in all themes:**
```css
:root { --my-new-color: 45 100% 60%; }
.dark { --my-new-color: 45 100% 50%; }
.noel-1 { --my-new-color: 45 100% 55%; }
.noel-2 { --my-new-color: 45 100% 60%; }
.noel-3 { --my-new-color: 45 100% 60%; }
```

2. **Create utility classes:**
```css
@layer utilities {
  .text-my-new-color { color: hsl(var(--my-new-color)); }
  .bg-my-new-color { background-color: hsl(var(--my-new-color)); }
  .icon-my-new-color { color: hsl(var(--my-new-color)); }
}
```

3. **Use in components:**
```tsx
<div className="bg-my-new-color text-my-new-color">
  Content
</div>
```

---

## Benefits Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Color Definition** | In each component | Central location (globals.css) |
| **Theme Support** | Manual for each color | Automatic across all themes |
| **Changing Colors** | Find & replace in code | Edit CSS variables |
| **Dark Mode** | Repetitive overrides | Automatic via CSS |
| **Consistency** | Easy to miss updates | One place to update |
| **Scalability** | Hard to add themes | Easy to add new themes |
| **Maintenance** | High effort | Low effort |

---

## Current Implementation Status

✅ **Phase 1: Infrastructure**
- [x] CSS variables defined for all themes
- [x] Utility classes created
- [x] Theme provider set up

✅ **Phase 2: Component Refactoring**
- [x] Monthly task reports page refactored
- [x] Attendance timeline refactored
- [x] Icon colors standardized
- [x] Progress bars standardized

✅ **Phase 3: Documentation**
- [x] Architecture documented
- [x] Quick reference guide created
- [x] Examples provided
- [x] Future enhancement suggestions noted

✅ **Phase 4: Ready for Deployment**
- [x] No TypeScript errors
- [x] No breaking changes
- [x] All themes functional
- [x] Documentation complete
