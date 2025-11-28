#!/bin/bash

echo "🔧 Fixing property access errors for union types..."

# Fix product?.name access - need to check if it's an object first
# Pattern: taskData.product?.name should be typeof taskData.product === 'object' ? taskData.product?.name : taskData.product

# Fix client?.name access similarly
# Pattern: taskData.client?.name should be typeof taskData.client === 'object' ? taskData.client?.name : taskData.client

# Find all files with these patterns
echo "📝 Finding files with product?.name or client?.name..."
grep -r "taskData\.product?.name" components/forms --include="*.tsx" -l
grep -r "taskData\.client?.name" components/forms --include="*.tsx" -l

# Use sed to fix the patterns
echo "📝 Fixing product?.name patterns..."
find components/forms -type f -name "*.tsx" -exec sed -i '' \
  's/taskData\.product?\.name/typeof taskData.product === '\''object'\'' ? taskData.product?.name : taskData.product/g' {} +

echo "📝 Fixing client?.name patterns..."
find components/forms -type f -name "*.tsx" -exec sed -i '' \
  's/taskData\.client?\.name/typeof taskData.client === '\''object'\'' ? taskData.client?.name : taskData.client/g' {} +

echo "✅ Property access fixes completed!"
