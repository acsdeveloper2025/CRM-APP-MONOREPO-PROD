#!/bin/bash

################################################################################
# CRM-Mobile Task-Centric Naming Refactor Script
# 
# This script performs a complete naming refactor from case-centric to 
# task-centric naming across the entire crm-mobile application.
#
# IMPORTANT: Read the accompanying REFACTOR_GUIDE.md before running this script!
#
# Usage: ./refactor-task-centric.sh
################################################################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

confirm_step() {
    echo -e "${YELLOW}Press ENTER to continue or Ctrl+C to abort...${NC}"
    read
}

################################################################################
# STEP 0: GIT SAFETY CHECKPOINT (CRITICAL - DO THIS FIRST)
################################################################################

log_warning "========================================="
log_warning "STEP 0: GIT SAFETY CHECKPOINT"
log_warning "========================================="
log_info "This will save your current work to main branch before refactoring"
confirm_step

git checkout main
git pull origin main
git add .
git commit -m "pre-refactor backup: save current state before task-centric naming refactor" || log_warning "Nothing to commit (already clean)"
git push origin main

log_success "Git safety checkpoint complete - current state backed up to main"

# Create refactor branch
log_info "Creating refactor branch..."
git checkout -b refactor/task-centric-naming

log_success "Now on branch: refactor/task-centric-naming"

################################################################################
# DAY 1: CORE TYPES MIGRATION
################################################################################

log_warning "========================================="
log_warning "DAY 1: CORE TYPES MIGRATION"
log_warning "========================================="
log_info "Renaming Case → VerificationTask and CaseStatus → TaskStatus"
confirm_step

# Update types.ts - rename interface and enum
log_info "Updating types.ts..."

# Rename Case interface to VerificationTask
perl -i -pe 's/^export interface Case \{/export interface VerificationTask {/g' types.ts

# Rename CaseStatus enum to TaskStatus
perl -i -pe 's/^export enum CaseStatus \{/export enum TaskStatus {/g' types.ts

# Update all references within types.ts
perl -i -pe 's/: Case;/: VerificationTask;/g' types.ts
perl -i -pe 's/: Case\[/: VerificationTask[/g' types.ts
perl -i -pe 's/<Case>/<VerificationTask>/g' types.ts
perl -i -pe 's/CaseStatus\./TaskStatus./g' types.ts
perl -i -pe 's/: CaseStatus/: TaskStatus/g' types.ts

log_success "types.ts updated"

# Commit Day 1
git add types.ts
git commit -m "refactor(day1): rename Case to VerificationTask and CaseStatus to TaskStatus"

log_success "Day 1 complete - Core types migrated"

################################################################################
# DAY 2: CONTEXT & STATE MANAGEMENT
################################################################################

log_warning "========================================="
log_warning "DAY 2: CONTEXT & STATE MANAGEMENT"
log_warning "========================================="
log_info "Renaming CaseContext → TaskContext and updating all state management"
confirm_step

# Rename the context file
log_info "Renaming context/CaseContext.tsx → context/TaskContext.tsx..."
git mv context/CaseContext.tsx context/TaskContext.tsx

# Update TaskContext.tsx internal content
log_info "Updating TaskContext.tsx content..."

# Update imports
perl -i -pe 's/import \{ Case, CaseStatus \}/import { VerificationTask, TaskStatus }/g' context/TaskContext.tsx
perl -i -pe 's/from.*types.*Case.*CaseStatus/from ".\/types" { VerificationTask, TaskStatus }/g' context/TaskContext.tsx

# Update interface names
perl -i -pe 's/interface CaseContextType/interface TaskContextType/g' context/TaskContext.tsx

# Update state and methods
perl -i -pe 's/const \[cases, setCases\]/const [tasks, setTasks]/g' context/TaskContext.tsx
perl -i -pe 's/: Case\[\]/: VerificationTask[]/g' context/TaskContext.tsx
perl -i -pe 's/: Case/: VerificationTask/g' context/TaskContext.tsx
perl -i -pe 's/CaseStatus\./TaskStatus./g' context/TaskContext.tsx
perl -i -pe 's/: CaseStatus/: TaskStatus/g' context/TaskContext.tsx

# Update method names
perl -i -pe 's/const fetchCases/const fetchTasks/g' context/TaskContext.tsx
perl -i -pe 's/const updateCaseStatus/const updateTaskStatus/g' context/TaskContext.tsx
perl -i -pe 's/const updateCase /const updateTask /g' context/TaskContext.tsx

# Update variable names
perl -i -pe 's/\bcases\b/tasks/g' context/TaskContext.tsx
perl -i -pe 's/\bcase\b/task/g' context/TaskContext.tsx
perl -i -pe 's/\bcaseId\b/taskId/g' context/TaskContext.tsx
perl -i -pe 's/\bcaseData\b/taskData/g' context/TaskContext.tsx
perl -i -pe 's/\bcurrentCase\b/currentTask/g' context/TaskContext.tsx

# Update context creation
perl -i -pe 's/const CaseContext/const TaskContext/g' context/TaskContext.tsx
perl -i -pe 's/CaseContext.Provider/TaskContext.Provider/g' context/TaskContext.tsx

# Update hook export
perl -i -pe 's/export const useCases/export const useTasks/g' context/TaskContext.tsx
perl -i -pe 's/useContext\(CaseContext\)/useContext(TaskContext)/g' context/TaskContext.tsx

log_success "TaskContext.tsx updated"

# Update all imports throughout the app
log_info "Updating imports across the entire app..."

# Find all files that import CaseContext and update them
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/from.*CaseContext.*$/from ".\/context\/TaskContext"/g' {} \;
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/useCases/useTasks/g' {} \;
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/import \{ Case, CaseStatus \}/import { VerificationTask, TaskStatus }/g' {} \;

log_success "All imports updated"

# Commit Day 2
git add .
git commit -m "refactor(day2): rename CaseContext to TaskContext and update state management"

log_success "Day 2 complete - Context & state management migrated"

################################################################################
# DAY 3: SERVICES LAYER
################################################################################

log_warning "========================================="
log_warning "DAY 3: SERVICES LAYER"
log_warning "========================================="
log_info "Renaming caseService → taskService and caseStatusService → taskStatusService"
confirm_step

# Rename service files
log_info "Renaming service files..."
git mv services/caseService.ts services/taskService.ts
git mv services/caseStatusService.ts services/taskStatusService.ts

# Update taskService.ts
log_info "Updating taskService.ts..."
perl -i -pe 's/import \{ Case, CaseStatus \}/import { VerificationTask, TaskStatus }/g' services/taskService.ts
perl -i -pe 's/interface BackendCase/interface BackendTask/g' services/taskService.ts
perl -i -pe 's/: Case\[\]/: VerificationTask[]/g' services/taskService.ts
perl -i -pe 's/: Case/: VerificationTask/g' services/taskService.ts
perl -i -pe 's/CaseStatus\./TaskStatus./g' services/taskService.ts
perl -i -pe 's/: CaseStatus/: TaskStatus/g' services/taskService.ts
perl -i -pe 's/async getCases/async getTasks/g' services/taskService.ts
perl -i -pe 's/async updateCase/async updateTask/g' services/taskService.ts
perl -i -pe 's/async getCase/async getTask/g' services/taskService.ts
perl -i -pe 's/\bcases\b/tasks/g' services/taskService.ts
perl -i -pe 's/\bcase\b/task/g' services/taskService.ts

# Update taskStatusService.ts
log_info "Updating taskStatusService.ts..."
perl -i -pe 's/import \{ Case, CaseStatus \}/import { VerificationTask, TaskStatus }/g' services/taskStatusService.ts
perl -i -pe 's/class CaseStatusService/class TaskStatusService/g' services/taskStatusService.ts
perl -i -pe 's/export \{ CaseStatusService \}/export { TaskStatusService }/g' services/taskStatusService.ts
perl -i -pe 's/: Case/: VerificationTask/g' services/taskStatusService.ts
perl -i -pe 's/CaseStatus\./TaskStatus./g' services/taskStatusService.ts
perl -i -pe 's/: CaseStatus/: TaskStatus/g' services/taskStatusService.ts
perl -i -pe 's/async updateCaseStatus/async updateTaskStatus/g' services/taskStatusService.ts
perl -i -pe 's/caseService/taskService/g' services/taskStatusService.ts

# Update all imports of these services
log_info "Updating service imports across the app..."
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/from.*caseService.*$/from ".\/services\/taskService"/g' {} \;
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/from.*caseStatusService.*$/from ".\/services\/taskStatusService"/g' {} \;
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/CaseStatusService/TaskStatusService/g' {} \;
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/caseService/taskService/g' {} \;

log_success "Services updated"

# Commit Day 3
git add .
git commit -m "refactor(day3): rename caseService to taskService and caseStatusService to taskStatusService"

log_success "Day 3 complete - Services layer migrated"

################################################################################
# DAY 4: COMPONENTS (PART 1)
################################################################################

log_warning "========================================="
log_warning "DAY 4: COMPONENTS (PART 1)"
log_warning "========================================="
log_info "Renaming CaseCard, AcceptCaseButton, CaseTimeline"
confirm_step

# Rename component files
log_info "Renaming component files..."
git mv components/CaseCard.tsx components/TaskCard.tsx
git mv components/AcceptCaseButton.tsx components/AcceptTaskButton.tsx
git mv components/CaseTimeline.tsx components/TaskTimeline.tsx

# Update TaskCard.tsx
log_info "Updating TaskCard.tsx..."
perl -i -pe 's/import \{ Case, CaseStatus \}/import { VerificationTask, TaskStatus }/g' components/TaskCard.tsx
perl -i -pe 's/interface CaseCardProps/interface TaskCardProps/g' components/TaskCard.tsx
perl -i -pe 's/: Case/: VerificationTask/g' components/TaskCard.tsx
perl -i -pe 's/CaseStatus\./TaskStatus./g' components/TaskCard.tsx
perl -i -pe 's/: CaseStatus/: TaskStatus/g' components/TaskCard.tsx
perl -i -pe 's/\bcaseData\b/taskData/g' components/TaskCard.tsx
perl -i -pe 's/const CaseCard/const TaskCard/g' components/TaskCard.tsx
perl -i -pe 's/export default CaseCard/export default TaskCard/g' components/TaskCard.tsx
perl -i -pe 's/handleAcceptCase/handleAcceptTask/g' components/TaskCard.tsx
perl -i -pe 's/updateCaseStatus/updateTaskStatus/g' components/TaskCard.tsx

# Update AcceptTaskButton.tsx
log_info "Updating AcceptTaskButton.tsx..."
perl -i -pe 's/import \{ Case, CaseStatus \}/import { VerificationTask, TaskStatus }/g' components/AcceptTaskButton.tsx
perl -i -pe 's/interface AcceptCaseButtonProps/interface AcceptTaskButtonProps/g' components/AcceptTaskButton.tsx
perl -i -pe 's/: Case/: VerificationTask/g' components/AcceptTaskButton.tsx
perl -i -pe 's/CaseStatus\./TaskStatus./g' components/AcceptTaskButton.tsx
perl -i -pe 's/: CaseStatus/: TaskStatus/g' components/AcceptTaskButton.tsx
perl -i -pe 's/\bcaseData\b/taskData/g' components/AcceptTaskButton.tsx
perl -i -pe 's/const AcceptCaseButton/const AcceptTaskButton/g' components/AcceptTaskButton.tsx
perl -i -pe 's/export default AcceptCaseButton/export default AcceptTaskButton/g' components/AcceptTaskButton.tsx
perl -i -pe 's/handleAcceptCase/handleAcceptTask/g' components/AcceptTaskButton.tsx

# Update TaskTimeline.tsx
log_info "Updating TaskTimeline.tsx..."
perl -i -pe 's/import \{ Case \}/import { VerificationTask }/g' components/TaskTimeline.tsx
perl -i -pe 's/interface CaseTimelineProps/interface TaskTimelineProps/g' components/TaskTimeline.tsx
perl -i -pe 's/: Case/: VerificationTask/g' components/TaskTimeline.tsx
perl -i -pe 's/\bcaseData\b/taskData/g' components/TaskTimeline.tsx
perl -i -pe 's/const CaseTimeline/const TaskTimeline/g' components/TaskTimeline.tsx
perl -i -pe 's/export default CaseTimeline/export default TaskTimeline/g' components/TaskTimeline.tsx

# Update imports
log_info "Updating component imports..."
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/from.*CaseCard.*$/from ".\/components\/TaskCard"/g' {} \;
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/from.*AcceptCaseButton.*$/from ".\/components\/AcceptTaskButton"/g' {} \;
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/from.*CaseTimeline.*$/from ".\/components\/TaskTimeline"/g' {} \;
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/<CaseCard /<TaskCard /g' {} \;
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/<CaseTimeline /<TaskTimeline /g' {} \;

log_success "Components (Part 1) updated"

# Commit Day 4
git add .
git commit -m "refactor(day4): rename CaseCard, AcceptCaseButton, CaseTimeline to task-centric names"

log_success "Day 4 complete - Components (Part 1) migrated"

################################################################################
# DAY 5: SCREENS
################################################################################

log_warning "========================================="
log_warning "DAY 5: SCREENS"
log_warning "========================================="
log_info "Renaming all screen files"
confirm_step

# Rename screen files
log_info "Renaming screen files..."
git mv screens/AssignedCasesScreen.tsx screens/AssignedTasksScreen.tsx
git mv screens/InProgressCasesScreen.tsx screens/InProgressTasksScreen.tsx
git mv screens/CompletedCasesScreen.tsx screens/CompletedTasksScreen.tsx
git mv screens/SavedCasesScreen.tsx screens/SavedTasksScreen.tsx
git mv screens/CaseListScreen.tsx screens/TaskListScreen.tsx

# Update screen content
log_info "Updating screen content..."
perl -i -pe 's/import \{ Case, CaseStatus \}/import { VerificationTask, TaskStatus }/g' screens/*.tsx
perl -i -pe 's/: Case/: VerificationTask/g' screens/*.tsx
perl -i -pe 's/CaseStatus\./TaskStatus./g' screens/*.tsx
perl -i -pe 's/: CaseStatus/: TaskStatus/g' screens/*.tsx
perl -i -pe 's/interface CaseListScreenProps/interface TaskListScreenProps/g' screens/TaskListScreen.tsx
perl -i -pe 's/const CaseListScreen/const TaskListScreen/g' screens/TaskListScreen.tsx
perl -i -pe 's/export default CaseListScreen/export default TaskListScreen/g' screens/TaskListScreen.tsx
perl -i -pe 's/<CaseCard /<TaskCard /g' screens/TaskListScreen.tsx
perl -i -pe 's/\bcaseData\b/taskData/g' screens/*.tsx

# Update imports
log_info "Updating screen imports..."
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" ! -path "./screens/*" -exec perl -i -pe 's/from.*AssignedCasesScreen.*$/from ".\/screens\/AssignedTasksScreen"/g' {} \;
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" ! -path "./screens/*" -exec perl -i -pe 's/from.*InProgressCasesScreen.*$/from ".\/screens\/InProgressTasksScreen"/g' {} \;
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" ! -path "./screens/*" -exec perl -i -pe 's/from.*CompletedCasesScreen.*$/from ".\/screens\/CompletedTasksScreen"/g' {} \;
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" ! -path "./screens/*" -exec perl -i -pe 's/from.*SavedCasesScreen.*$/from ".\/screens\/SavedTasksScreen"/g' {} \;
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" ! -path "./screens/*" -exec perl -i -pe 's/from.*CaseListScreen.*$/from ".\/screens\/TaskListScreen"/g' {} \;

log_success "Screens updated"

# Commit Day 5
git add .
git commit -m "refactor(day5): rename all screen files to task-centric names"

log_success "Day 5 complete - Screens migrated"

################################################################################
# DAY 6: HOOKS & FINAL CLEANUP
################################################################################

log_warning "========================================="
log_warning "DAY 6: HOOKS & FINAL CLEANUP"
log_warning "========================================="
log_info "Renaming hooks and cleaning up remaining references"
confirm_step

# Rename hooks
log_info "Renaming hooks..."
git mv hooks/useCaseAutoSaveStatus.ts hooks/useTaskAutoSaveStatus.ts

# Update hook content
perl -i -pe 's/export const useCaseAutoSaveStatus/export const useTaskAutoSaveStatus/g' hooks/useTaskAutoSaveStatus.ts
perl -i -pe 's/\bcaseId\b/taskId/g' hooks/useTaskAutoSaveStatus.ts

# Update hook imports
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/from.*useCaseAutoSaveStatus.*$/from ".\/hooks\/useTaskAutoSaveStatus"/g' {} \;
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/useCaseAutoSaveStatus/useTaskAutoSaveStatus/g' {} \;

# Final cleanup - update any remaining caseId references that are actually taskId
log_info "Final cleanup of variable names..."
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/caseId: string/taskId: string/g' {} \;

# Update comments
log_info "Updating comments..."
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/\/\/ Case /\/\/ Task /g' {} \;
find . -type f \( -name "*.tsx" -o -name "*.ts" \) ! -path "./node_modules/*" ! -path "./.git/*" -exec perl -i -pe 's/\/\* Case /\/\* Task /g' {} \;

log_success "Hooks and cleanup complete"

# Commit Day 6
git add .
git commit -m "refactor(day6): rename hooks and final cleanup of variable names and comments"

log_success "Day 6 complete - Hooks & cleanup done"

################################################################################
# DAY 7: VERIFICATION
################################################################################

log_warning "========================================="
log_warning "DAY 7: VERIFICATION"
log_warning "========================================="
log_info "Running TypeScript compilation and final checks"

# Try to compile
log_info "Running TypeScript check..."
npm run type-check || log_warning "TypeScript errors found - review and fix manually"

log_success "========================================="
log_success "REFACTOR COMPLETE!"
log_success "========================================="
log_info ""
log_info "Next steps:"
log_info "1. Review the changes: git diff main"
log_info "2. Test the application thoroughly (see REFACTOR_GUIDE.md for test checklist)"
log_info "3. Fix any remaining TypeScript errors"
log_info "4. Run: npm run dev"
log_info "5. Test all critical flows"
log_info "6. If everything works: git push origin refactor/task-centric-naming"
log_info "7. Create a PR to merge into main"
log_info ""
log_warning "If you need to rollback: git checkout main && git branch -D refactor/task-centric-naming"
