# Before & After: CSS Refactoring Examples

## Example 1: Progress Bar with Status Colors

### BEFORE (Hardcoded Colors)
```tsx
<div className="w-24 h-1.5 bg-secondary rounded-full mt-2 overflow-hidden">
  <div 
    className={`h-full transition-all ${
      completionPercentage === 100 
        ? "bg-emerald-500" 
        : completionPercentage >= 50 
        ? "bg-amber-500" 
        : "bg-rose-500"
    }`} 
    style={{ width: `${completionPercentage}%` }} 
  />
</div>

<div className={`text-2xl font-bold ${
  completionPercentage === 100 
    ? "text-emerald-600 dark:text-emerald-400" 
    : completionPercentage >= 50 
    ? "text-amber-600 dark:text-amber-400" 
    : "text-rose-600 dark:text-rose-400"
}`}>
  {completionPercentage}%
</div>
```

**Problems:**
- ❌ Hardcoded color names scattered in code
- ❌ Difficult to change colors across the app
- ❌ Not theme-aware (uses fixed emerald/amber/rose)
- ❌ Repetitive conditional logic

### AFTER (CSS Variables)
```tsx
<div className="progress-bar-track mt-2">
  <div 
    className={`progress-bar-fill ${
      completionPercentage === 100 
        ? "bg-status-success" 
        : completionPercentage >= 50 
        ? "bg-status-warning" 
        : "bg-status-error"
    }`} 
    style={{ width: `${completionPercentage}%` }} 
  />
</div>

<div className={`${
  completionPercentage === 100 
    ? "completion-text-success" 
    : completionPercentage >= 50 
    ? "completion-text-warning" 
    : "completion-text-error"
}`}>
  {completionPercentage}%
</div>
```

**Benefits:**
- ✅ Semantic class names
- ✅ Colors defined in CSS only
- ✅ Automatically theme-aware
- ✅ Easy to change colors in `globals.css`

---

## Example 2: Success Status Icon & Badge

### BEFORE
```tsx
<div className="p-2 rounded-lg flex-shrink-0 bg-emerald-100 dark:bg-emerald-900">
  <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
</div>

<div className="flex-shrink-0">
  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
</div>
```

**Problems:**
- ❌ Three different class definitions for one color
- ❌ Dark mode override needed in every usage
- ❌ Not maintainable if changing emerald to another color
- ❌ Inconsistent (some use 600, some use 400)

### AFTER
```tsx
<div className="p-2 rounded-lg flex-shrink-0 bg-status-success-light">
  <User className="h-4 w-4 icon-success" />
</div>

<div className="flex-shrink-0">
  <CheckCircle2 className="h-5 w-5 icon-success" />
</div>
```

**Benefits:**
- ✅ Single semantic class per element
- ✅ No dark mode overrides needed
- ✅ All emerald references in one place
- ✅ Easy to test and audit

---

## Example 3: Alert/Warning Message

### BEFORE
```tsx
<Alert variant="default" className="border-0 bg-amber-100/30 dark:bg-amber-900/20 p-3">
  <div className="flex items-start gap-2">
    <MessageSquareText className="h-4 w-4 mt-0.5 text-amber-700 dark:text-amber-400 flex-shrink-0" />
    <AlertDescription className="text-amber-800 dark:text-amber-300 text-xs">
      {record.note}
    </AlertDescription>
  </div>
</Alert>
```

**Problems:**
- ❌ 6 different amber color references
- ❌ Duplicated dark mode overrides
- ❌ Hard to ensure consistent shade
- ❌ Tight coupling to Tailwind colors

### AFTER
```tsx
<Alert variant="default" className="alert-warning">
  <div className="flex items-start gap-2">
    <MessageSquareText className="h-4 w-4 mt-0.5 icon-warning flex-shrink-0" />
    <AlertDescription className="text-alert-warning text-xs">
      {record.note}
    </AlertDescription>
  </div>
</Alert>
```

**Benefits:**
- ✅ Single class for the entire alert
- ✅ No dark mode overrides needed
- ✅ Consistent appearance
- ✅ Update all warnings by changing one CSS variable

---

## Example 4: Shift Background Colors (Attendance Timeline)

### BEFORE
```tsx
const SHIFT_BG_COLORS = [
  'bg-blue-100/50 dark:bg-blue-900/20', 
  'bg-cyan-100/50 dark:bg-cyan-900/20',
  'bg-yellow-100/50 dark:bg-yellow-900/20', 
  'bg-indigo-100/50 dark:bg-indigo-900/20',
  'bg-purple-100/50 dark:bg-purple-900/20', 
  'bg-pink-100/50 dark:bg-pink-900/20'
];

// ...usage:
className={cn("absolute top-0 bottom-0 -z-10", SHIFT_BG_COLORS[index % 6])}
```

**Problems:**
- ❌ Long, hard to read strings
- ❌ Each color is different (blue, cyan, yellow, etc.)
- ❌ Not theme-aware (uses fixed Tailwind colors)
- ❌ Difficult to adjust opacity or saturation globally

### AFTER
```tsx
const SHIFT_BG_COLORS = ['shift-bg-1', 'shift-bg-2', 'shift-bg-3', 'shift-bg-4', 'shift-bg-5', 'shift-bg-6'];

// ...usage:
className={cn("absolute top-0 bottom-0 -z-10", SHIFT_BG_COLORS[index % 6])}
```

**In globals.css:**
```css
.shift-bg-1 { @apply bg-blue-100/50 dark:bg-blue-900/20; }
.shift-bg-2 { @apply bg-cyan-100/50 dark:bg-cyan-900/20; }
// ... etc
```

**Benefits:**
- ✅ Clean, semantic class names
- ✅ Easy to swap colors across all shifts
- ✅ Centralized color definitions
- ✅ Can change all shift colors at once in CSS

---

## Example 5: Role-Based Colors (User Roles)

### BEFORE
```tsx
const getRoleBarColor = (role?: string): string => {
  switch (role) {
    case 'Phục vụ': return 'bg-blue-500/70 hover:bg-blue-500 border-blue-600/50';
    case 'Pha chế': return 'bg-green-500/70 hover:bg-green-500 border-green-600/50';
    case 'Thu ngân': return 'bg-orange-500/70 hover:bg-orange-500 border-orange-600/50';
    case 'Quản lý': return 'bg-purple-500/70 hover:bg-purple-500 border-purple-600/50';
    case 'Chủ nhà hàng': return 'bg-rose-500/70 hover:bg-rose-500 border-rose-600/50';
    default: return 'bg-gray-500/70 hover:bg-gray-500 border-gray-600/50';
  }
};
```

**Problems:**
- ❌ Very long strings with hardcoded values
- ❌ Hard to match hover states consistently
- ❌ Color definitions spread across roles
- ❌ Difficult to change all role colors at once

### AFTER
```tsx
const getRoleBarColor = (role?: string): string => {
  switch (role) {
    case 'Phục vụ': return 'role-phuc-vu';
    case 'Pha chế': return 'role-pha-che';
    case 'Thu ngân': return 'role-thu-ngan';
    case 'Quản lý': return 'role-quan-ly';
    case 'Chủ nhà hàng': return 'role-chu-nha-hang';
    default: return 'role-default';
  }
};
```

**In globals.css:**
```css
.role-phuc-vu { @apply bg-blue-500/70 hover:bg-blue-500 border-blue-600/50; }
.role-pha-che { @apply bg-green-500/70 hover:bg-green-500 border-green-600/50; }
// ... etc
```

**Benefits:**
- ✅ Clean, readable function
- ✅ Semantic role names
- ✅ All role colors in one place
- ✅ Easy to adjust all roles at once

---

## Summary of Changes

| Aspect | Before | After |
|--------|--------|-------|
| **Color Definition** | Scattered in components | Centralized in `globals.css` |
| **Theme Support** | Manual dark mode overrides | Automatic via CSS variables |
| **Class Names** | Hardcoded Tailwind colors | Semantic utility classes |
| **Maintainability** | Find & replace needed | Single place to update |
| **Theme Switching** | Limited support | Full 5-theme support |
| **Accessibility Audit** | Search all files | Check `globals.css` only |

The refactoring makes the codebase **cleaner, more maintainable, and fully theme-aware**.
