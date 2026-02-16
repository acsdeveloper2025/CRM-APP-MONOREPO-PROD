
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getFiles(dir) {
  try {
    const substeps = fs.readdirSync(dir);
    const files = [];
    substeps.forEach(substep => {
      const fullPath = path.join(dir, substep);
      if (fs.statSync(fullPath).isDirectory()) {
        if (substep !== 'node_modules' && substep !== 'dist' && substep !== 'build') {
          files.push(...getFiles(fullPath));
        }
      } else {
        if (substep.endsWith('.ts') || substep.endsWith('.tsx')) {
          files.push(fullPath);
        }
      }
    });
    return files;
  } catch (e) {
    return [];
  }
}

async function scan() {
  const rootDir = path.resolve(__dirname, 'src');
  console.log(`Scanning ${rootDir}...`);
  const files = getFiles(rootDir);
  const iconSet = new Set();
  const fileMap = {};

  // Matches: import { Icon1, Icon2 } from 'lucide-react'
  // Handling multiline is tricky with regex, but we can read the whole file and normalize whitespace?
  // Better: Match "from 'lucide-react'" and look backwards for "import {...}"
  
  const fromLucideRegex = /from\s+['"]lucide-react['"]/g;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    
    // Simple parsing state machine
    if (content.includes('lucide-react')) {
      // Extract the import block
      // Look for: import { ... } from 'lucide-react';
      const importMatch = content.match(/import\s+{([^}]+)}\s+from\s+['"]lucide-react['"]/);
      if (importMatch) {
         const imports = importMatch[1].split(',').map(s => s.trim()).filter(Boolean);
         imports.forEach(iconRaw => {
            // Handle alias: import { Icon as MyIcon }
            const parts = iconRaw.split(/\s+as\s+/);
            const coreIcon = parts[0].trim();
            if (coreIcon) {
                iconSet.add(coreIcon);
                if (!fileMap[coreIcon]) fileMap[coreIcon] = [];
                fileMap[coreIcon].push(file);
            }
         });
      }
      
      // Check for namespace import: import * as Lucide from 'lucide-react'
      if (content.match(/import\s+\*\s+as\s/)) {
         console.log(`[WARN] Namespace import found in: ${file}`);
      }
    }
  }

  console.log('\n--- ICON REPORT ---');
  const icons = Array.from(iconSet).sort();
  console.log(JSON.stringify(icons, null, 2));
  
  console.log('\n--- FILE MAPPING ---');
  icons.forEach(icon => {
    console.log(`${icon}: ${fileMap[icon].length} files`);
  });
}

scan().catch(console.error);
