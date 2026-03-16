# Mobile UI Audit

## Scope

This document is a read-only UI/UX audit of the mobile application under:

- `crm-mobile-native/src/screens`
- `crm-mobile-native/src/components`

It identifies design inconsistencies, visual hierarchy issues, layout problems, and opportunities to modernize the interface. No code changes are included here.

## Executive Summary

The app is functionally organized, but the visual system is fragmented. The strongest issues are:

- theme token drift caused by many hardcoded colors and one-off styles
- repeated implementations of cards, buttons, modals, and badges
- task and form screens that present too much information with similar visual weight
- inconsistent touch target sizing in high-frequency field workflows
- typography and spacing patterns that are not consistently derived from the theme

The main design risk is not one screen being bad in isolation. It is that the UI system does not behave like a system. Similar interactions often look different, and different interactions often look equally important.

## 1. Inconsistent Colors And Styling

### Findings

- A theme token system exists in `crm-mobile-native/src/theme/Theme.ts`, but many screens bypass it with hardcoded colors.
- The login screen uses a custom dark-slate palette instead of the app theme:
  - `crm-mobile-native/src/screens/auth/LoginScreen.tsx`
- Dynamic form sections use a blue accent system that does not align with the primary green brand color:
  - `crm-mobile-native/src/screens/forms/DynamicFormBuilder.tsx`
- The error boundary uses its own separate dark/light palette logic instead of the theme context:
  - `crm-mobile-native/src/components/ErrorBoundary.tsx`
- The background optimization modal is completely unthemed and uses literal white/black values:
  - `crm-mobile-native/src/components/BackgroundOptimizationModal.tsx`
- Camera-related screens intentionally diverge from the app theme, which is acceptable, but they still introduce additional literal colors and opacity patterns with no shared design language:
  - `crm-mobile-native/src/components/media/CameraCaptureScreen.tsx`
  - `crm-mobile-native/src/components/media/WatermarkPreviewScreen.tsx`
- Skeleton loaders and the spinner are also hardcoded rather than theme-aware:
  - `crm-mobile-native/src/components/ui/Skeleton.tsx`
  - `crm-mobile-native/src/components/Spinner.tsx`

### Impact

- The app does not feel visually unified.
- Dark mode consistency is fragile.
- Semantic meaning of color is diluted because blue, green, amber, and red are reused in conflicting ways.

### Improvement Opportunities

- Enforce theme-only color usage outside of immersive camera surfaces.
- Add semantic tokens for:
  - overlays
  - destructive surfaces
  - badge backgrounds
  - card accents
  - status pills
- Convert skeletons, fallbacks, and error states to theme-based styling.

## 2. Inconsistent Spacing And Layout Patterns

### Findings

- Similar card-based screens use different padding, corner radius, shadow intensity, and section spacing:
  - `crm-mobile-native/src/screens/main/DashboardScreen.tsx`
  - `crm-mobile-native/src/screens/main/ProfileScreen.tsx`
  - `crm-mobile-native/src/screens/tasks/TaskDetailScreen.tsx`
  - `crm-mobile-native/src/screens/main/SyncLogsScreen.tsx`
- The task list screen stacks many separate utility bars before showing content:
  - title
  - sort
  - reorder
  - search
  - filter tabs
  - file: `crm-mobile-native/src/screens/tasks/TaskListScreen.tsx`
- The form screen uses many independent containers with similar spacing but slightly different measurements:
  - `crm-mobile-native/src/screens/forms/VerificationFormScreen.styles.ts`
- Some components use 16-based spacing, others 20 or 24, and some compact rows collapse to 6 or 8 without a clear rule:
  - `crm-mobile-native/src/components/tasks/TaskCard.tsx`
  - `crm-mobile-native/src/components/profile/DataCleanupManager.tsx`
  - `crm-mobile-native/src/components/tasks/TaskInfoModal.tsx`

### Impact

- The app feels assembled screen by screen instead of following a coherent layout grid.
- Dense screens become visually tiring because spacing does not consistently guide scanning.

### Improvement Opportunities

- Standardize:
  - screen horizontal gutter
  - card padding
  - section spacing
  - header spacing
  - footer action spacing
- Create shared layout primitives for:
  - screen section
  - elevated card
  - list row
  - sticky footer

## 3. Repeated UI Elements That Should Be Reusable Components

### Findings

- Multiple card shells are implemented independently:
  - dashboard stat cards
  - task detail section cards
  - profile info cards
  - sync log cards
  - form section cards
- Multiple modal patterns exist:
  - `crm-mobile-native/src/components/Modal.tsx`
  - `crm-mobile-native/src/components/AutoSaveRecoveryModal.tsx`
  - `crm-mobile-native/src/components/BackgroundOptimizationModal.tsx`
  - `crm-mobile-native/src/components/tasks/TaskInfoModal.tsx`
  - `crm-mobile-native/src/components/tasks/TaskRevokeModal.tsx`
- Input controls are implemented in two different systems:
  - `crm-mobile-native/src/components/FormControls.tsx`
  - `crm-mobile-native/src/screens/forms/DynamicFieldRenderer.tsx`
- Button styling is redefined on many screens instead of using shared variants.
- Badge styling is duplicated for:
  - task status
  - unread counts
  - notification priority
  - attachment types
  - sync states

### Impact

- UI drift increases over time because each new screen creates its own version.
- Fixing spacing or interaction issues becomes expensive because patterns are not centralized.

### Improvement Opportunities

- Introduce reusable primitives:
  - `Card`
  - `SectionCard`
  - `PrimaryButton`
  - `SecondaryButton`
  - `DangerButton`
  - `IconButton`
  - `Badge`
  - `BottomSheetModal`
  - `EmptyState`
  - `ScreenHeader`
  - `FormField`

## 4. Screens That Look Cluttered

### Findings

- `crm-mobile-native/src/screens/tasks/TaskDetailScreen.tsx`
  - Too many sections with similar visual treatment.
  - Primary action is separated from the most important facts by a long metadata stack.
- `crm-mobile-native/src/screens/forms/VerificationFormScreen.tsx`
  - Combines evidence capture, outcome selection, warnings, dynamic form rendering, and submission in one long page.
  - The intended step flow exists conceptually but is not visually simplified enough.
- `crm-mobile-native/src/screens/main/ProfileScreen.tsx`
  - Combines personal profile, theme switching, diagnostics, data cleanup, and logout in one surface.
  - Maintenance tools overwhelm a basic profile page.
- `crm-mobile-native/src/components/tasks/TaskInfoModal.tsx`
  - Presents a long data dump instead of grouped information.

### Impact

- Important actions do not stand out.
- Field agents have to visually parse too much metadata before reaching action points.

### Improvement Opportunities

- Collapse secondary metadata behind expandable sections.
- Move destructive maintenance tools to a separate diagnostics/settings page.
- Turn task detail into:
  - summary hero
  - action block
  - evidence/status snapshot
  - expandable details

## 5. Poor Visual Hierarchy

### Findings

- `crm-mobile-native/src/screens/main/DashboardScreen.tsx`
  - Sync center, stats, and recent activity all compete for attention.
  - The current main action is not clearly dominant.
- `crm-mobile-native/src/screens/tasks/TaskDetailScreen.tsx`
  - Label-value rows all use similar styling, so scanning priority is weak.
- `crm-mobile-native/src/screens/forms/DynamicFieldRenderer.tsx`
  - Form labels are uppercase and visually loud even when they are low-priority descriptors.
- `crm-mobile-native/src/components/media/PhotoGallery.tsx`
  - Small cards combine preview, type badge, sync badge, and delete control in a limited space, making each artifact harder to scan.
- `crm-mobile-native/src/components/profile/DigitalIdCard.tsx`
  - The card attempts to fit too much information into a small format, causing hierarchy to collapse into tiny text.

### Impact

- Users have to read more instead of recognizing hierarchy at a glance.
- Dense screens become cognitively heavier than necessary.

### Improvement Opportunities

- Reduce uppercase labels except for small metadata tags.
- Increase contrast between:
  - screen title
  - section title
  - primary value
  - supporting metadata
- Use quieter containers and reserve strong color for actionable or exceptional states.

## 6. Poor Touch Target Sizes

### Findings

- Task card footer actions are compact and not suited to frequent one-handed use:
  - `crm-mobile-native/src/components/tasks/TaskCard.tsx`
- Task reorder controls are especially small:
  - `crm-mobile-native/src/components/tasks/TaskCard.tsx`
- Filter and sort pills in the task list are narrow and short:
  - `crm-mobile-native/src/screens/tasks/TaskListScreen.tsx`
- Photo gallery overlay controls are also compact:
  - preview hint
  - delete button
  - preview close button
  - file: `crm-mobile-native/src/components/media/PhotoGallery.tsx`
- Notification header actions in the full-screen notification center have minimal hit area:
  - `crm-mobile-native/src/components/ui/NotificationCenter.tsx`

### Impact

- High-frequency actions are harder to use in real field conditions.
- Tap accuracy decreases under motion, fatigue, or glare.

### Improvement Opportunities

- Normalize all interactive targets to at least 44x44.
- Add larger icon-button variants for task actions and media controls.
- Increase padding around filter tabs and utility actions.

## 7. Inconsistent Button Styles

### Findings

- Primary button treatments vary widely across screens:
  - login submit button
  - update button
  - sync button
  - task detail footer button
  - accept task button
- Secondary and destructive actions vary even more:
  - dashed logout button
  - text-only modal actions
  - bordered neutral buttons
  - filled destructive buttons
  - utility row buttons
- Button height and radius are inconsistent:
  - 44-ish
  - 48
  - 52
  - 56
- Label styles also vary between semibold, bold, and plain body text.

### Impact

- Users cannot build a stable expectation for primary vs secondary vs destructive actions.
- CTA hierarchy changes from screen to screen.

### Improvement Opportunities

- Define a formal button system:
  - primary
  - secondary
  - tertiary
  - danger
  - icon
  - segmented
- Standardize:
  - heights
  - corner radius
  - label sizes
  - icon spacing
  - disabled state treatment

## 8. Typography Inconsistencies

### Findings

- Typography tokens exist in `crm-mobile-native/src/theme/Theme.ts`, but most screens do not use them directly.
- Font sizes vary widely across the app with no consistent typographic scale.
- Uppercase labels with tracking are overused in:
  - task detail
  - force update
  - dynamic forms
  - profile
- `crm-mobile-native/src/components/profile/DigitalIdCard.tsx` uses many text sizes in the 8-11 range, which is too small for comfortable mobile viewing.
- Diagnostic surfaces use monospace and hardcoded typography that are acceptable in context, but still disconnected from the design system:
  - `crm-mobile-native/src/components/ErrorBoundary.tsx`

### Impact

- The interface lacks a predictable reading rhythm.
- Small metadata text often becomes illegible under real-world mobile conditions.

### Improvement Opportunities

- Introduce a consistent text hierarchy:
  - display
  - screen title
  - section title
  - body
  - meta
- Reduce use of uppercase labels.
- Raise minimum practical text sizes, especially for ID card and micro badges.

## 9. Screens That Could Be Simplified

### Findings

- `crm-mobile-native/src/screens/tasks/TaskDetailScreen.tsx`
  - Too much detail before the user acts.
- `crm-mobile-native/src/screens/forms/VerificationFormScreen.tsx`
  - Should feel like a guided step flow rather than a long mixed-content screen.
- `crm-mobile-native/src/screens/main/ProfileScreen.tsx`
  - Contains too many unrelated functions.
- `crm-mobile-native/src/screens/main/SyncLogsScreen.tsx`
  - Exposes raw queue traffic as the main default UX.
- `crm-mobile-native/src/components/tasks/TaskInfoModal.tsx`
  - Shows all fields flat instead of grouped.

### Simplification Opportunities

- Task detail:
  - show critical info first
  - move secondary metadata behind collapsible groups
- Verification form:
  - separate evidence, outcome, and details more clearly
  - make submission readiness visible
- Profile:
  - split account info from maintenance tools
- Sync logs:
  - default to health summary first, raw traffic second

## 10. Opportunities To Modernize The UI Design

### Opportunities

- Build a small mobile design system from the existing theme tokens.
- Replace ad hoc cards with a small set of composable surfaces.
- Use bottom sheets instead of mixed modal patterns where appropriate.
- Strengthen the task execution flow with:
  - evidence counters
  - completion checklist
  - progress state
  - clearer submission readiness
- Modernize the dashboard into a stronger operational home surface instead of a sequence of generic cards.
- Rework profile/settings into clearer information architecture with a dedicated maintenance area.
- Improve photo/evidence UI with larger controls, clearer sync states, and less badge clutter.

## Priority View

### High Priority

- Remove color/token drift
- Standardize button styles
- Increase touch targets in task and media flows
- Reduce clutter in task detail and verification form screens

### Medium Priority

- Replace repeated modal/card patterns with reusable primitives
- Normalize typography and spacing
- Simplify profile and sync diagnostics IA

### Lower Priority But Valuable

- Refresh dashboard visual direction
- Redesign digital ID card for readability
- Improve camera overlay and watermark preview polish

## Most Important Files For UI Refactor Planning

### Theme and tokens

- `crm-mobile-native/src/theme/Theme.ts`

### High-traffic screens

- `crm-mobile-native/src/screens/main/DashboardScreen.tsx`
- `crm-mobile-native/src/screens/tasks/TaskListScreen.tsx`
- `crm-mobile-native/src/screens/tasks/TaskDetailScreen.tsx`
- `crm-mobile-native/src/screens/forms/VerificationFormScreen.tsx`

### Core repeated UI

- `crm-mobile-native/src/components/tasks/TaskCard.tsx`
- `crm-mobile-native/src/components/tasks/TaskInfoModal.tsx`
- `crm-mobile-native/src/components/tasks/TaskRevokeModal.tsx`
- `crm-mobile-native/src/components/ui/NotificationCenter.tsx`
- `crm-mobile-native/src/components/media/PhotoGallery.tsx`
- `crm-mobile-native/src/components/FormControls.tsx`
- `crm-mobile-native/src/screens/forms/DynamicFieldRenderer.tsx`
- `crm-mobile-native/src/screens/forms/DynamicFormBuilder.tsx`

## Final Assessment

The mobile app does not need a full visual rewrite to improve substantially. The fastest gains will come from unifying tokens, consolidating repeated UI patterns, increasing touch target sizes, and simplifying the densest screens. The current UX is usable, but it is carrying too much visual inconsistency for a field-execution product where speed, clarity, and confidence matter.
