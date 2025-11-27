# CRM-Mobile Task-Centric Naming Refactor Guide

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 0: Git Safety Checkpoint](#step-0-git-safety-checkpoint)
4. [Day 1: Core Types Migration](#day-1-core-types-migration)
5. [Day 2: Context & State Management](#day-2-context--state-management)
6. [Day 3: Services Layer](#day-3-services-layer)
7. [Day 4: Components (Part 1)](#day-4-components-part-1)
8. [Day 5: Screens](#day-5-screens)
9. [Day 6: Hooks & Final Cleanup](#day-6-hooks--final-cleanup)
10. [Day 7: Verification & Testing](#day-7-verification--testing)
11. [Rollback Instructions](#rollback-instructions)
12. [Testing Checklist](#testing-checklist)

---

## Overview

This guide provides step-by-step instructions for refactoring the `crm-mobile` app from case-centric to task-centric naming.

**What changes:**

- `Case` → `VerificationTask`
- `CaseStatus` → `TaskStatus`
- `CaseContext` → `TaskContext`
- `caseService` → `taskService`
- All related files, variables, and references

**What stays the same:**

- All business logic
- Offline-first behavior
- Sync mechanisms
- Multi-task-per-case support
- Save/submission flows

---

## Prerequisites

Before starting:

1. **Backup your work** - commit and push all changes
2. **Close the dev server** - stop `npm run dev`
3. **Have a clean working directory** - `git status` should be clean
4. **Be on the main branch** - `git checkout main`
5. **Have latest code** - `git pull origin main`

---

## Step 0: Git Safety Checkpoint

**⚠️ CRITICAL: DO THIS FIRST BEFORE ANY CHANGES**

```bash
# Ensure you're on main
git checkout main

# Pull latest
git pull origin main

# Commit any uncommitted work
git add .
git commit -m "pre-refactor backup: save current state before task-centric naming refactor"

# Push to remote (IMPORTANT - this is your backup!)
git push origin main
```

**Create refactor branch:**

```bash
git checkout -b refactor/task-centric-naming
```

**Rollback point:** If anything goes wrong, you can always:

```bash
git checkout main
git branch -D refactor/task-centric-naming
```

---

## Day 1: Core Types Migration

### Goal

Rename `Case` interface to `VerificationTask` and `CaseStatus` enum to `TaskStatus` in `types.ts`.

### Manual Steps

#### 1. Open `types.ts`

#### 2. Rename the Case interface (line ~1750)

**Find:**

```typescript
export interface Case {
```

**Replace with:**

```typescript
export interface VerificationTask {
```

#### 3. Rename the CaseStatus enum (line ~2)

**Find:**

```typescript
export enum CaseStatus {
```

**Replace with:**

```typescript
export enum TaskStatus {
```

#### 4. Update all type references within types.ts

**Search and replace patterns:**

- `: Case;` → `: VerificationTask;`
- `: Case[` → `: VerificationTask[`
- `<Case>` → `<VerificationTask>`
- `CaseStatus.` → `TaskStatus.`
- `: CaseStatus` → `: TaskStatus`

**Using VS Code:**

1. Open Find & Replace (Cmd/Ctrl + H)
2. Enable regex mode
3. Apply each pattern above

**Using command line:**

```bash
cd /Users/mayurkulkarni/Downloads/CRM-APP-MONOREPO-PROD/crm-mobile

perl -i -pe 's/^export interface Case \{/export interface VerificationTask {/g' types.ts
perl -i -pe 's/^export enum CaseStatus \{/export enum TaskStatus {/g' types.ts
perl -i -pe 's/: Case;/: VerificationTask;/g' types.ts
perl -i -pe 's/: Case\[/: VerificationTask[/g' types.ts
perl -i -pe 's/<Case>/<VerificationTask>/g' types.ts
perl -i -pe 's/CaseStatus\./TaskStatus./g' types.ts
perl -i -pe 's/: CaseStatus/: TaskStatus/g' types.ts
```

### Commit Day 1

```bash
git add types.ts
git commit -m "refactor(day1): rename Case to VerificationTask and CaseStatus to TaskStatus"
```

### Testing Checkpoint

```bash
# Try to compile (will have errors in other files - that's expected)
npm run type-check
```

**Expected:** TypeScript errors in files that still import `Case` and `CaseStatus`. This is normal - we'll fix them in the next days.

**Rollback if needed:**

```bash
git reset --hard HEAD~1
```

---

## Day 2: Context & State Management

### Goal

Rename `CaseContext.tsx` to `TaskContext.tsx` and update all state management logic.

### Manual Steps

#### 1. Rename the file

```bash
git mv context/CaseContext.tsx context/TaskContext.tsx
```

#### 2. Update TaskContext.tsx content

Open `context/TaskContext.tsx` and make these changes:

**Update imports:**

```typescript
// Find:
import { Case, CaseStatus } from "../types";

// Replace with:
import { VerificationTask, TaskStatus } from "../types";
```

**Update interface:**

```typescript
// Find:
interface CaseContextType {

// Replace with:
interface TaskContextType {
```

**Update state declaration:**

```typescript
// Find:
const [cases, setCases] = useState<Case[]>([]);

// Replace with:
const [tasks, setTasks] = useState<VerificationTask[]>([]);
```

**Update all method signatures:**

- `const fetchCases` → `const fetchTasks`
- `const updateCaseStatus` → `const updateTaskStatus`
- `const updateCase` → `const updateTask`

**Update all variable references:**

- `cases` → `tasks`
- `case` → `task`
- `caseId` → `taskId`
- `caseData` → `taskData`
- `currentCase` → `currentTask`

**Update context creation:**

```typescript
// Find:
const CaseContext = createContext<CaseContextType | undefined>(undefined);

// Replace with:
const TaskContext = createContext<TaskContextType | undefined>(undefined);
```

**Update provider:**

```typescript
// Find:
<CaseContext.Provider value={{...}}>

// Replace with:
<TaskContext.Provider value={{...}}>
```

**Update hook export:**

```typescript
// Find:
export const useCases = () => {
  const context = useContext(CaseContext);

// Replace with:
export const useTasks = () => {
  const context = useContext(TaskContext);
```

#### 3. Update all imports across the app

**Files to update:** Every file that imports from `CaseContext`

**Search pattern:**

```typescript
// Find:
from '../context/CaseContext'
from './context/CaseContext'

// Replace with:
from '../context/TaskContext'
from './context/TaskContext'
```

**Also update:**

- `useCases()` → `useTasks()`
- `const { cases, ...` → `const { tasks, ...`

**Command line approach:**

```bash
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/from.*CaseContext.*$/from "..\/context\/TaskContext"/g' {} \;

find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/useCases/useTasks/g' {} \;

find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/import \{ Case, CaseStatus \}/import { VerificationTask, TaskStatus }/g' {} \;
```

### Commit Day 2

```bash
git add .
git commit -m "refactor(day2): rename CaseContext to TaskContext and update state management"
```

### Testing Checkpoint

```bash
# Compile check
npm run type-check

# Start dev server
npm run dev
```

**Test:**

1. App should load without crashing
2. Navigate to Assigned tab - should show tasks
3. Try to accept a task - should work
4. Check In Progress tab - task should appear

**If issues:** Check console for errors, verify all imports are updated

**Rollback if needed:**

```bash
git reset --hard HEAD~1
```

---

## Day 3: Services Layer

### Goal

Rename `caseService.ts` → `taskService.ts` and `caseStatusService.ts` → `taskStatusService.ts`.

### Manual Steps

#### 1. Rename service files

```bash
git mv services/caseService.ts services/taskService.ts
git mv services/caseStatusService.ts services/taskStatusService.ts
```

#### 2. Update taskService.ts

Open `services/taskService.ts`:

**Update imports:**

```typescript
// Find:
import { Case, CaseStatus, VerificationType } from "../types";

// Replace with:
import { VerificationTask, TaskStatus, VerificationType } from "../types";
```

**Update interface:**

```typescript
// Find:
interface BackendCase {

// Replace with:
interface BackendTask {
```

**Update method signatures:**

- `async getCases()` → `async getTasks()`
- `async updateCase()` → `async updateTask()`
- `async getCase()` → `async getTask()`

**Update return types:**

- `: Promise<Case[]>` → `: Promise<VerificationTask[]>`
- `: Promise<Case>` → `: Promise<VerificationTask>`

**Update variable names:**

- `cases` → `tasks`
- `case` → `task`
- `backendCase` → `backendTask`

#### 3. Update taskStatusService.ts

Open `services/taskStatusService.ts`:

**Update imports:**

```typescript
// Find:
import { Case, CaseStatus } from "../types";
import caseService from "./caseService";

// Replace with:
import { VerificationTask, TaskStatus } from "../types";
import taskService from "./taskService";
```

**Update class name:**

```typescript
// Find:
export class CaseStatusService {

// Replace with:
export class TaskStatusService {
```

**Update method names:**

- `updateCaseStatus` → `updateTaskStatus`

**Update references:**

- `caseService` → `taskService`
- `CaseStatus.` → `TaskStatus.`

#### 4. Update all service imports

**Files to update:** Any file that imports these services

**Search and replace:**

```typescript
// Find:
from '../services/caseService'
from './services/caseService'

// Replace with:
from '../services/taskService'
from './services/taskService'
```

```typescript
// Find:
from '../services/caseStatusService'
from './services/caseStatusService'

// Replace with:
from '../services/taskStatusService'
from './services/taskStatusService'
```

**Update class references:**

- `CaseStatusService` → `TaskStatusService`
- `caseService.getCases()` → `taskService.getTasks()`
- `caseService.updateCase()` → `taskService.updateTask()`

**Command line:**

```bash
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/from.*caseService.*$/from "..\/services\/taskService"/g' {} \;

find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/from.*caseStatusService.*$/from "..\/services\/taskStatusService"/g' {} \;

find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/CaseStatusService/TaskStatusService/g' {} \;
```

### Commit Day 3

```bash
git add .
git commit -m "refactor(day3): rename caseService to taskService and caseStatusService to taskStatusService"
```

### Testing Checkpoint

```bash
npm run type-check
npm run dev
```

**Test:**

1. Accept a task - verify it calls the correct service
2. Check network tab - API calls should still work
3. Test offline mode - local storage should work
4. Verify sync behavior

**Rollback if needed:**

```bash
git reset --hard HEAD~1
```

---

## Day 4: Components (Part 1)

### Goal

Rename `CaseCard`, `AcceptCaseButton`, and `CaseTimeline` components.

### Manual Steps

#### 1. Rename component files

```bash
git mv components/CaseCard.tsx components/TaskCard.tsx
git mv components/AcceptCaseButton.tsx components/AcceptTaskButton.tsx
git mv components/CaseTimeline.tsx components/TaskTimeline.tsx
```

#### 2. Update TaskCard.tsx

Open `components/TaskCard.tsx`:

**Update imports:**

```typescript
// Find:
import { Case, CaseStatus } from "../types";

// Replace with:
import { VerificationTask, TaskStatus } from "../types";
```

**Update interface:**

```typescript
// Find:
interface CaseCardProps {
  caseData: Case;

// Replace with:
interface TaskCardProps {
  taskData: VerificationTask;
```

**Update component:**

```typescript
// Find:
const CaseCard: React.FC<CaseCardProps> = ({ caseData, ...

// Replace with:
const TaskCard: React.FC<TaskCardProps> = ({ taskData, ...
```

**Update all references:**

- `caseData` → `taskData`
- `CaseStatus.` → `TaskStatus.`
- `updateCaseStatus` → `updateTaskStatus`
- `handleAcceptCase` → `handleAcceptTask`

**Update export:**

```typescript
// Find:
export default CaseCard;

// Replace with:
export default TaskCard;
```

#### 3. Update AcceptTaskButton.tsx

Same pattern as TaskCard - update:

- Interface name
- Props
- Component name
- Variable references
- Export

#### 4. Update TaskTimeline.tsx

Same pattern - update all references.

#### 5. Update component imports

**Files to update:** Any file that imports these components

**Search and replace:**

```typescript
// Find:
import CaseCard from "./components/CaseCard";
import { CaseCard } from "./components/CaseCard";

// Replace with:
import TaskCard from "./components/TaskCard";
import { TaskCard } from "./components/TaskCard";
```

**Update JSX:**

```tsx
// Find:
<CaseCard caseData={...} />

// Replace with:
<TaskCard taskData={...} />
```

### Commit Day 4

```bash
git add .
git commit -m "refactor(day4): rename CaseCard, AcceptCaseButton, CaseTimeline to task-centric names"
```

### Testing Checkpoint

```bash
npm run dev
```

**Test:**

1. Visual check - cards should render correctly
2. Accept button should work
3. Timeline should display
4. No console errors

**Rollback if needed:**

```bash
git reset --hard HEAD~1
```

---

## Day 5: Screens

### Goal

Rename all screen files to task-centric names.

### Manual Steps

#### 1. Rename screen files

```bash
git mv screens/AssignedCasesScreen.tsx screens/AssignedTasksScreen.tsx
git mv screens/InProgressCasesScreen.tsx screens/InProgressTasksScreen.tsx
git mv screens/CompletedCasesScreen.tsx screens/CompletedTasksScreen.tsx
git mv screens/SavedCasesScreen.tsx screens/SavedTasksScreen.tsx
git mv screens/CaseListScreen.tsx screens/TaskListScreen.tsx
```

#### 2. Update TaskListScreen.tsx

Open `screens/TaskListScreen.tsx`:

**Update interface:**

```typescript
// Find:
interface CaseListScreenProps {

// Replace with:
interface TaskListScreenProps {
```

**Update component:**

```typescript
// Find:
const CaseListScreen: React.FC<CaseListScreenProps> = ({

// Replace with:
const TaskListScreen: React.FC<TaskListScreenProps> = ({
```

**Update references:**

- `cases` → `tasks`
- `caseData` → `taskData`
- `<CaseCard` → `<TaskCard`

**Update export:**

```typescript
// Find:
export default CaseListScreen;

// Replace with:
export default TaskListScreen;
```

#### 3. Update other screen files

Apply same pattern to:

- `AssignedTasksScreen.tsx`
- `InProgressTasksScreen.tsx`
- `CompletedTasksScreen.tsx`
- `SavedTasksScreen.tsx`

Update:

- Component imports (`CaseListScreen` → `TaskListScreen`)
- Component usage (`<CaseListScreen` → `<TaskListScreen`)

#### 4. Update routing/navigation

**Find files that import screens:**

- `App.tsx` or main routing file
- Navigation components

**Update imports:**

```typescript
// Find:
import AssignedCasesScreen from "./screens/AssignedCasesScreen";

// Replace with:
import AssignedTasksScreen from "./screens/AssignedTasksScreen";
```

**Update routes:**

```tsx
// Find:
<Route path="/assigned" component={AssignedCasesScreen} />

// Replace with:
<Route path="/assigned" component={AssignedTasksScreen} />
```

### Commit Day 5

```bash
git add .
git commit -m "refactor(day5): rename all screen files to task-centric names"
```

### Testing Checkpoint

```bash
npm run dev
```

**Test:**

1. Navigate to each tab (Assigned, In Progress, Completed, Saved)
2. Verify each screen loads correctly
3. Test navigation between screens
4. Verify no broken routes

**Rollback if needed:**

```bash
git reset --hard HEAD~1
```

---

## Day 6: Hooks & Final Cleanup

### Goal

Rename hooks and clean up any remaining case-centric references.

### Manual Steps

#### 1. Rename hooks

```bash
git mv hooks/useCaseAutoSaveStatus.ts hooks/useTaskAutoSaveStatus.ts
```

#### 2. Update useTaskAutoSaveStatus.ts

Open `hooks/useTaskAutoSaveStatus.ts`:

**Update export:**

```typescript
// Find:
export const useCaseAutoSaveStatus = (caseId: string) => {

// Replace with:
export const useTaskAutoSaveStatus = (taskId: string) => {
```

**Update all references:**

- `caseId` → `taskId`

#### 3. Update hook imports

**Search and replace:**

```typescript
// Find:
import { useCaseAutoSaveStatus } from "./hooks/useCaseAutoSaveStatus";

// Replace with:
import { useTaskAutoSaveStatus } from "./hooks/useTaskAutoSaveStatus";
```

**Update usage:**

```typescript
// Find:
const { hasAutoSaveData } = useCaseAutoSaveStatus(caseId);

// Replace with:
const { hasAutoSaveData } = useTaskAutoSaveStatus(taskId);
```

#### 4. Final variable cleanup

**Search for remaining case-centric variables:**

Use global search to find:

- `caseId` (where it should be `taskId`)
- `caseData` (where it should be `taskData`)
- `currentCase` (where it should be `currentTask`)

**Note:** Keep `caseId` when it refers to the parent case ID (the number field), not the task ID.

#### 5. Update comments

**Search and replace in comments:**

```typescript
// Find:
// Case
/* Case

// Replace with:
// Task
/* Task
```

### Commit Day 6

```bash
git add .
git commit -m "refactor(day6): rename hooks and final cleanup of variable names and comments"
```

### Testing Checkpoint

```bash
npm run type-check
npm run dev
```

**Test:**

1. Full app walkthrough
2. All features should work
3. No TypeScript errors
4. No console errors

**Rollback if needed:**

```bash
git reset --hard HEAD~1
```

---

## Day 7: Verification & Testing

### Goal

Comprehensive testing and verification that everything works.

### Manual Steps

#### 1. TypeScript compilation

```bash
npm run type-check
```

**Expected:** No errors

**If errors:** Fix them before proceeding

#### 2. Lint check (if available)

```bash
npm run lint
```

#### 3. Run dev server

```bash
npm run dev
```

#### 4. Comprehensive manual testing

See [Testing Checklist](#testing-checklist) below.

#### 5. Review changes

```bash
# See all changes
git diff main

# See list of changed files
git diff --name-only main
```

#### 6. Push refactor branch

```bash
git push origin refactor/task-centric-naming
```

#### 7. Create Pull Request

Create a PR from `refactor/task-centric-naming` to `main` with:

**Title:** "Refactor: Rename case-centric to task-centric naming"

**Description:**

```markdown
## Summary

Complete naming refactor from case-centric to task-centric terminology.

## Changes

- Renamed `Case` → `VerificationTask`
- Renamed `CaseStatus` → `TaskStatus`
- Renamed `CaseContext` → `TaskContext`
- Renamed `caseService` → `taskService`
- Renamed all components, screens, and hooks
- Updated all variable names and comments

## Testing

- ✅ TypeScript compiles without errors
- ✅ All tabs load correctly
- ✅ Accept task flow works
- ✅ Multi-task scenarios work
- ✅ Offline-first behavior preserved
- ✅ Save/submission flows work

## Breaking Changes

None - purely naming changes, no logic changes.
```

---

## Rollback Instructions

### Rollback Everything

```bash
# Go back to main
git checkout main

# Delete refactor branch
git branch -D refactor/task-centric-naming

# You're back to the pre-refactor state
```

### Rollback to Specific Day

```bash
# See commit history
git log --oneline

# Reset to specific commit
git reset --hard <commit-hash>

# Or reset by number of commits
git reset --hard HEAD~3  # Go back 3 commits
```

### Rollback Last Commit Only

```bash
git reset --hard HEAD~1
```

---

## Testing Checklist

### Basic Functionality

- [ ] App loads without errors
- [ ] All tabs are accessible (Assigned, In Progress, Completed, Saved)
- [ ] Tasks display correctly in each tab

### Accept Task Flow

- [ ] Navigate to Assigned tab
- [ ] See at least one assigned task
- [ ] Tap "Accept" button
- [ ] Task immediately disappears from Assigned tab
- [ ] Navigate to In Progress tab
- [ ] Task appears in In Progress tab
- [ ] No errors in console

### Multi-Task Scenario

- [ ] Have multiple tasks for the same case (same customer)
- [ ] Accept one task
- [ ] Verify only that task moves to In Progress
- [ ] Other tasks remain in Assigned
- [ ] Each task is independent

### Offline-First Behavior

- [ ] Enable airplane mode or disconnect network
- [ ] Accept a task
- [ ] Task moves to In Progress immediately (local update)
- [ ] Re-enable network
- [ ] Wait for sync
- [ ] Verify backend shows task as IN_PROGRESS

### Save/Submission Flow

- [ ] Start working on a task
- [ ] Fill out form data
- [ ] Save the task
- [ ] Verify save status is preserved
- [ ] Complete the task
- [ ] Submit the task
- [ ] Verify submission status updates correctly

### All Verification Types

Test with different verification types:

- [ ] Residence
- [ ] Office
- [ ] Business
- [ ] Residence-cum-Office
- [ ] Builder
- [ ] NOC
- [ ] DSA/DST & Connector
- [ ] Property APF
- [ ] Property Individual

### Edge Cases

- [ ] Task with no verification outcome selected
- [ ] Task with attachments
- [ ] Task with auto-saved data
- [ ] Revisit tasks
- [ ] Tasks with different priorities

### Performance

- [ ] App loads quickly
- [ ] Tab switching is smooth
- [ ] No lag when accepting tasks
- [ ] No memory leaks (check dev tools)

---

## Common Issues & Solutions

### Issue: TypeScript errors about missing imports

**Solution:**

```bash
# Search for old imports
grep -r "from.*CaseContext" .
grep -r "import.*Case," .

# Update them manually or use find/replace
```

### Issue: Component not rendering

**Solution:**

- Check that component export name matches import
- Verify JSX usage (`<TaskCard` not `<CaseCard`)
- Check props are correctly named (`taskData` not `caseData`)

### Issue: Runtime error "Cannot read property of undefined"

**Solution:**

- Check variable names are consistent
- Verify destructuring uses correct names
- Check that `tasks` array exists (not `cases`)

### Issue: Offline sync not working

**Solution:**

- Verify `taskService` is correctly imported
- Check local storage keys haven't changed
- Verify sync queue logic is intact

---

## File Rename Summary

### Types

- `types.ts` - Updated in place (Case → VerificationTask, CaseStatus → TaskStatus)

### Context

- `context/CaseContext.tsx` → `context/TaskContext.tsx`

### Services

- `services/caseService.ts` → `services/taskService.ts`
- `services/caseStatusService.ts` → `services/taskStatusService.ts`

### Components

- `components/CaseCard.tsx` → `components/TaskCard.tsx`
- `components/AcceptCaseButton.tsx` → `components/AcceptTaskButton.tsx`
- `components/CaseTimeline.tsx` → `components/TaskTimeline.tsx`

### Screens

- `screens/AssignedCasesScreen.tsx` → `screens/AssignedTasksScreen.tsx`
- `screens/InProgressCasesScreen.tsx` → `screens/InProgressTasksScreen.tsx`
- `screens/CompletedCasesScreen.tsx` → `screens/CompletedTasksScreen.tsx`
- `screens/SavedCasesScreen.tsx` → `screens/SavedTasksScreen.tsx`
- `screens/CaseListScreen.tsx` → `screens/TaskListScreen.tsx`

### Hooks

- `hooks/useCaseAutoSaveStatus.ts` → `hooks/useTaskAutoSaveStatus.ts`

---

## Success Criteria

The refactor is complete when:

✅ All TypeScript compilation errors are resolved  
✅ All tests pass (if you have automated tests)  
✅ Manual testing checklist is complete  
✅ No console errors in browser  
✅ All features work exactly as before  
✅ Code review is approved  
✅ PR is merged to main

---

## Post-Refactor

After merging:

1. **Update documentation** - Update any README or docs that mention "Case"
2. **Notify team** - Let other developers know about the naming changes
3. **Monitor production** - Watch for any issues after deployment
4. **Clean up** - Delete the refactor branch after successful merge

---

## Questions or Issues?

If you encounter problems:

1. Check this guide for solutions
2. Review the commit history to see what changed
3. Use `git diff` to compare with main
4. Rollback if needed and try again
5. Ask for help if stuck

Remember: You can always rollback to main and start over!
