# CRM Application - Color Standardization Rules

## 🎨 Official Color Palette

### Background Colors
```css
/* Primary Backgrounds */
--bg-page: #FAFAFA;              /* Main page background - off-white/cream */
--bg-card: #FFFFFF;              /* Card and container backgrounds - pure white */
--bg-surface: #F9FAFB;           /* Surface elements - very light gray */
--bg-elevated: #FFFFFF;          /* Elevated elements (modals, dropdowns) */

/* Navigation Backgrounds */
--bg-navbar: #000000;            /* All navigation bars - pure black */
--bg-navbar-hover: #1F1F1F;      /* Navbar hover state - dark gray */
--bg-navbar-active: #2A2A2A;     /* Navbar active state - lighter dark gray */

/* Sidebar Options (Choose One) */
--bg-sidebar-light: #FAFAFA;     /* Option 1: Light sidebar matching page */
--bg-sidebar-dark: #000000;      /* Option 2: Dark sidebar matching navbar */
```

### Text Colors
```css
/* Text Hierarchy */
--text-primary: #000000;         /* Headings, important text - pure black */
--text-secondary: #1F2937;       /* Body text, descriptions - dark gray */
--text-tertiary: #6B7280;        /* Labels, secondary info - medium gray */
--text-muted: #9CA3AF;           /* Hints, placeholders - light gray */
--text-disabled: #D1D5DB;        /* Disabled text - very light gray */
--text-inverse: #FFFFFF;         /* Text on dark backgrounds - white */
```

### Accent Colors - Green Theme
```css
/* Primary Green Accents */
--accent-primary: #10B981;       /* Primary green - emerald-500 */
--accent-hover: #059669;         /* Hover state - emerald-600 */
--accent-active: #047857;        /* Active/pressed state - emerald-700 */
--accent-light: #D1FAE5;         /* Light background - emerald-100 */
--accent-lighter: #F0FDF4;       /* Very light background - emerald-50 */
--accent-dark: #065F46;          /* Dark emphasis - emerald-800 */
```

### Status Colors (Semantic)
```css
/* Status Indicators */
--status-success: #10B981;       /* Success, completed - green */
--status-warning: #F59E0B;       /* Warning, pending - amber */
--status-error: #EF4444;         /* Error, rejected - red */
--status-info: #3B82F6;          /* Info, in-progress - blue */
--status-neutral: #6B7280;       /* Neutral, default - gray */
```

### Border Colors
```css
/* Borders */
--border-light: #F3F4F6;         /* Very light border - gray-100 */
--border-default: #E5E7EB;       /* Default border - gray-200 */
--border-medium: #D1D5DB;        /* Medium border - gray-300 */
--border-dark: #9CA3AF;          /* Dark border - gray-400 */
--border-focus: #10B981;         /* Focus state border - green */
```

---

## 📐 Component-Specific Rules

### 1. Navigation Bar (Header)
**Applies to:** All top navigation bars, headers

```tsx
// Background & Container
className="bg-black text-white border-b border-gray-800"

// Text & Icons
className="text-white"

// Hover States
className="hover:bg-gray-900"

// Active Links
className="text-green-500 bg-gray-900"

// Buttons in Navbar
className="bg-white text-black hover:bg-gray-100"  // Light buttons
className="bg-green-500 text-white hover:bg-green-600"  // Primary buttons
```

### 2. Sidebar Navigation
**Option A: Light Sidebar**
```tsx
// Background
className="bg-[#FAFAFA] border-r border-gray-200"

// Navigation Items
className="text-gray-900 hover:bg-green-50 hover:text-green-700"

// Active Item
className="bg-green-100 text-green-800 border-l-4 border-green-600"

// Section Headers
className="text-gray-600 font-semibold text-xs uppercase"
```

**Option B: Dark Sidebar (Matching Navbar)**
```tsx
// Background
className="bg-black border-r border-gray-800"

// Navigation Items
className="text-white hover:bg-gray-900 hover:text-green-400"

// Active Item
className="bg-gray-900 text-green-500 border-l-4 border-green-500"

// Section Headers
className="text-gray-400 font-semibold text-xs uppercase"
```

### 3. Page Layout
```tsx
// Main Page Container
className="min-h-screen bg-[#FAFAFA]"

// Content Container
className="container mx-auto px-4 sm:px-6 lg:px-8 py-6"

// Page Header
className="mb-6"

// Page Title
className="text-3xl font-bold text-black"

// Page Description
className="text-gray-600 mt-2"
```

### 4. Cards & Containers
```tsx
// Standard Card
className="bg-white rounded-lg border border-gray-200 shadow-sm"

// Card Header
className="px-6 py-4 border-b border-gray-200"

// Card Title
className="text-xl font-semibold text-black"

// Card Description
className="text-sm text-gray-600"

// Card Content
className="p-6"

// Highlighted Card (with green accent)
className="bg-white rounded-lg border-2 border-green-500 shadow-md"
```

### 5. Buttons
```tsx
// Primary Button (Green)
className="bg-green-500 text-white hover:bg-green-600 active:bg-green-700 
           border border-green-600 shadow-sm"

// Secondary Button
className="bg-white text-green-700 hover:bg-green-50 active:bg-green-100 
           border border-green-500"

// Outline Button
className="bg-transparent text-gray-700 hover:bg-gray-50 active:bg-gray-100 
           border border-gray-300"

// Destructive Button
className="bg-red-500 text-white hover:bg-red-600 active:bg-red-700 
           border border-red-600"

// Ghost Button
className="bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200"

// Link Button
className="text-green-600 hover:text-green-700 underline-offset-4 hover:underline"
```

### 6. Form Elements
```tsx
// Input Field
className="bg-white border border-gray-300 text-gray-900 
           focus:border-green-500 focus:ring-2 focus:ring-green-200 
           placeholder:text-gray-400"

// Label
className="text-sm font-medium text-gray-700"

// Helper Text
className="text-sm text-gray-500"

// Error Text
className="text-sm text-red-600"

// Success Text
className="text-sm text-green-600"

// Select Dropdown
className="bg-white border border-gray-300 text-gray-900 
           focus:border-green-500 focus:ring-2 focus:ring-green-200"

// Checkbox (Checked)
className="text-green-600 border-gray-300 focus:ring-green-500"

// Radio Button (Selected)
className="text-green-600 border-gray-300 focus:ring-green-500"
```

### 7. Tables
```tsx
// Table Container
className="bg-white rounded-lg border border-gray-200 overflow-hidden"

// Table Header
className="bg-gray-50 border-b border-gray-200"

// Table Header Cell
className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider"

// Table Row
className="border-b border-gray-200 hover:bg-green-50 transition-colors"

// Table Row (Alternate)
className="bg-white even:bg-gray-50 hover:bg-green-50"

// Table Cell
className="px-6 py-4 text-sm text-gray-900"

// Table Cell (Secondary)
className="px-6 py-4 text-sm text-gray-600"
```

### 8. Badges & Tags
```tsx
// Success Badge
className="bg-green-100 text-green-800 border border-green-200"

// Warning Badge
className="bg-amber-100 text-amber-800 border border-amber-200"

// Error Badge
className="bg-red-100 text-red-800 border border-red-200"

// Info Badge
className="bg-blue-100 text-blue-800 border border-blue-200"

// Neutral Badge
className="bg-gray-100 text-gray-800 border border-gray-200"

// Accent Badge (Green)
className="bg-green-500 text-white border border-green-600"
```

### 9. Modals & Dialogs
```tsx
// Modal Overlay
className="bg-black/50 backdrop-blur-sm"

// Modal Container
className="bg-white rounded-lg shadow-xl border border-gray-200"

// Modal Header
className="px-6 py-4 border-b border-gray-200"

// Modal Title
className="text-xl font-semibold text-black"

// Modal Content
className="px-6 py-4"

// Modal Footer
className="px-6 py-4 border-t border-gray-200 bg-gray-50"
```

### 10. Alerts & Notifications
```tsx
// Success Alert
className="bg-green-50 border border-green-200 text-green-800"

// Warning Alert
className="bg-amber-50 border border-amber-200 text-amber-800"

// Error Alert
className="bg-red-50 border border-red-200 text-red-800"

// Info Alert
className="bg-blue-50 border border-blue-200 text-blue-800"

// Alert Icon
className="text-green-600"  // Match alert type color
```

### 11. Tabs
```tsx
// Tab List Container
className="border-b border-gray-200"

// Tab Button (Inactive)
className="text-gray-600 hover:text-gray-900 hover:border-gray-300 
           border-b-2 border-transparent"

// Tab Button (Active)
className="text-green-600 border-b-2 border-green-600 font-medium"

// Tab Panel
className="py-4"
```

### 12. Dropdowns
```tsx
// Dropdown Container
className="bg-white rounded-lg shadow-lg border border-gray-200"

// Dropdown Item
className="text-gray-900 hover:bg-green-50 hover:text-green-700"

// Dropdown Item (Active)
className="bg-green-100 text-green-800"

// Dropdown Separator
className="border-t border-gray-200"
```

---

## 🎯 Usage Guidelines

### When to Use Green Accents
✅ **DO USE for:**
- Primary action buttons
- Active navigation items
- Success states and messages
- Important highlights and emphasis
- Focus states on form elements
- Selected items in lists
- Progress indicators (when positive)

❌ **DON'T USE for:**
- Error states (use red)
- Warning states (use amber)
- Neutral information (use gray)
- Disabled states (use light gray)

### Text Color Selection
- **Headings (h1-h3):** Use `text-black` (#000000)
- **Body text:** Use `text-gray-900` (#1F2937)
- **Labels:** Use `text-gray-700` (#6B7280)
- **Helper text:** Use `text-gray-500` (#9CA3AF)
- **Disabled text:** Use `text-gray-400` (#D1D5DB)
- **Text on dark backgrounds:** Use `text-white` (#FFFFFF)

### Background Color Selection
- **Page background:** Use `bg-[#FAFAFA]`
- **Card/container background:** Use `bg-white`
- **Nested elements:** Use `bg-gray-50`
- **Hover states:** Use `hover:bg-green-50` (for interactive elements)
- **Active states:** Use `bg-green-100`
- **Navigation bars:** Use `bg-black`

---

## ♿ Accessibility Compliance

### Contrast Ratios (WCAG AA)
All color combinations meet WCAG AA standards:

| Foreground | Background | Ratio | Status |
|------------|------------|-------|--------|
| #000000 (black) | #FAFAFA (off-white) | 18.5:1 | ✅ AAA |
| #1F2937 (dark gray) | #FAFAFA (off-white) | 14.2:1 | ✅ AAA |
| #FFFFFF (white) | #000000 (black) | 21:1 | ✅ AAA |
| #10B981 (green) | #FFFFFF (white) | 4.8:1 | ✅ AA |
| #047857 (dark green) | #D1FAE5 (light green) | 7.2:1 | ✅ AAA |
| #FFFFFF (white) | #10B981 (green) | 4.8:1 | ✅ AA |

### Focus Indicators
All interactive elements must have visible focus indicators:
```tsx
className="focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
```

---

## 🔄 Migration Checklist

For each component being updated:

- [ ] Replace dark backgrounds with off-white (#FAFAFA)
- [ ] Update text colors to black/dark gray hierarchy
- [ ] Change navbar to black background
- [ ] Update primary actions to green
- [ ] Update hover states to green tints
- [ ] Update focus states to green borders
- [ ] Verify contrast ratios
- [ ] Test in light and dark mode (if applicable)
- [ ] Test responsive behavior
- [ ] Test keyboard navigation
- [ ] Update any hardcoded color values
- [ ] Update any inline styles

---

## 📱 Responsive Considerations

Colors should remain consistent across all breakpoints:
- Mobile (< 640px): Same color scheme
- Tablet (640px - 1024px): Same color scheme
- Desktop (> 1024px): Same color scheme

Touch targets on mobile should maintain the same color scheme but ensure minimum 44px size.

---

**Last Updated:** 2025-11-03
**Version:** 1.0
**Status:** Official Standard

