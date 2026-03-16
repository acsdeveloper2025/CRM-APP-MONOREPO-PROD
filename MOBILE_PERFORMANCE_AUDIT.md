# Mobile Performance Audit

Scope: `crm-mobile-native`

This audit reviews runtime performance risks in the React Native client without changing code. The focus areas were React render churn, list virtualization, image/memory handling, navigation/startup cost, SQLite access patterns, and leak risks.

## Executive Summary

The main bottlenecks are architectural rather than micro-optimizations:

1. App startup is front-loaded with heavy synchronous work before first paint.
2. `TaskContext` fan-outs task changes across large parts of the tree.
3. Task list rows are relatively heavy and still receive unstable per-item props.
4. The image pipeline duplicates large-image work and can retain large files offline for long periods.
5. SQLite reads are optimized with projections, but projection rebuild strategy adds substantial write amplification and cold-start cost.

## Findings

### 1. Cold start is blocked by serialized initialization and full projection rebuild

Severity: High

Why it matters:
- The app blocks rendering on multiple async steps that are awaited in sequence.
- `ProjectionUpdater.rebuildAll()` deletes and recreates all projections during startup, which scales with local task volume.
- Notification DB loading and background daemon startup also happen before the main app UI appears.

Evidence:
- `crm-mobile-native/App.tsx:122-149`
- `crm-mobile-native/src/projections/ProjectionUpdater.ts:9-18`
- `crm-mobile-native/src/projections/ProjectionUpdater.ts:40-49`
- `crm-mobile-native/src/projections/ProjectionUpdater.ts:97-111`

Impact:
- Slower time-to-interactive.
- More noticeable startup delays as offline data grows.
- Greater likelihood of blank or spinner-only startup on older devices.

### 2. Task state mutations trigger broad rerender fan-out through `TaskContext`

Severity: High

Why it matters:
- `TaskProvider` stores the entire `tasks` array in context and exposes a large memoized value object.
- Any reload or mutation that touches `tasks` invalidates all context consumers.
- Hooks like `useTasks` and `useTask` sit on top of that context, so local task changes can ripple into task lists, detail screens, and form screens.

Evidence:
- `crm-mobile-native/src/context/TaskContext.tsx:111-147`
- `crm-mobile-native/src/context/TaskContext.tsx:161-175`
- `crm-mobile-native/src/context/TaskContext.tsx:350-396`
- `crm-mobile-native/src/hooks/useTasks.ts:10-27`
- `crm-mobile-native/src/hooks/useTask.ts:10-24`

Impact:
- Unnecessary rerenders across screens using task data.
- More JS work during task status changes, drafts, form saves, and sync refreshes.

### 3. Task list rows are heavy and only partially protected from rerender churn

Severity: High

Why it matters:
- `TaskCard` is a large item component with animations, local modal state, action buttons, and optional timeline rendering.
- The list still passes inline closures for row-specific reorder actions, which weakens memoization benefits.
- Completed rows render `TaskTimeline` inline, increasing per-row cost.
- Hidden `TaskInfoModal` and `TaskRevokeModal` instances are mounted for every row.

Evidence:
- `crm-mobile-native/src/screens/tasks/TaskListScreen.tsx:234-257`
- `crm-mobile-native/src/components/tasks/TaskCard.tsx:27-61`
- `crm-mobile-native/src/components/tasks/TaskCard.tsx:177-218`
- `crm-mobile-native/src/components/tasks/TaskCard.tsx:256-267`

Impact:
- Larger JS and layout cost per visible item.
- More expensive list updates during reorder, refresh, and task status transitions.

### 4. Notification mutations reload the entire notification dataset and rerender subscribers

Severity: High

Why it matters:
- `NotificationService` reloads the full notification list from SQLite after single-item operations like `addNotification`, `markAsRead`, `markAllAsRead`, and `clearAllNotifications`.
- Each reload calls `notifySubscribers()`, which updates all subscribed UIs.
- Dashboard and Notification Center both subscribe to the same cache.

Evidence:
- `crm-mobile-native/src/services/NotificationService.ts:47-55`
- `crm-mobile-native/src/services/NotificationService.ts:71-74`
- `crm-mobile-native/src/services/NotificationService.ts:254-259`
- `crm-mobile-native/src/services/NotificationService.ts:266-276`
- `crm-mobile-native/src/services/NotificationService.ts:281-290`
- `crm-mobile-native/src/services/NotificationService.ts:296-305`
- `crm-mobile-native/src/screens/main/DashboardScreen.tsx:151-158`
- `crm-mobile-native/src/components/ui/NotificationCenter.tsx:40-46`

Impact:
- Extra DB reads and subscriber rerenders for small notification changes.
- Noticeable UI churn if notifications become frequent.

### 5. The image pipeline duplicates large-image work and creates memory/IO spikes

Severity: High

Why it matters:
- The camera flow captures an image, renders it full-screen, then captures a second composited output using `captureRef`.
- `CameraService.savePhoto()` then moves that file and generates a thumbnail from the final image.
- This causes repeated decode, render, write, and resize work for large photos.

Evidence:
- `crm-mobile-native/src/components/media/WatermarkPreviewScreen.tsx:131-149`
- `crm-mobile-native/src/components/media/WatermarkPreviewScreen.tsx:164-166`
- `crm-mobile-native/src/services/CameraService.ts:104-125`
- `crm-mobile-native/src/services/CameraService.ts:215-247`

Impact:
- Higher peak memory during capture/save.
- More disk IO and slower evidence save path.
- Greater crash risk on low-memory devices during camera-heavy sessions.

### 6. Offline image retention can grow large and increase memory pressure over time

Severity: High

Why it matters:
- Full-size images are stored in `DocumentDirectoryPath/photos` and thumbnails in a sibling directory.
- Synced images are only cleaned up through explicit repository cleanup paths, not immediately after successful upload in the general save path.
- The gallery preview renders the full local file directly when opened.

Evidence:
- `crm-mobile-native/src/services/CameraService.ts:18-21`
- `crm-mobile-native/src/services/CameraService.ts:146-208`
- `crm-mobile-native/src/repositories/AttachmentRepository.ts:67-72`
- `crm-mobile-native/src/repositories/AttachmentRepository.ts:99-110`
- `crm-mobile-native/src/components/media/PhotoGallery.tsx:203-208`

Impact:
- Steady local storage growth for heavy field users.
- Larger working-set and slower media-related screens over time.

### 7. Dynamic form updates rerender the full form tree on every field change

Severity: High

Why it matters:
- `DynamicFormBuilder` rebuilds the next form state by cloning the whole `formValues` object on every field edit.
- Section visibility and field visibility are recomputed across all sections on each render.
- Long forms are rendered in a `ScrollView`, so the entire form tree stays mounted.

Evidence:
- `crm-mobile-native/src/screens/forms/VerificationFormScreen.tsx:291-408`
- `crm-mobile-native/src/screens/forms/DynamicFormBuilder.tsx:91-96`
- `crm-mobile-native/src/screens/forms/DynamicFormBuilder.tsx:113-154`

Impact:
- Higher typing latency on large dynamic forms.
- More work when conditional fields or required-state rules are present.

### 8. Task detail reads deserialize full JSON projections and sometimes duplicate fetch work

Severity: High

Why it matters:
- `TaskDetailProjection` stores detail rows as one JSON blob and parses the full blob on read.
- Even coordinate lookup reads `task_json` and parses the entire object again.
- `useTask` derives the task from context and separately fetches more detail plus locations on focus.

Evidence:
- `crm-mobile-native/src/projections/TaskDetailProjection.ts:5-18`
- `crm-mobile-native/src/projections/TaskDetailProjection.ts:21-38`
- `crm-mobile-native/src/hooks/useTask.ts:21-24`
- `crm-mobile-native/src/hooks/useTask.ts:37-44`
- `crm-mobile-native/src/repositories/TaskRepository.ts:74-90`

Impact:
- Avoidable JSON parse overhead on hot detail paths.
- Redundant data work when entering task details or form screens.

### 9. Projection rebuild strategy adds heavy write amplification

Severity: High

Why it matters:
- Many task mutations rebuild task projections immediately.
- `rebuildTask()` updates task projections and then recomputes the dashboard projection.
- If projection state is considered stale, list reads can escalate into `rebuildAll()`.

Evidence:
- `crm-mobile-native/src/repositories/TaskRepository.ts:113-132`
- `crm-mobile-native/src/repositories/TaskRepository.ts:144-157`
- `crm-mobile-native/src/repositories/TaskRepository.ts:159-172`
- `crm-mobile-native/src/repositories/TaskRepository.ts:174-199`
- `crm-mobile-native/src/repositories/TaskRepository.ts:201-243`
- `crm-mobile-native/src/projections/ProjectionUpdater.ts:120-128`
- `crm-mobile-native/src/projections/ProjectionUpdater.ts:148-206`
- `crm-mobile-native/src/projections/TaskListProjection.ts:71-81`

Impact:
- More SQLite writes than necessary during common task actions.
- Slower offline updates and more cold-start rebuild work.

### 10. Task search uses a leading-wildcard `LIKE`, so the projection search index is unlikely to help

Severity: Medium

Why it matters:
- Search queries are executed as `search_text LIKE '%query%'`.
- The schema creates an index on `search_text`, but leading-wildcard lookups typically bypass normal index use in SQLite.

Evidence:
- `crm-mobile-native/src/projections/TaskListProjection.ts:51-55`
- `crm-mobile-native/src/database/schema.ts:301-303`

Impact:
- Search cost grows toward a scan of `task_list_projection`.
- Search becomes slower as assignment counts rise.

### 11. Some list screens are well-virtualized, but others still pay unnecessary render cost

Severity: Medium

Why it matters:
- `TaskListScreen` uses `FlatList` with decent batch settings, but loading falls back to `ScrollView`, and the screen stacks several UI bars before the list.
- `NotificationCenter` uses `FlatList` but has no explicit batching/layout tuning and builds rich row content inline.
- `VerificationFormScreen` uses `ScrollView`, so long forms and embedded media galleries are fully mounted.

Evidence:
- `crm-mobile-native/src/screens/tasks/TaskListScreen.tsx:353-391`
- `crm-mobile-native/src/components/ui/NotificationCenter.tsx:156-201`
- `crm-mobile-native/src/components/ui/NotificationCenter.tsx:254-267`
- `crm-mobile-native/src/screens/forms/VerificationFormScreen.tsx:291-408`

Impact:
- Higher memory and layout cost on dense or long-content screens.
- More JS work during refreshes and screen transitions.

### 12. `PhotoGallery` performs repeated DB loads and renders images with limited memory controls

Severity: Medium

Why it matters:
- `loadPhotos()` runs on mount and again on focus.
- The preview opens the full local file directly in `Image`.
- The component does not provide decode-size hints, reuse policies, or progressive loading behavior.

Evidence:
- `crm-mobile-native/src/components/media/PhotoGallery.tsx:41-65`
- `crm-mobile-native/src/components/media/PhotoGallery.tsx:67-75`
- `crm-mobile-native/src/components/media/PhotoGallery.tsx:112-115`
- `crm-mobile-native/src/components/media/PhotoGallery.tsx:203-208`

Impact:
- Extra attachment queries.
- More memory pressure when previewing large evidence images.

### 13. Provider and navigation startup has extra blocking and timer overhead

Severity: Medium

Why it matters:
- `ThemeProvider` returns `null` until SQLite preference load finishes, creating another startup gate.
- `RootNavigator` blocks on version check with a timeout race.
- `AuthProvider` triggers sync work immediately after restoring or establishing auth.

Evidence:
- `crm-mobile-native/src/context/ThemeContext.tsx:24-35`
- `crm-mobile-native/src/context/ThemeContext.tsx:57-63`
- `crm-mobile-native/src/navigation/RootNavigator.tsx:119-138`
- `crm-mobile-native/src/navigation/RootNavigator.tsx:140-146`
- `crm-mobile-native/src/context/AuthContext.tsx:64-79`
- `crm-mobile-native/src/context/AuthContext.tsx:101-113`

Impact:
- More startup latency and more async work concentrated near app launch and login.

### 14. Potential timer/listener leak points exist in long-lived services

Severity: Medium

Why it matters:
- `NotificationService` uses `setTimeout` for queued sync triggers without cancellation.
- `RootNavigator` creates a timeout fallback for version check with no cleanup.
- `BackgroundSyncDaemon` uses a global interval and app-state subscription; it has cleanup, but it remains a long-lived leak hotspot if lifecycle edges are missed.
- `LocationService` watcher is singleton-based and must be explicitly stopped.

Evidence:
- `crm-mobile-native/src/services/NotificationService.ts:182-191`
- `crm-mobile-native/src/navigation/RootNavigator.tsx:122-127`
- `crm-mobile-native/src/sync/BackgroundSyncDaemon.ts:74-87`
- `crm-mobile-native/src/sync/BackgroundSyncDaemon.ts:105-118`
- `crm-mobile-native/src/services/LocationService.ts:150-193`

Impact:
- Risk of orphaned timers, retained closures, or active native listeners during lifecycle churn.

### 15. Database initialization does full schema and index statement replay every startup

Severity: Medium

Why it matters:
- Initialization splits and executes every schema and index statement on every launch before migrations complete.
- `CREATE IF NOT EXISTS` avoids duplication, but still incurs startup SQL overhead.

Evidence:
- `crm-mobile-native/src/database/DatabaseService.ts:58-68`
- `crm-mobile-native/src/database/DatabaseService.ts:70-74`

Impact:
- Small-to-moderate startup tax on every cold launch.

### 16. Dashboard and notification surfaces duplicate refresh work

Severity: Medium

Why it matters:
- Dashboard refreshes notifications from backend on focus and also subscribes to the notification cache.
- Dashboard also calls `notificationService.loadFromDb()` even though app startup already loads notifications.
- The combination creates redundant fetch/load/update paths.

Evidence:
- `crm-mobile-native/App.tsx:138-140`
- `crm-mobile-native/src/screens/main/DashboardScreen.tsx:72-79`
- `crm-mobile-native/src/screens/main/DashboardScreen.tsx:151-157`

Impact:
- Unnecessary DB and network churn when returning to the dashboard.

## Coverage Against Requested Areas

### 1. Unnecessary React rerenders
- `TaskContext` broad invalidation.
- Full dynamic form rerenders on each field edit.
- Notification subscriber rerenders after full-list reloads.

### 2. Inefficient `FlatList` usage
- Heavy `TaskCard` rows with unstable closures.
- `NotificationCenter` list lacks stronger tuning for larger datasets.
- Some large-content screens still use `ScrollView` instead of virtualization.

### 3. Heavy component trees
- `TaskCard` contains actions, animations, modal trees, and timelines.
- `VerificationFormScreen` keeps photo galleries and dynamic form content mounted together.

### 4. Inline functions causing rerender cascades
- Per-item move handlers in `TaskListScreen`.
- Notification row press handlers and various inline view callbacks across dense list rows.

### 5. Image rendering inefficiencies
- Full-size image preview and watermark composition.
- Thumbnails help, but previews still decode large originals.

### 6. Memory risks from image handling
- Duplicated image capture pipeline.
- Long-lived offline storage of full-size photos.
- Full image preview in modal without memory-aware image pipeline.

### 7. Navigation performance issues
- Startup gating in `RootNavigator`.
- Large form/detail screens pushed as full-screen content with fully mounted subtrees.

### 8. Startup performance issues
- Serialized initialization in `App.tsx`.
- Theme/auth/version checks add extra gates.
- Full projection rebuild at launch.

### 9. SQLite query inefficiencies
- JSON parsing in task detail projections.
- Leading-wildcard search.
- Projection rebuild-on-write strategy.
- Repeated list/log/photo reloads around focus and mutations.

### 10. Potential memory leaks
- Queued sync timeout in notifications.
- Version-check timeout without cleanup.
- Long-lived background and geolocation watchers require strict lifecycle discipline.

## Highest-Value Follow-Up Areas

If this audit is used to guide future work, the highest-return areas are:

1. Split read models from mutation context so task changes do not rerender the whole task tree.
2. Remove full projection rebuild from cold start and reduce rebuild-on-write frequency.
3. Simplify task list row composition and centralize row-level modals outside each card.
4. Rework the image pipeline to avoid repeated large-image composition and reduce offline file buildup.
5. Make notification updates incremental instead of reloading the full list after each mutation.

## Notes

- No code was modified for this audit.
- Findings are based on code-path analysis, not profiling traces from a running device build.
