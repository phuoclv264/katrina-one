# CSS Theme Refactoring - Quick Reference

## What Changed?

The app now uses **global CSS variables only** for theming. This means you can change any color used in the app by just editing `src/app/globals.css`.

## Where to Change Colors

### File: `src/app/globals.css`

All theme colors are defined in CSS variables. Look for these sections:

1. **:root** - Light theme colors
2. **.dark** - Dark theme colors  
3. **.noel-1** - Winter frozen theme
4. **.noel-2** - Christmas theme
5. **.noel-3** - Modern Christmas theme

### Example: Changing Status Colors

Want to change the "success" green color across the entire app?

In `globals.css`, find the `:root` section and update:
```css
:root {
  ...
  --status-success: 142 70% 45%;  /* Change these numbers */
  --status-success-light: 142 70% 92%;
  ...
}

.dark {
  ...
  --status-success: 142 71% 45%;  /* Update dark mode too */
  --status-success-light: 142 71% 20%;
  ...
}

.noel-1 {
  --status-success: 142 60% 50%;  /* Update each theme */
  --status-success-light: 142 60% 25%;
  ...
}
```

**That's it!** All components using `.text-status-success` or `.bg-status-success` will automatically update across all pages.

## Color Format

Colors use HSL (Hue, Saturation, Lightness):
- **Hue**: 0-360 degrees (0=red, 120=green, 240=blue)
- **Saturation**: 0-100% (0=gray, 100=full color)
- **Lightness**: 0-100% (0=black, 50=normal, 100=white)

Example: `142 70% 45%` = Green-ish, saturated, medium brightness

## Class Names Used in Components

All components use semantic class names, not hardcoded colors:

### Status/Progress
- `.text-status-success`, `.text-status-warning`, `.text-status-error`
- `.bg-status-success`, `.bg-status-warning`, `.bg-status-error`
- `.bg-status-success-light`, `.bg-status-warning-light`, `.bg-status-error-light`
- `.completion-text-success`, `.completion-text-warning`, `.completion-text-error`
- `.progress-bar-track`, `.progress-bar-fill`

### Alerts
- `.alert-success`, `.alert-warning`, `.alert-error`
- `.text-alert-success`, `.text-alert-warning`, `.text-alert-error`

### Icons
- `.icon-success`, `.icon-warning`, `.icon-error`

### Attendance/Shifts
- `.shift-bg-1` through `.shift-bg-6` (shift background colors)
- `.role-phuc-vu`, `.role-pha-che`, `.role-thu-ngan`, `.role-quan-ly`, `.role-chu-nha-hang`, `.role-default`

## How to Add a New Theme Color

1. Add the variable to all 5 theme sections in `globals.css`:
```css
:root { --my-color: 45 100% 60%; }
.dark { --my-color: 45 100% 50%; }
.light { --my-color: 45 100% 60%; }
.noel-1 { --my-color: 45 100% 55%; }
.noel-2 { --my-color: 45 100% 60%; }
.noel-3 { --my-color: 45 100% 60%; }
```

2. Create utility classes:
```css
@layer utilities {
  .text-my-color { color: hsl(var(--my-color)); }
  .bg-my-color { background-color: hsl(var(--my-color)); }
}
```

3. Use in components:
```tsx
<div className="bg-my-color text-my-color">Hello</div>
```

## Files Modified

- ✅ **src/app/globals.css** - All theme colors and utilities
- ✅ **src/app/(app)/monthly-task-reports/page.tsx** - Uses new color classes
- ✅ **src/app/(app)/attendance/_components/attendance-timeline.tsx** - Uses new color classes

## Benefits

✅ **Easy Theme Changes** - Edit CSS, not code  
✅ **Consistent** - All colors defined in one place  
✅ **No Hardcoding** - No color values scattered in components  
✅ **Theme Switching** - Themes automatically apply to all components  
✅ **Accessible** - Easy to audit color contrast and accessibility  
✅ **Maintainable** - Clear, semantic class names  

## Testing Colors

When you add or change a color:

1. Update `globals.css`
2. Refresh your browser
3. Test with all 5 themes (Light, Dark, Noel-1, Noel-2, Noel-3)
4. Check mobile and desktop
5. Verify color contrast for accessibility

## Need Help?

See `CSS_REFACTORING_SUMMARY.md` for detailed documentation.
