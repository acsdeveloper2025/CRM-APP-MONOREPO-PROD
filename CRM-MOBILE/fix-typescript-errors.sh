#!/bin/bash

echo "🔧 Fixing TypeScript errors in crm-mobile..."

# Fix 1: Replace toggleSaveCase with toggleSaveTask
echo "📝 Fixing toggleSaveCase → toggleSaveTask..."
find components -type f -name "*.tsx" -exec sed -i '' 's/toggleSaveCase/toggleSaveTask/g' {} +

# Fix 2: Replace fetchCases with fetchTasks  
echo "📝 Fixing fetchCases → fetchTasks..."
find components -type f -name "*.tsx" -exec sed -i '' 's/fetchCases/fetchTasks/g' {} +

# Fix 3: Replace caseId prop with taskId in AutoSaveFormWrapper
echo "📝 Fixing caseId → taskId in AutoSaveFormWrapper..."
find components/forms -type f -name "*.tsx" -exec sed -i '' 's/<AutoSaveFormWrapper[[:space:]]*caseId=/<AutoSaveFormWrapper taskId=/g' {} +
find components/forms -type f -name "*.tsx" -exec sed -i '' 's/caseId={/taskId={/g' {} +

echo "✅ Basic fixes completed!"
echo "🔍 Running TypeScript check..."

npx tsc --noEmit 2>&1 | head -n 50
