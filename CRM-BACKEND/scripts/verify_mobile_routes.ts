
import fs from 'fs';
import path from 'path';

const mobileRoutesPath = path.join(__dirname, '../src/routes/mobile.ts');

try {
  if (!fs.existsSync(mobileRoutesPath)) {
    console.error(`❌ File not found: ${mobileRoutesPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(mobileRoutesPath, 'utf-8');

  const criticalRoutes = [
    { method: 'post', path: '/auth/login' },
    { method: 'get', path: '/tasks' },
    { method: 'get', path: '/verification-tasks/:taskId' },
    { method: 'post', path: '/verification-tasks/:taskId/start' },
    { method: 'post', path: '/verification-tasks/:taskId/complete' },
    { method: 'post', path: '/verification-tasks/:taskId/revoke' },
    { method: 'post', path: '/verification-tasks/:taskId/verification/residence' },
    { method: 'post', path: '/sync/upload' },
    { method: 'get', path: '/sync/download' }
  ];

  console.log('🔍 Verifying Critical Mobile Routes (Static Analysis)...');
  let missing = 0;

  criticalRoutes.forEach(route => {
    // Regex to look for router.method('path', ...) or router.method("path", ...)
    // escape special chars in path like /
    const escapedPath = route.path.replace(/\//g, '\\/');
    const regex = new RegExp(`router\\.${route.method}\\(\\s*['"]${escapedPath}['"]`, 'i');
    
    if (regex.test(content)) {
      console.log(`  ✅ ${route.method.toUpperCase()} ${route.path} - FOUND`);
    } else {
      console.log(`  ❌ ${route.method.toUpperCase()} ${route.path} - MISSING`);
      missing++;
    }
  });

  if (missing === 0) {
    console.log('\n✨ All critical mobile routes are present in the code.');
    process.exit(0);
  } else {
    console.error(`\n⚠️ ${missing} critical routes are missing from mobile.ts!`);
    process.exit(1);
  }
} catch (error) {
  console.error('An error occurred:', error);
  process.exit(1);
}
